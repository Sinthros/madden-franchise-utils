const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];

console.log("This program will move draft picks from any additional generated tables back into the main draft pick table.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: true,isAutoUnemptyEnabled: true});

franchise.on('ready', async function () {

  const alteredPicks = await FranchiseUtils.fixDraftPicks(franchise);

  if (alteredPicks) {
    console.log("Successfully altered draft picks.");
    await FranchiseUtils.saveFranchiseFile(franchise);
  }

  else {
    console.log("All picks were already in the main table. Your file has not been altered.");
  }

  FranchiseUtils.EXIT_PROGRAM();
});



