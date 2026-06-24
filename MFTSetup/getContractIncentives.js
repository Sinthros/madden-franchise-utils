const FranchiseUtils = require("../Utils/FranchiseUtils");
const Franchise = require("madden-franchise").FranchiseFile;

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-tuning-binary.FTC file
//const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });
const franchise = new Franchise("C:\\Users\\noahj\\Downloads\\franchise-tuning-binary (2).FTC", {
  schemaOverride: { gameYear: "27", major: "525", minor: "0", path: "C:\\Users\\noahj\\Downloads\\M27_525_0.gz" },
});

franchise.on("ready", async function () {
  const contractIncentiveTable = franchise.getTableById(735);

  await FranchiseUtils.readTableRecords([contractIncentiveTable]);
  const tableArray = await FranchiseUtils.getTableDataAsArray(franchise, contractIncentiveTable);
  FranchiseUtils.convertArrayToJSONFile(tableArray, "ContractIncentive.json");
});
