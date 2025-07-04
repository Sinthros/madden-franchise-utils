const axios = require('axios');
const cheerio = require('cheerio');
const URL = 'https://www.tankathon.com/nfl/past_drafts/2025';
const FORFEITED_KWD = 'forfeited';
const COMP_KWD = 'compensatory';
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');


const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];


const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

async function getDraftPicks() {
  const { data } = await axios.get(URL);
  const $ = cheerio.load(data);

  let currentRoundLabel = '';
  let inCompRound = false;
  let pick = 0;
  const results = {};
  const forfeitedTeams = [];

  $('#mock-draft-board-container')
    .find('.mock-round-label.nfl, .mock-row.nfl')
    .each((_, el) => {
      const elem = $(el);

      if (elem.hasClass('mock-round-label')) {
        currentRoundLabel = elem.text().trim();
        inCompRound = currentRoundLabel.toLowerCase().includes(COMP_KWD);
        return;
      }

      if (elem.hasClass('mock-row')) {
        if (inCompRound) return;

        const logoDiv = elem.find('.mock-row-logo');
        const teamImg = logoDiv.find('img.nba-30'); // current team
        const tradeImg = logoDiv.find('img.mock-trade'); // traded from team

        const team = teamImg.attr('alt')?.trim();
        const tradeSrc = tradeImg.attr('src') || '';
        const tradedFromMatch = tradeSrc.match(/\/nfl\/(\w+)\.svg$/);
        const tradedFromRaw = tradedFromMatch?.[1]?.toUpperCase();
        const tradedFrom = tradedFromRaw === 'WSH' ? 'WAS' : tradedFromRaw;

        const schoolPositions = elem.find('.mock-row-school-position');
        const schoolPosText = schoolPositions[0]?.children?.[0]?.data?.trim().toLowerCase() || '';
        const finalTeam = team === 'WSH' ? 'WAS' : team;

        if (!finalTeam) return;

        if (schoolPosText === FORFEITED_KWD) {
          forfeitedTeams.push(finalTeam);
          return;
        }

        results[pick++] = {
          team: finalTeam,
          tradedFrom: tradedFrom || finalTeam,
        };
      }
    });

  // Append forfeited picks at end
  forfeitedTeams.forEach((team) => {
    results[pick++] = {
      team,
      tradedFrom: team,
    };
  });

  return results;
}

franchise.on('ready', async function () {
  const draftPickTable = franchise.getTableByUniqueId(tables.draftPickTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([draftPickTable, teamTable]);

  const teamBinaryDict = {};
  const teamTableId = teamTable.header.tableId;

  for (const record of FranchiseUtils.getActiveRecords(teamTable)) {
    teamBinaryDict[record.ShortName] = getBinaryReferenceData(teamTableId, record.index);
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

    const { team, tradedFrom } = draftPick;
    const currentRef = teamBinaryDict[team];
    const tradedRef = teamBinaryDict[tradedFrom];

    if (currentRef) {
      record.CurrentTeam = currentRef;
    } else {
      console.warn(`Warning: No binary reference for current team ${team} at pick ${currentPick}`);
    }

    if (tradedRef) {
      record.OriginalTeam = tradedRef;
    } else {
      console.warn(`Warning: No binary reference for traded-from team ${tradedFrom} at pick ${currentPick}`);
    }
  }

  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
