const FranchiseUtils = require('../Utils/FranchiseUtils');
const fs = require("fs");
const JSON_LOOKUP = JSON.parse(fs.readFileSync("output.json", "utf8"));


const validGameYears = [
  FranchiseUtils.YEARS.M25,
];

console.log("This program will revert regression in your Madden 25 Start Today file. You must run this before the 2025 PreSeason.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: true, isAutoUnemptyEnabled: false});

const TABLES = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(TABLES.playerTable);
  const seasonInfoTable = franchise.getTableByUniqueId(TABLES.seasonInfoTable);
  await FranchiseUtils.readTableRecords([playerTable, seasonInfoTable]);

  const currentYear = seasonInfoTable.records[0].CurrentSeasonYear;

  if (currentYear >= 2025) {
    console.log("This franchise file is past the 2024 Offseason. Changes have not been applied.");
    FranchiseUtils.EXIT_PROGRAM();
  }
  
  const columns = new Set(FranchiseUtils.getColumnNames(playerTable)); // Use Set for faster lookups

  // Create a Map for fast player lookup
  const playerMap = new Map(
    playerTable.records
      .filter(record => 
        FranchiseUtils.isValidPlayer(record, { includeRetiredPlayers: true }) &&
        !FranchiseUtils.isBlank(record.PLYR_ASSETNAME)
      )
      .map(record => [record.PLYR_ASSETNAME, record]) // Map assetName to playerRecord
  );
  
  // Iterate through JSON_LOOKUP and update records
  for (const [assetName, playerData] of Object.entries(JSON_LOOKUP)) {
    const playerRecord = playerMap.get(assetName); // O(1) lookup
    if (!playerRecord) continue;
  
    for (const [column, value] of Object.entries(playerData)) {
      if (columns.has(column)) { // O(1) lookup instead of .includes()
        playerRecord[column] = value;
      }
    }
  }
  
  console.log("Successfully reverted regression.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



