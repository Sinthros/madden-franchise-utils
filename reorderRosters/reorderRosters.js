const FranchiseUtils = require('../lookupFunctions/FranchiseUtils')
const { getBinaryReferenceData } = require('madden-franchise/services/utilService')

const validGameYears = [
    FranchiseUtils.YEARS.M20,
    FranchiseUtils.YEARS.M21,
    FranchiseUtils.YEARS.M22,
    FranchiseUtils.YEARS.M23,
    FranchiseUtils.YEARS.M24,
    FranchiseUtils.YEARS.M25,
  ];


console.log("This program will reorder all rosters, prioritizing higher overall players first.");
console.log("This should help avoid an issue where some notable players are missing from Preseason games.");

const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

// Function to sort and update a table
function sortTableFields(table, overalls) {
  for (let i = 0; i < table.header.recordCapacity; i++) {
    let tempArray = []

    table.records[i].fieldsArray.forEach(field => {
      tempArray.push(field.value)
    })

    tempArray.sort((a, b) => overalls[b] - overalls[a])

    tempArray.forEach((val, index) => {
      table.records[i].fieldsArray[index].value = val
    })
  }
}

franchise.on('ready', async function () {

    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const rosterTable = franchise.getTableByUniqueId(tables.rosterTable);
    const freeAgentTable = franchise.getTableByUniqueId(tables.freeAgentTable);

    await FranchiseUtils.readTableRecords([playerTable,rosterTable,freeAgentTable]);


    let overalls = {}

    overalls[FranchiseUtils.ZERO_REF] = 0


    for (let i = 0; i < playerTable.header.recordCapacity;i++ ) { // Iterate through the player table

      if (!playerTable.records[i].isEmpty) {
        const playerBinary = getBinaryReferenceData(playerTable.header.tableId,i);      
        overalls[playerBinary] = playerTable.records[i].OverallRating;
      }
    }

    // Sort the roster table
    sortTableFields(rosterTable,overalls);
    console.log("Successfully reordered rosters by overall.");

    const message = "Would you like to also reorder Free Agents by overall? Enter yes or no.";
    const reorderFreeAgents = FranchiseUtils.getYesOrNo(message);

    if (reorderFreeAgents) {
        sortTableFields(freeAgentTable,overalls);
        console.log("Successfully reordered free agents by overall.");
    }

    console.log("Finished program successfully.");
    await FranchiseUtils.saveFranchiseFile(franchise)
    FranchiseUtils.EXIT_PROGRAM();

})