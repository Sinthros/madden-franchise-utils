const FranchiseUtils = require("../Utils/FranchiseUtils");

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-league-binary.FTC file
const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

franchise.on("ready", async function () {
  const uiFormTable = franchise.getTableById(609);

  await FranchiseUtils.readTableRecords([uiFormTable]);
  const tableArray = await FranchiseUtils.getTableDataAsArray(franchise, uiFormTable);
  FranchiseUtils.convertArrayToJSONFile(tableArray, "UISelectForm.json");
});
