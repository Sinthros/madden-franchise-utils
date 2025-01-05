const FranchiseUtils = require('../Utils/FranchiseUtils');
const fs = require("fs");
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const LOOKUP_FILE = JSON.parse(fs.readFileSync("team_stats.json", 'utf8'));

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];


console.log("This program will recalculate all team stats based on an input file you provide.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: true, isAutoUnemptyEnabled: true});
const tables = FranchiseUtils.getTablesObject(franchise);

async function getStatsRefRecord(teamRecord) {
  const { row, tableId } = FranchiseUtils.getRowAndTableIdFromRef(teamRecord.TeamSeasonStats);
  const statsArray = franchise.getTableById(tableId);
  await statsArray.readRecords();

  return statsArray.records[row];
}

franchise.on('ready', async function () {
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await teamTable.readRecords();

  for (const record of teamTable.records) {
    if (record.isEmpty && !record.TEAM_VISIBLE) continue;

    const fullName = `${record.LongName} ${record.DisplayName}`;

    const teamStats =  LOOKUP_FILE[fullName];

    if (!teamStats) {
        console.log(`Couldn't find stats for ${fullName}`);
        continue;
    }

    // In real life sack yards take away from pass yards, but not in Madden
    teamStats["OFFPASSYARDS"] = teamStats["OFFPASSYARDS"] + teamStats["OFFSACKYARDS"];
    teamStats["DEFPASSYARDS"] = teamStats["DEFPASSYARDS"] + teamStats["DEFSACKYARDS"];

    teamStats["TOTALYARDS"] = teamStats["OFFYARDS"] + teamStats["KICKRETURNYARDS"] + teamStats["PUNTRETURNYARDS"];

    record.SeasonLeagPointsFor = teamStats.SeasonLeagPointsFor;
    record.SeasonLeagPointsAgainst = teamStats.SeasonLeagPointsAgainst;

    const statsRefRecord = await getStatsRefRecord(record);

    const { row, tableId } = FranchiseUtils.getRowAndTableIdFromRef(statsRefRecord.TeamStats0);

    const statsTable = franchise.getTableById(tableId);
    await statsTable.readRecords();
    
    const statRecord = statsTable.records[row];
    const columns = FranchiseUtils.getColumnNames(statRecord);

    for (const [key, value] of Object.entries(teamStats)) {
        if (!columns.includes(key)) continue;

        statRecord[key] = value;
    }
  }


  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



