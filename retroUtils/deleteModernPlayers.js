const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../Utils/FranchiseUtils");

const SOURCE_VALID_YEARS = [FranchiseUtils.YEARS.M26];
const TARGET_VALID_YEARS = [FranchiseUtils.YEARS.M26];

console.log("This program will delete players that exist in a second selected file (upon confirmation).");

const sourceFranchise = FranchiseUtils.init(SOURCE_VALID_YEARS, {
  customFranchiseMessage:
    "Please enter the name of your source Madden 26 franchise file (the one you want to delete players from)",
  promptForBackup: true,
  isAutoUnemptyEnabled: true,
});
const targetFranchise = FranchiseUtils.init(TARGET_VALID_YEARS, {
  customFranchiseMessage: "Please enter the name of your target Madden 26 franchise file (used as a lookup).",
  promptForBackup: false,
  isAutoUnemptyEnabled: false,
});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

sourceFranchise.on("ready", async function () {
  targetFranchise.on("ready", async function () {
    const sourcePlayerTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
    const targetPlayerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);

    await FranchiseUtils.readTableRecords([sourcePlayerTable], false, sourceFranchise);
    await FranchiseUtils.readTableRecords([targetPlayerTable], false, targetFranchise);

    for (const record of sourcePlayerTable.records) {
      if (!FranchiseUtils.isValidPlayer(record, { includeRetiredPlayers: true, includeDeletedPlayers: true })) continue;
      const fullName = FranchiseUtils.getNormalizedName(record);
      const matchingTargets = targetPlayerTable.records.filter((targetRecord) => {
        return FranchiseUtils.getNormalizedName(targetRecord) === fullName;
      });
      if (matchingTargets.length > 0) {
        const college = await FranchiseUtils.getCollege(sourceFranchise, record.College);
        const message = `Player ${record.FirstName} ${record.LastName}'s name exists in the target file. Do you want to delete him? \n Age: ${record.Age} Position: ${record.Position} Asset: ${record.PLYR_ASSETNAME} College: ${college}`;
        const deletePlayer = FranchiseUtils.getYesOrNo(message, true);
        if (deletePlayer) {
          const currentBinary = getBinaryReferenceData(sourcePlayerTable.header.tableId, record.index);
          await FranchiseUtils.deletePlayer(sourceFranchise, currentBinary);
        }
      }
    }
    console.log("\nSuccessfully deleted players");
    

    await FranchiseUtils.saveFranchiseFile(sourceFranchise);
    FranchiseUtils.EXIT_PROGRAM();
  });
});
