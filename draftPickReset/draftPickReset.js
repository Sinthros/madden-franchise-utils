// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const validGameYears = [
    FranchiseUtils.YEARS.M24,
    FranchiseUtils.YEARS.M25
];

console.log("This program will restore all draft picks back to their original team.");

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {

    if (franchise.schema.meta.gameYear >= 25) await FranchiseUtils.fixDraftPicks(franchise); 
    
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

  