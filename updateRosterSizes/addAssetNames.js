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

franchise.on("ready", async function () {
  await FranchiseUtils.addAssetNames(franchise);

  console.log("Assets generated successfully.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
