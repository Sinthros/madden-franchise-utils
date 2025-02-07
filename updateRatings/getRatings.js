const FranchiseUtils = require('../Utils/FranchiseUtils');
const fs = require("fs");

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];

console.log("This program will export player ratings into a json");

const franchise = FranchiseUtils.init(validGameYears, {customYearMessage: "Select the Madden version of your SOURCE Franchise file. Valid inputs are 24 and 25.", promptForBackup: false, isAutoUnemptyEnabled: false});

const TABLES = FranchiseUtils.getTablesObject(franchise);


franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(TABLES.playerTable);
  await FranchiseUtils.readTableRecords([playerTable]);
  const map = {}; // Use an object (dictionary) instead of an array
  
  const columns = FranchiseUtils.getColumnNames(playerTable);
  
  // Filter for columns with "Rating" in the name but not "Original", or includes "Grade"
  const filteredColumns = columns.filter(
    (column) => 
      ((column.includes("Rating") && 
        !column.includes("Original") && 
        column !== "RunningStyleRating" && 
        column !== "IsAGradePlayer") 
      || (column.includes("Grade") && column !== "IsAGradePlayer"))
  );  
  
  for (const record of playerTable.records) {
    if (!FranchiseUtils.isValidPlayer(record)) continue;
  
    const assetName = record.PLYR_ASSETNAME;
    map[assetName] = {};
  
    for (const col of filteredColumns) {
      map[assetName][col] = record[col]; // Assign values dynamically
    }
  }
  
  console.log("Successfully outputted player ratings");

  // Convert the map to JSON and write to file
  const jsonOutput = JSON.stringify(map, null, 2);
  fs.writeFileSync("output.json", jsonOutput, "utf8");

  console.log("JSON data successfully written to output.json");
  FranchiseUtils.EXIT_PROGRAM();
});



