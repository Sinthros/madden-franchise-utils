const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const FranchiseUtils = require('../Utils/FranchiseUtils');

const BROWNS_TEAM_INDEX = 5;
const BROWNS_DEACTIVATION_YEAR = 1996;
const BROWNS_RESTART_YEAR = 1999;

const TEAM_DEBUT_YEARS = {
  '0': 1946,
  '1': 1920,
  '2': 1968,
  '3': 1970,
  '4': 1960,
  '5': 1946, // Browns
  '6': 1976,
  '7': 1920,
  '10': 1960,
  '11': 1960,
  '12': 1953,
  '13': 1932,
  '14': 1960,
  '15': 1966,
  '16': 1933,
  '17': 1966,
  '19': 1925,
  '21': 1995,
  '22': 1960,
  '23': 1930,
  '25': 1921,
  '26': 1995,
  '27': 1960,
  '28': 1960,
  '29': 1937,
  '30': 1996,
  '31': 1967,
  '32': 1976,
  '33': 1933,
  '34': 2002, // Texans
  '35': 1960,
  '36': 1961
}

const DRAFT_LENGTH = 223;
const PICKS_PER_ROUND = 32;

const validGameYears = [
  FranchiseUtils.YEARS.M25
];

console.log("This program will adjust draft picks for retro franchise files. This program MUST be run in the Offseason.");
console.log("Depending on the year of your franchise, inactive teams will have their draft picks pushed to the end of the 7th round.");

const franchise = FranchiseUtils.init(validGameYears, {isAutoUnemptyEnabled: true});
const tables = FranchiseUtils.getTablesObject(franchise);

// If it's the browns and it's between 1996 and 1998, they're inactive
function isSpecialBrownsCase(record, seasonYear) {
  return (
    record.index === BROWNS_TEAM_INDEX &&
    seasonYear >= BROWNS_DEACTIVATION_YEAR &&
    seasonYear < BROWNS_RESTART_YEAR
  );
}

franchise.on('ready', async function () {

  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const draftPickTable = franchise.getTableByUniqueId(tables.draftPickTable);
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
  await FranchiseUtils.readTableRecords([teamTable,draftPickTable,seasonInfoTable]);

  const seasonYear = seasonInfoTable.records[0].CurrentSeasonYear;
  const currentStage = seasonInfoTable.records[0].CurrentStage;

  if (currentStage !== FranchiseUtils.SEASON_STAGES.OFFSEASON) {
    console.error(`This program must be run in the Offseason. Your file is in the ${currentStage}.`);
    FranchiseUtils.EXIT_PROGRAM();
  }

  // Fix draft pick references if necessary
  if (franchise.schema.meta.gameYear >= 25) await FranchiseUtils.fixDraftPicks(franchise); 

  let inactiveTeamBinary = [];

  teamTable.records // Get valid teams and check their active years by the row number. This is better to do than by team name as that can change
  .filter(record => !record.isEmpty && !FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName) && record.TEAM_VISIBLE)
  .forEach(record => {
    
    if (TEAM_DEBUT_YEARS.hasOwnProperty(record.index)) {
      const debutYear = TEAM_DEBUT_YEARS[record.index];
      
      // Check if the debut year is before the SEASON_YEAR
      if (debutYear > seasonYear || isSpecialBrownsCase(record,seasonYear)) {
        console.log(`The ${record.LongName} ${record.DisplayName} are inactive and will have their picks pushed to the end of the draft.`);
        inactiveTeamBinary.push(getBinaryReferenceData(teamTable.header.tableId,record.index));
      }
    }
  });

  if (inactiveTeamBinary.length === 0 ) { // If no inactive teams, exit
    console.log("No inactive teams to handle.");
    FranchiseUtils.EXIT_PROGRAM();
  }

  // We need to store active and inactive picks separately to start
  const activeDraftPicks = [];
  const inactiveDraftPicks = [];

  for (const record of draftPickTable.records) {
    // Skip picks not from this year
    if (record.isEmpty || record.YearOffset !== 0) continue;

    if (!inactiveTeamBinary.includes(record.OriginalTeam)) { // Put picks into their respective lists depending on if the team is active
      activeDraftPicks.push(record);
    } else {
      inactiveDraftPicks.push(record);
    }
  }

  // Sort active picks by Round and PickNumber
  activeDraftPicks.sort((a, b) => {
    if (a.Round !== b.Round) return a.Round - b.Round;
    return a.PickNumber - b.PickNumber;
  });

  // Set up the combined array of active and inactive picks
  const allDraftPicks = [...activeDraftPicks, ...inactiveDraftPicks];

  // Initialize counters for pick assignments
  let overallPick = 0; // From 0 to 223, this is what actually gets set
  let roundPick = 0; // Use this to determine when to increment currentRound
  let currentRound = 0; // Use to set record.Round

  // Iterate over all draft picks and assign Round and PickNumber
  for (const record of allDraftPicks) {
    if (roundPick >= PICKS_PER_ROUND) {
      roundPick = 0;
      currentRound++;
    }

    record.Round = currentRound;
    record.PickNumber = overallPick;

    roundPick++;
    overallPick++;

    if (overallPick >= DRAFT_LENGTH) break;
  }

  console.log("Adjusted draft picks successfully.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



