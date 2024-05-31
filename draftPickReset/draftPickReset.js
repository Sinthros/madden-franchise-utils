// Required modules
const fs = require('fs');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Print tool header message
console.log("This program will restore all draft picks back to their original team. Only Madden 24 franchise files are supported.\n");

// Set up franchise file
const gameYear = '24';
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

franchise.on('ready', async function () {
    // Get the draft pick table    
    const draftPickTable = franchise.getTableByUniqueId(tables.draftPickTable);
    await draftPickTable.readRecords();

    // Number of rows in the draft pick table
    const numRows = draftPickTable.header.recordCapacity;

    // Iterate through the draft pick table
    for (let i = 0; i < numRows; i++) 
    {
        // If not an empty row
        if (!draftPickTable.records[i].isEmpty) 
        {
            // Get original team bin
        	const originalTeamRef = draftPickTable.records[i]['OriginalTeam'];

        	// Replace CurrentTeam with original team bin
        	draftPickTable.records[i]['CurrentTeam'] = originalTeamRef;
        }
    }

    // Program complete, so print success message, save the franchise file, and exit
    console.log("\nDraft picks restored successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("\nEnter anything to exit the program.");
    prompt();
});

  