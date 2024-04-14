const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const ZERO_REF = '00000000000000000000000000000000';


const MIN_EMPTY_PLAYERS = 550;

const gameYear = '24'

console.log("This program will delete the lowest rated free agent players from your file in order to ensure you have enough empty player table rows.");
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

async function removeFromFATable(table, row) {
  const recordLength = table.records[0].fieldsArray.filter(field => field.referenceData.tableId != 0).length;
  const currentPerson = table.records[0].fieldsArray.find(field => field.referenceData.rowNumber == row);
  const lastPerson = table.records[0].fieldsArray[recordLength - 1];

  if (currentPerson) {
      if (currentPerson.value == lastPerson.value) {
          table.records[0][currentPerson.key] = ZERO_REF;
      } else {
          table.records[0][currentPerson.key] = table.records[0][lastPerson.key];
          table.records[0][lastPerson.key] = ZERO_REF;
      }
  }
}

async function emptyHistoryTables(franchise) {
  const historyEntryArray = franchise.getTableByUniqueId(1765841029);
  const transactionHistoryArray = franchise.getTableByUniqueId(766279362);
  const transactionHistoryEntry = franchise.getTableByUniqueId(2590627814)
  await historyEntryArray.readRecords();
  await transactionHistoryArray.readRecords();
  await transactionHistoryEntry.readRecords();


  for (let i = 0; i < historyEntryArray.header.recordCapacity;i++) {
    if (!historyEntryArray.records[i].isEmpty) {
        for (let j = 0; j < historyEntryArray.header.numMembers;j++) {
          historyEntryArray.records[i][`HistoryEntry${j}`] = ZERO_REF;

        }
      }
   }

   for (let i = 0; i < transactionHistoryArray.header.recordCapacity;i++) {
    if (!transactionHistoryArray.records[i].isEmpty) {
        for (let j = 0; j < transactionHistoryArray.header.numMembers;j++) {
          transactionHistoryArray.records[i][`TransactionHistoryEntry${j}`] = ZERO_REF;

        }
      }
   }

   for (let i = 0; i < transactionHistoryEntry.header.recordCapacity;i++) {
    if (!transactionHistoryEntry.records[i].isEmpty) {
      const record = transactionHistoryEntry.records[i];
      record.OldTeam = ZERO_REF;
      record.NewTeam = ZERO_REF;
      record.SeasonYear = 0;
      record.TransactionId = 0;
      record.SeasonStage = 'PreSeason';
      record.ContractStatus = 'Drafted';
      record.OldContractStatus = 'Drafted';
      record.SeasonWeek = 0;
      record.FifthYearOptionCapHit = 0;
      record.ContractLength = 0;
      record.ContractTotalSalary = 0;
      record.CapSavingsThisYear = 0;
      record.ContractBonus = 0;
      record.ContractSalary = 0;
      await record.empty();
    }
   }
};


async function getCharacterVisualsTable(franchise,currentTable,mainCharacterVisualsTable,row) {
  let characterVisualsRef = currentTable.records[row]['CharacterVisuals'];
  let characterVisualsRow = -1;
  let characterVisualsTableId;
  const visualsRecordCapcity = mainCharacterVisualsTable.header.recordCapacity;
  let currentCharacterVisualsTable;
  
  if (characterVisualsRef === ZERO_REF) { // If it's all zeroes, return
    return {currentCharacterVisualsTable, characterVisualsRow, characterVisualsTableId }
  }
  else { //Else, simply convert the binary ref to the row number value
    characterVisualsRow = await FranchiseUtils.bin2Dec(characterVisualsRef.slice(15));
    // Dynamically get the table ID for CharacterVisuals
    // This is required because if there's too many players/coaches, the game generates more Visuals tables
    // So instead of always calling the main one, we instead dynamically get the table ID through the binary.
    characterVisualsTableId = await FranchiseUtils.bin2Dec(characterVisualsRef.slice(0,15));
    currentCharacterVisualsTable = franchise.getTableById(characterVisualsTableId);
  }

  return {currentCharacterVisualsTable, characterVisualsRow, characterVisualsTableId };

}

