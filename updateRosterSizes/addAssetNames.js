const FranchiseUtils = require("../Utils/FranchiseUtils");

const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
  FranchiseUtils.YEARS.M26,
];

console.log("This program will generate asset names for all players who don't currently have one.");

const franchise = FranchiseUtils.init(validGameYears, { promptForBackup: true });

async function addAssetNames(franchise, appendIndex = true) {
  const tables = FranchiseUtils.getTablesObject(franchise);
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await playerTable.readRecords();

  const MAX_LEN = 41;

  for (const record of playerTable.records) {
    if (FranchiseUtils.isValidDraftPlayer(record)) {
      record.PLYR_ASSETNAME = "";

      if (FranchiseUtils.isBlank(record.PLYR_ASSETNAME) || record.PLYR_ASSETNAME === "0") {
        const formattedName = FranchiseUtils.removeSuffixes(`${record.LastName}${record.FirstName}`).replace(
          /\s+/g,
          "",
        );

        let generatedAsset = `${formattedName}_${record.PresentationId}`;
        if (appendIndex) generatedAsset += `_${record.index}`;

        if (generatedAsset.length > MAX_LEN) {
          console.warn(
            `Asset name exceeded ${MAX_LEN} chars (${generatedAsset.length}). Truncating: ${generatedAsset}`,
          );
          generatedAsset = generatedAsset.substring(0, MAX_LEN);
        }

        record.PLYR_ASSETNAME = generatedAsset;
      }
    }
  }
}

franchise.on("ready", async function () {
  await addAssetNames(franchise);

  console.log("Assets generated successfully.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
