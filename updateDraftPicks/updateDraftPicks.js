const axios = require('axios');
const cheerio = require('cheerio');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');


const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];


const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

/**
 * Scrapes NFL draft pick data from Tankathon.
 * Skips compensatory picks and returns a mapping of pick number to pick details.
 *
 * @returns {Promise<Object<number, { round: number, team: string, tradeTeam: string }>>}
 */
async function getDraftPicks() {
  const { data: html } = await axios.get('https://www.tankathon.com/nfl/full_draft');
  const $ = cheerio.load(html);

  const draftPicks = {};
  let pickIndex = 0;

  const formatTeamName = href =>
    href ? href.replace('/nfl/', '').replace(/^\w/, c => c.toUpperCase()) : '';

  $('.full-draft-round-nfl').each((roundIndex, roundEl) => {
    $(roundEl).find('.full-draft td.pick-number').each((_, cell) => {
      const $cell = $(cell);

      // Skip compensatory picks
      if ($cell.find('span.primary[data-balloon="Compensatory pick"]').length > 0) return;

      const teamHref = $cell.next().find('.team-link a').attr('href');
      const tradeTeamHref = $cell.next().find('.trade a.disabled').attr('href');

      draftPicks[pickIndex] = {
        round: roundIndex,
        team: formatTeamName(teamHref),
        tradeTeam: formatTeamName(tradeTeamHref)
      };

      pickIndex++;
    });
  });

  return draftPicks;
}

franchise.on('ready', async function () {
  const draftPickTable = franchise.getTableByUniqueId(tables.draftPickTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([draftPickTable, teamTable]);

  const teamBinaryDict = {};
  const teamTableId = teamTable.header.tableId;

  for (const record of FranchiseUtils.getActiveRecords(teamTable)) {
    teamBinaryDict[record.DisplayName] = getBinaryReferenceData(teamTableId, record.index);
  }

  const allDraftPicks = await getDraftPicks();

  for (const record of FranchiseUtils.getActiveRecords(draftPickTable)) {
    if (record.YearOffset > 0) continue;

    const currentPick = record.PickNumber;
    const draftPick = allDraftPicks[currentPick];

    if (!draftPick) {
      console.warn(`Warning: No draft pick data found for pick number ${currentPick}`);
      continue;
    }

    const { team, tradeTeam } = draftPick;
    const currentRef = teamBinaryDict[team];
    const tradedRef = teamBinaryDict[tradeTeam];

    if (currentRef) {
      record.CurrentTeam = currentRef;
    } else {
      console.warn(`Warning: No binary reference for current team ${team} at pick ${currentPick}`);
    }

    if (tradedRef) {
      record.OriginalTeam = tradedRef;
    } else {
      if (tradeTeam !== '') {
        console.warn(`Warning: No binary reference for traded-from team ${tradeTeam} at pick ${currentPick}`);
      }
      record.OriginalTeam = currentRef;
    }
  }

  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
