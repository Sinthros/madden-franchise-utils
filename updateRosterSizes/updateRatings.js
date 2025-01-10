const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program will update player ratings from one franchise file into another.");

const sourceFranchise = FranchiseUtils.init(validGameYears, {customYearMessage: "Select the Madden version of your SOURCE Franchise file. Valid inputs are 24 and 25.", promptForBackup: false, isAutoUnemptyEnabled: false});
const targetFranchise = FranchiseUtils.init(validGameYears, {customYearMessage: "Select the Madden version of your TARGET Franchise file. Valid inputs are 24 and 25.", customFranchiseMessage: "Please enter the name of your target franchise file (such as CAREER-BEARS).", promptForBackup: true, isAutoUnemptyEnabled: false});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);


sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    const sourcePlayer = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
    const targetPlayer = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
    await FranchiseUtils.readTableRecords([sourcePlayer,targetPlayer]);

    const sourceColumns = FranchiseUtils.getColumnNames(sourcePlayer);
    const columns = FranchiseUtils.getColumnNames(targetPlayer);

    // Filter for columns with "Rating" in the name but not "Original"
    const filteredColumns = columns.filter(
      (column) => (column.includes("Rating") && !column.includes("Original")) || column.includes("Grade") 
    );

    for (const record of targetPlayer.records) {
      if (!FranchiseUtils.isValidPlayer(record)) continue;
    
      const assetName = record.PLYR_ASSETNAME;
    
      // Find the matching source record by PLYR_ASSETNAME
      const sourceRecord = sourcePlayer.records.find(
        (srcRecord) => srcRecord.PLYR_ASSETNAME === assetName
      );
    
      if (sourceRecord) {
        for (const col of filteredColumns) {
          if (sourceColumns.includes(col)) {
            record[col] = sourceRecord[col];
          }
        }
        const {newOverall, newArchetype} = FranchiseUtils.calculateBestOverall(record);
        record.PlayerType = newArchetype;
        record.OverallRating = newOverall;
      } else {
        console.log(`Couldn't find matching player for ${assetName}`);
      }
    }
    
    console.log("Successfully transfered player ratings");

    await FranchiseUtils.saveFranchiseFile(targetFranchise);
    FranchiseUtils.EXIT_PROGRAM();
})});



