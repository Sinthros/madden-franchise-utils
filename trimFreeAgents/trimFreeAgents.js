const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const ZERO_REF = '00000000000000000000000000000000';


const MIN_EMPTY_PLAYERS = 500;

const gameYear = '24'

console.log("This program will delete the lowest free agent players from your file in order to ensure you have enough empty player table rows.");
console.log("You only need to use this if you're having an issue importing a custom Draft Class, due to a recent change EA made. Thanks, EA.");
console.log("If your Franchise File already has enough empty rows, then this program will tell you so and will exit.");
const autoUnempty = false;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);


async function removeFromTable(table, currentBin) {
  const numMembers = table.header.numMembers;
  const recordCapacity = table.header.recordCapacity;

  for (let i = 0; i < recordCapacity; i++) {
    let allBinary = []; // Moved inside the loop to reset for each record

    const currentRecord = table.records[i];

    for (let j = 0; j < numMembers; j++) {
      allBinary.push(currentRecord[`Player${j}`])
    }


    // Filter out the currentBin from allBinary
    allBinary = allBinary.filter((bin) => bin !== currentBin);

    while (allBinary.length < numMembers) {
      allBinary.push(ZERO_REF);
    }

    // Set the FA table binary = free agent binary
    allBinary.forEach((val, index) => {
      table.records[i].fieldsArray[index].value = val;
    });
  }
}

async function deleteExcessFreeAgents(playerTable, freeAgentsTable, drillCompletedTable, characterVisualsTable, playersToDelete) {

  const freeAgentNumMembers = freeAgentsTable.header.numMembers;
  const filteredRecords = playerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  const numFreeAgents = filteredRecords.filter(record => record.ContractStatus === 'FreeAgent') // Filter nonempty players for where they're free agents
  let allFreeAgentsBinary = [];
  const worstFreeAgentsBinary = [];

  numFreeAgents.forEach((freeAgentRecord) => {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord);
    const currentBin = getBinaryReferenceData(playerTable.header.tableId,rowIndex)
    allFreeAgentsBinary.push(currentBin)
    
  });
  
  const worstFreeAgents = numFreeAgents.sort((a, b) => a.OverallRating - b.OverallRating).slice(0, playersToDelete);  // Get the worst free agents up till the amount of extra players

  for (const freeAgentRecord of worstFreeAgents) {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord); 
    const currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);
    worstFreeAgentsBinary.push(currentBin);
    playerTable.records[rowIndex]['ContractStatus'] = 'Deleted'; // Mark as deleted and empty the row
    playerTable.records[rowIndex].empty();

    const characterVisualsRow = await FranchiseUtils.bin2Dec(playerTable.records[rowIndex].CharacterVisuals.slice(15));
    const visualsRecord = characterVisualsTable.records[characterVisualsRow];
    visualsRecord['RawData'] = {};
    visualsRecord.empty();

    await removeFromTable(drillCompletedTable,currentBin);
  }

  //Filter for where we aren't including the worstFreeAgentBin
  allFreeAgentsBinary = allFreeAgentsBinary.filter((bin) => !worstFreeAgentsBinary.includes(bin));

  while (allFreeAgentsBinary.length < freeAgentNumMembers) { //Fill up the remainder with zeroed out binary
    allFreeAgentsBinary.push(ZERO_REF)
  }

  //One liner to set the FA table binary = our free agent binary
  allFreeAgentsBinary.forEach((val, index) => { freeAgentsTable.records[0].fieldsArray[index].value = val; })
  //console.log(worstFreeAgents.length)
  
};


franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const freeAgentsTable = franchise.getTableByUniqueId(tables.freeAgentTable);
  const drillCompletedTable = franchise.getTableByUniqueId(tables.drillCompletedTable);
  const marketedPlayersArrayTable = franchise.getTableByUniqueId(tables.marketedPlayersArrayTableM24);
  const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
  await FranchiseUtils.readTableRecords([playerTable,freeAgentsTable,drillCompletedTable,marketedPlayersArrayTable,characterVisualsTable])

  const currentEmptyPlayers = playerTable.emptyRecords.size;
  const playersToDelete = MIN_EMPTY_PLAYERS - currentEmptyPlayers;

  if (currentEmptyPlayers >= MIN_EMPTY_PLAYERS) {
    console.log(`Your Franchise File already contains enough empty player rows. Your file has ${currentEmptyPlayers} empty rows.`);
    console.log("Enter anything to exit.");
    prompt();
    process.exit(0);

  }

  await deleteExcessFreeAgents(playerTable,freeAgentsTable, drillCompletedTable, characterVisualsTable, playersToDelete);

  // This prints out empty player table references. if you see refs from 6000 (Marketing table) it's fine
  for (let currentRow = 0; currentRow < playerTable.header.recordCapacity;currentRow++) {
    if (playerTable.records[currentRow].isEmpty)  {
      referencedRow = franchise.getReferencesToRecord(playerTable.header.tableId,currentRow)
  
      referencedRow.forEach((table) => {
        console.log(`${table.tableId}: ${table.name}: ${currentRow}`)
      })
    }
  }
  
  console.log(`Successfully deleted ${playersToDelete} player rows.`);
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit.")
  prompt();
});