async function deleteExcessFreeAgents(franchise, playersToDelete) {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const freeAgentsTable = franchise.getTableByUniqueId(tables.freeAgentTable);
  const drillCompletedTable = franchise.getTableByUniqueId(tables.drillCompletedTable);
  const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
  await FranchiseUtils.readTableRecords([freeAgentsTable,drillCompletedTable,characterVisualsTable])

  const freeAgentNumMembers = freeAgentsTable.header.numMembers;
  const filteredRecords = playerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  const numFreeAgents = filteredRecords.filter(record => record.ContractStatus === 'FreeAgent') // Filter nonempty players for where they're free agents
  let allFreeAgentsBinary = [];
  //const worstFreeAgentsBinary = [];

  numFreeAgents.forEach((freeAgentRecord) => {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord);
    const currentBin = getBinaryReferenceData(playerTable.header.tableId,rowIndex)
    allFreeAgentsBinary.push(currentBin)
    
  });
  
  const worstFreeAgents = numFreeAgents.sort((a, b) => a.OverallRating - b.OverallRating).slice(0, playersToDelete);  // Get the worst free agents up till the amount of playersToDelete

  for (const freeAgentRecord of worstFreeAgents) {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord); 
  
    const currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);
    //worstFreeAgentsBinary.push(currentBin);
    const {currentCharacterVisualsTable, characterVisualsRow, characterVisualsTableId} = await getCharacterVisualsTable(franchise, playerTable, characterVisualsTable, rowIndex);
    if (characterVisualsRow !== -1) { // If we returned a valid row...
      if (characterVisualsTableId !== characterVisualsTable.header.tableId) { // Read the table if it isn't the main table
        await currentCharacterVisualsTable.readRecords();
      }
      // Then, get the record for the player and empty it
      const visualsRecord = currentCharacterVisualsTable.records[characterVisualsRow];
      visualsRecord['RawData'] = {};
      visualsRecord.empty();
    }

    
    playerTable.records[rowIndex]['ContractStatus'] = 'Deleted'; // Mark as deleted and empty the row
    playerTable.records[rowIndex].CareerStats = ZERO_REF; // If we don't zero these out the game will crash
    playerTable.records[rowIndex].SeasonStats = ZERO_REF;
    playerTable.records[rowIndex].GameStats = ZERO_REF;
    playerTable.records[rowIndex].CharacterVisuals = ZERO_REF;
    playerTable.records[rowIndex].College = ZERO_REF;
    playerTable.records[rowIndex].PLYR_ASSETNAME = ""; // Don't know if this is needed, but doesn't hurt
    playerTable.records[rowIndex].empty();

    

    await removeFromFATable(freeAgentsTable,rowIndex)
    await removeFromTable(drillCompletedTable,currentBin);
  }
};

async function emptyAcquisitionTables(franchise) {
  const playerAcquisitionEvaluation = franchise.getTableByUniqueId(2531183555);
  const playerAcquisitionEvaluationArray = franchise.getTableByUniqueId(498911520);

  await playerAcquisitionEvaluation.readRecords();
  await playerAcquisitionEvaluationArray.readRecords();

  for (let i = 0; i < playerAcquisitionEvaluation.header.recordCapacity; i++) {
    if (playerAcquisitionEvaluation.records[i].isEmpty) {
      continue;
    }

    const record = playerAcquisitionEvaluation.records[i];
    record['Player'] = ZERO_REF;
    record['isPlayerSuperstar'] = false;
    record['isPlayerXFactor'] = false;
    record['AddedValue'] = 0;
    record['DevelopmentValue'] = 0;
    record['Value'] = 0;
    record['FreeAgentComparisonValue'] = 0;
    record['ImportanceValue'] = 0;
    record['TeamSchemeOverallValue'] = 0;
    record['TeamTradePhilosophyValue'] = 0;
    record['AcquisitionType'] = 'Signed';
    record['Rank'] = 0;
    record['BestSchemeOverallValue'] = 0;
    record['CoachTradeInfluenceValue'] = 0;
    record['ContractValue'] = 0;
    record['IsPlayerHidden'] = false;
    
    await record.empty();
  }

  for (let i = 0; i < playerAcquisitionEvaluationArray.header.recordCapacity; i++) {
    if (playerAcquisitionEvaluationArray.records[i].isEmpty) {
      continue;
    }

    const recordArray = playerAcquisitionEvaluationArray.records[i];
    for (let j = 0; j < 10; j++) {
      recordArray[`PlayerAcquisitionEvaluation${j}`] = ZERO_REF;
    }
  }
}


franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await playerTable.readRecords();

  const currentEmptyPlayers = playerTable.emptyRecords.size;
  const playersToDelete = MIN_EMPTY_PLAYERS - currentEmptyPlayers;
    // This prints out empty player table references. if you see refs from 6000 (Marketing table) it's fine
  for (let currentRow = 0; currentRow < playerTable.header.recordCapacity;currentRow++) {
    if (playerTable.records[currentRow].isEmpty)  {
      referencedRow = franchise.getReferencesToRecord(playerTable.header.tableId,currentRow)
  
      referencedRow.forEach((table) => {
        //console.log(`${table.tableId}: ${table.name}: ${currentRow}`)
      })
    }
  }

  if (currentEmptyPlayers >= MIN_EMPTY_PLAYERS) {
    console.log(`Your Franchise File already contains enough empty player rows. Your file has ${currentEmptyPlayers} empty rows.`);
    console.log("Enter anything to exit.");
    prompt();
    process.exit(0);

  }

  await deleteExcessFreeAgents(franchise, playersToDelete);

  // This prints out empty player table references. if you see refs from 6000 (Marketing table) it's fine
  /*for (let currentRow = 0; currentRow < playerTable.header.recordCapacity;currentRow++) {
    if (playerTable.records[currentRow].isEmpty)  {
      referencedRow = franchise.getReferencesToRecord(playerTable.header.tableId,currentRow)
  
      referencedRow.forEach((table) => {
        console.log(`${table.tableId}: ${table.name}: ${currentRow}`)
      })
    }
  }*/
  await emptyAcquisitionTables(franchise);
  await emptyHistoryTables(franchise);
  
  console.log(`Successfully deleted ${playersToDelete} free agent player rows.`);
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit.")
  prompt();
});



