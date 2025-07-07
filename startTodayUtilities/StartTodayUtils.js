const FranchiseUtils = require('../Utils/FranchiseUtils');
const stringSimilarity = require('string-similarity');

function getTeamRecordByFullName(teamName, teamTable) {
  if (FranchiseUtils.isBlank(teamName)) return null;
  const teamRecord = teamTable.records.find(
    record => !record.isEmpty &&
    `${record.LongName} ${record.DisplayName}` === teamName && !FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName)
  );

  if (!teamRecord) {
    console.log(`Couldn't find team record based on input ${teamName}.`);
    return null;
  }

  return teamRecord;
}

function getTeamRecordByIndex(teamIndex, teamTable) {
  const teamRecord = teamTable.records.find(
    record => !record.isEmpty &&
    record.TeamIndex === teamIndex && !FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName)
  );

  if (!teamRecord && teamIndex !== 32) {
    console.log(`Couldn't find team record based on index ${teamIndex}.`);
    return null;
  }

  return teamRecord;
}


/**
 * Searches for a player in the franchise player table using fuzzy name matching.
 * Returns the row index of the matched player or -1 if no match is confirmed.
 *
 * @param {object} franchise - Franchise object.
 * @param {object} tables - Object containing table identifiers (e.g. playerTable, teamTable).
 * @param {string} playerName - The name of the player to search for.
 * @param {number} [matchValue=0.5] - Minimum similarity score (0–1) to consider a match.
 * @param {Array<number>} [skippedPlayers=[]] - Array of record indices to skip (already rejected).
 * @param {number} [teamIndex=-1] - Optional team index used for matching against a team record.
 * @param {object} [options={}] - Optional extra matching parameters.
 * @param {boolean} [options.rookiesOnly=false] - Restrict search to rookies only.
 * @param {string|null} [options.url=null] - URL for logging/debugging context.
 * @param {number|null} [options.age=null] - Optional player age to help with confirmation.
 * @param {string|null} [options.college=null] - Optional player college for confirmation.
 * @returns {Promise<number>} The index of the matched player in the player table, or -1.
 */
async function searchForPlayer(
  franchise,
  tables,
  playerName,
  matchValue = 0.5,
  skippedPlayers = [],
  teamIndex = -1,
  options = {}
) {
  const {
    rookiesOnly = false,
    url = null,
    age = null,
    college = null
  } = options;

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([playerTable, teamTable]);

  const normalizedPlayerName = FranchiseUtils.getNormalizedName(playerName);
  const teamRecord = getTeamRecordByIndex(teamIndex, teamTable);
  const teamName = teamRecord ? `${teamRecord.LongName} ${teamRecord.DisplayName}` : null;

  const playersWithMatchValues = playerTable.records
    .filter(record => FranchiseUtils.isValidPlayer(record))
    .filter(record => {
      if (skippedPlayers.includes(record.index)) return false;
      if (rookiesOnly && record.YearsPro > 0) return false;
      return true;
    })
    .map(record => {
      const fullName = FranchiseUtils.getNormalizedName(record);
      const similarity = stringSimilarity.compareTwoStrings(normalizedPlayerName, fullName);
      return { record, similarity };
    })
    .filter(p => p.similarity > matchValue)
    .sort((a, b) => b.similarity - a.similarity)
    .map(p => p.record);

  for (const player of playersWithMatchValues) {
    const index = player.index;
    if (skippedPlayers.includes(index)) continue;

    const playerTeamRecord = getTeamRecordByIndex(player.TeamIndex, teamTable);
    const playerTeamName = playerTeamRecord
      ? `${playerTeamRecord.LongName} ${playerTeamRecord.DisplayName}`
      : null;

    const finalMaddenName = FranchiseUtils.getNormalizedName(player);

    const isExactNameAndTeamMatch =
      normalizedPlayerName === finalMaddenName && teamName === playerTeamName;

    // Only do FA match if the age and college is provided
    const isFAMatch =
      normalizedPlayerName === finalMaddenName &&
      (age !== null && player.Age === age) &&
      (college !== null && (player.College || '').toLowerCase() === college.toLowerCase());

    if (isExactNameAndTeamMatch || isFAMatch) {
      return index;
    } else {
    const message =
        `Name: ${normalizedPlayerName}. Team: ${teamName}.` +
        (age ? ` Age: ${age}.` : '') + (url ? ` URL: ${url}.` : '') + '\n' +
        `Madden: ${finalMaddenName}, ${player.Age}, ${player.Position} for the ${playerTeamName}. ` +
        `${player.YearsPro} years of experience.` +
        (player.College ? ` College: ${player.College}` : '') +
        `\nIs this the correct player? Enter yes or no.`;


      const isMatch = FranchiseUtils.getYesOrNo(message);
      if (isMatch) return index;
      skippedPlayers.push(index);
    }
  }
  return -1;
}

module.exports = {
    getTeamRecordByFullName,
    getTeamRecordByIndex,
    searchForPlayer
};