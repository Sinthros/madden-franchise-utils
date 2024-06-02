// Required modules
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const gameYear = FranchiseUtils.YEARS.M24;

// Print tool header message
console.log(`This program will restore all draft picks back to their original team. Only Madden ${gameYear} franchise files are supported.\n`);

// Set up franchise file
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

franchise.on('ready', async function () {

    FranchiseUtils.validateGameYears(franchise,gameYear);
    
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
    FranchiseUtils.EXIT_PROGRAM();
});

  