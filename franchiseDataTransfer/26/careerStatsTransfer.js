const { getBinaryReferenceData } = require("madden-franchise").utilService;

/*const ALL_ASSET_NAMES = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "lookupFiles/careerStatsLookups/all_asset_names.json"),
    "utf-8"
  )
);*/
const FranchiseUtils = require("../../Utils/FranchiseUtils");

const SOURCE_VALID_YEARS = [FranchiseUtils.YEARS.M25, FranchiseUtils.YEARS.M26];
const TARGET_VALID_YEARS = [FranchiseUtils.YEARS.M26];

console.log(
  "In this program, you can transfer Career Stats from your Madden 25 Franchise to Madden 26 (Or Madden 26 to another Madden 26 Franchise File)"
);
console.log(
  "Your SOURCE franchise file will have the data you want to transfer. Your TARGET franchise file is the one you'll be transferring the data to."
);

const sourceFranchise = FranchiseUtils.init(SOURCE_VALID_YEARS, {
  customYearMessage: "Select the Madden version of your SOURCE Franchise file. Valid inputs are 25 and 26.",
  promptForBackup: false,
  isAutoUnemptyEnabled: false,
});
const targetFranchise = FranchiseUtils.init(TARGET_VALID_YEARS, {
  customFranchiseMessage: "Please enter the name of your Madden 26 franchise file (such as CAREER-BEARS).",
  promptForBackup: true,
  isAutoUnemptyEnabled: true,
});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

sourceFranchise.on("ready", async function () {
  targetFranchise.on("ready", async function () {
    const sourceGameYear = sourceFranchise.schema.meta.gameYear;
    const targetGameYear = targetFranchise.schema.meta.gameYear;

    is25To26 = sourceGameYear === FranchiseUtils.YEARS.M25 && targetGameYear === FranchiseUtils.YEARS.M26;
    const sourcePlayerTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
    const targetPlayerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);

    const targetStatTables = [
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOffKPReturnStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOffStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOLineStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerDefStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerKickingStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerDefKPReturnStatsTable),
    ];

    const allSourceTables = [
      sourcePlayerTable,
      sourceFranchise.getTableByUniqueId(SOURCE_TABLES.careerOffKPReturnStatsTable),
      sourceFranchise.getTableByUniqueId(SOURCE_TABLES.careerOffStatsTable),
      sourceFranchise.getTableByUniqueId(SOURCE_TABLES.careerOLineStatsTable),
      sourceFranchise.getTableByUniqueId(SOURCE_TABLES.careerDefStatsTable),
      sourceFranchise.getTableByUniqueId(SOURCE_TABLES.careerKickingStatsTable),
      sourceFranchise.getTableByUniqueId(SOURCE_TABLES.careerDefKPReturnStatsTable),
    ];

    const allTargetTables = [
      targetPlayerTable,
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOffKPReturnStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOffStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOLineStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerDefStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerKickingStatsTable),
      targetFranchise.getTableByUniqueId(TARGET_TABLES.careerDefKPReturnStatsTable),
    ];

    await FranchiseUtils.readTableRecords(allSourceTables, false, sourceFranchise);
    await FranchiseUtils.readTableRecords(allTargetTables, false, targetFranchise);

    // Empty all target career stat tables
    for (const table of targetStatTables) {
      FranchiseUtils.emptyTable(table);
    }

    // Clear all player CareerStat refs
    for (const record of FranchiseUtils.getActiveRecords(targetPlayerTable)) {
      record.CareerStats = FranchiseUtils.ZERO_REF;
    }

    for (const record of FranchiseUtils.getActiveRecords(sourcePlayerTable)) {
      const careerStatsRef = record.CareerStats;
      // If we have no career stats, we don't care
      if (careerStatsRef === FranchiseUtils.ZERO_REF) continue;

      const asset = record.PLYR_ASSETNAME;
      let matchingRecord = FranchiseUtils.getActiveRecords(targetPlayerTable).find(
        (player) => player.PLYR_ASSETNAME === asset
      );

      if (matchingRecord) {
        const { row, tableId } = FranchiseUtils.getRowAndTableIdFromRef(careerStatsRef);
        const statTable = sourceFranchise.getTableById(tableId);
        await statTable.readRecords();
        const statRecord = statTable.records[row];
        const tableName = statTable.header.name;

        if (statRecord) {
          const targetStatTable = targetFranchise.getTableByName(tableName);
          const targetStatRecord = FranchiseUtils.addRecordToTable(statRecord, targetStatTable);
          if (targetStatRecord) {
            matchingRecord.CareerStats = getBinaryReferenceData(targetStatTable.header.tableId, targetStatRecord.index);
          }
        }
      }
    }
    console.log("\nSuccessfully completed transfer of data.");

    await FranchiseUtils.saveFranchiseFile(targetFranchise);
    FranchiseUtils.EXIT_PROGRAM();
  });
});
