const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];

console.log("This program will regenerate the resign table in your franchise file.");

const franchise = FranchiseUtils.init(validGameYears);

franchise.on('ready', async function () {

  await FranchiseUtils.regenerateResignTables(franchise);
  
  console.log("Regenerated resign tables.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



