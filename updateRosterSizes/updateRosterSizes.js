const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24
];

console.log("This program will calculate all roster sizes for all teams.");
const gameYear = FranchiseUtils.getGameYear(validGameYears);
const autoUnempty = false;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);



franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([playerTable,teamTable]);

  await FranchiseUtils.recalculateRosterSizes(playerTable,teamTable);
  
  console.log("Roster sizes have been set successfully.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



