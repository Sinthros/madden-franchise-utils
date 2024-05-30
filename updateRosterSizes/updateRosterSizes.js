const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

const validGameYears = ['22','23','24'];

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
  console.log("Program completed. Enter anything to exit.");
  prompt();
});



