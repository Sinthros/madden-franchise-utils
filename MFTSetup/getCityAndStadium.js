const FranchiseUtils = require("../Utils/FranchiseUtils");

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-tuning-binary.FTC file
const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

franchise.on("ready", async function () {
  const stadiumTable = franchise.getTableByUniqueId(2401887796);
  const cityTable = franchise.getTableByUniqueId(429125313);

  await FranchiseUtils.readTableRecords([stadiumTable, cityTable]);
  const stadiumArray = await FranchiseUtils.getTableDataAsArray(franchise, stadiumTable, {
    includeRow: true,
    includeAssetId: false,
    includeBinary: true,
    convertRefToRowNo: true,
  });

  const cityArray = await FranchiseUtils.getTableDataAsArray(franchise, cityTable, {
    includeRow: true,
    includeAssetId: false,
    includeBinary: true,
    convertRefToRowNo: true,
  });

  FranchiseUtils.convertArrayToJSONFile(stadiumArray, "Stadium.json");
  FranchiseUtils.convertArrayToJSONFile(cityArray, "City.json");
});
