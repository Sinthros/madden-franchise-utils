const FranchiseUtils = require('../Utils/FranchiseUtils');
const { tables } = require('../Utils/FranchiseTableId');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');

const MIN_EMPTY_PLAYERS = 650;

const validGameYears = [FranchiseUtils.YEARS.M24,FranchiseUtils.YEARS.M25];

console.log("This program will delete the lowest rated free agent players from your file in order to ensure you have enough empty player table rows.");
console.log("You only need to use this if you're having an issue importing a custom Draft Class, due to a recent change EA made. Thanks, EA.");
console.log("If your Franchise File already has enough empty rows, then this program will tell you so and will exit.");

const franchise = FranchiseUtils.init(validGameYears,{promptForBackup: true})



franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await playerTable.readRecords();

  const currentEmptyPlayers = playerTable.emptyRecords.size;
  const playersToDelete = MIN_EMPTY_PLAYERS - currentEmptyPlayers;
    // This prints out empty player table references. if you see refs from 6000 (Marketing table) it's fine
  /*for (let currentRow = 0; currentRow < playerTable.header.recordCapacity;currentRow++) {
    if (playerTable.records[currentRow].isEmpty)  {
      referencedRow = franchise.getReferencesToRecord(playerTable.header.tableId,currentRow)
  
      referencedRow.forEach((table) => {
        //console.log(`${table.tableId}: ${table.name}: ${currentRow}`)
      })
    }
  }*/

  if (currentEmptyPlayers >= MIN_EMPTY_PLAYERS) {
    console.log(`Your Franchise File already contains enough empty player rows. Your file has ${currentEmptyPlayers} empty rows.`);
    FranchiseUtils.EXIT_PROGRAM();
  }

  await FranchiseUtils.deleteExcessFreeAgents(franchise, {numPlayersToDelete: playersToDelete});

  await FranchiseUtils.emptyAcquisitionTables(franchise);
  await FranchiseUtils.emptyHistoryTables(franchise,tables);
  
  console.log(`Successfully deleted ${playersToDelete} free agent player rows.`);
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



