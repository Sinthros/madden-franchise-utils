const FranchiseUtils = require("../Utils/FranchiseUtils");

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-league-binary.FTC file
const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

franchise.on("ready", async function () {
  const uiFormTable = franchise.getTableByUniqueId(1715);

  const binary = "10000000000000000011110111110000";

  const result = FranchiseUtils.resolveBinaryToTableRow(franchise, binary);
  process.exit(0)

  if (!result) {
    console.log("Binary not found in asset table");
  } else {
  }

  const table = franchise.getTableById(515);
  await FranchiseUtils.readTableRecords([table]);
  const tableArray = await FranchiseUtils.getTableDataAsArray(franchise, table);
  FranchiseUtils.convertArrayToJSONFile(tableArray, "515 - EnumTable.json");
});
