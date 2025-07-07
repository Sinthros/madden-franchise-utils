const FranchiseUtils = require('../Utils/FranchiseUtils');
const stringSimilarity = require('string-similarity');
const prompt = require('prompt-sync')();


function getTeamRecordByFullName(teamName, teamTable) {
  if (FranchiseUtils.isBlank(teamName)) return null;
  const teamRecord = teamTable.records.find(
    record => !record.isEmpty &&
    `${record.LongName} ${record.DisplayName}` === teamName && record.TEAM_VISIBLE && !FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName)
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
    record.TeamIndex === teamIndex && record.TEAM_VISIBLE && !FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName)
  );

  if (!teamRecord) {
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
 * @param {Array} [skippedPlayers=[]] - Array of record indices to skip (already rejected).
 * @param {string|null} [teamName=null] - Team name to confirm against for extra validation.
 * @param {boolean} [rookiesOnly=false] - If true, restrict search to players with 0 years pro.
 * @param {string|null} [url=null] - Optional URL context for logging or debugging (e.g. ESPN/Ourlads).
 * @returns {Promise<number>} The index of the matched player in the player table, or -1.
 */
async function searchForPlayer(franchise, tables, playerName, matchValue = 0.5, skippedPlayers = [], teamName = null, rookiesOnly = false, url = null) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([playerTable, teamTable]);

  const normalizedPlayerName = FranchiseUtils.getNormalizedName(playerName);

  // Get list of player table records which are valid, haven't been processed yet, and are rookies (if applicable)
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

    const match = normalizedPlayerName === finalMaddenName && teamName === playerTeamName;
    const faMatch = false; // Placeholder for additional criteria like college, age, etc.

    if (match || faMatch) {
      return index;
    } else {
      const message =
        `Name: ${normalizedPlayerName}. Team: ${teamName}. URL: ${url}.\n` +
        `Madden: ${finalMaddenName}, ${player.Age}, ${player.Position} for the ${playerTeamName}. ` +
        `${player.YearsPro} years of experience.`;

      const isMatch = await getYesOrNo(message);
      if (isMatch) return index;
      skippedPlayers.push(index);
    }
  }
  return -1;
}
