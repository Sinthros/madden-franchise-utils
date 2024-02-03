// Required modules
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');

// Print tool header message
console.log("This program will update all presentation IDs based on player asset name to fix commentary lines.")

// Set up franchise file
const validGames = ['22','23','24'];
const gameYear = FranchiseUtils.getGameYear(validGames);
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

franchise.on('ready', async function () {
    const playerTable = franchise.getTableByUniqueId(1612938518);
    
	// Types of players that are not relevant for our purposes and can be skipped
	const invalidStatuses = ['Draft','Retired','Deleted','None','Created'];

    await playerTable.readRecords();
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 
	
	// Iterate through the player table
    for (i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (playerTable.records[i].isEmpty || invalidStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }
		
		// Get player's assetname value and check if it has an underscore
        var playerAssetName = playerTable.records[i]['PLYR_ASSETNAME'];
		var underscoreIndex = playerAssetName.indexOf('_');
		var newPresentationId;

        if (underscoreIndex !== -1) 
		{
			// Extract the numbers after the underscore and convert them to an integer
			newPresentationId = parseInt(playerAssetName.substring(underscoreIndex + 1), 10);
		} 
		else 
		{
			// Update the presentation ID to 0 if underscore does not exist (ie: player likely doesn't have their own commentary lines)
			newPresentationId = 0;
		}
		
		// Assign the updated presentation ID 
		playerTable.records[i]['PresentationId'] = newPresentationId;
    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPresentation IDs updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("\nEnter anything to exit the program.");
    prompt();
  
});
  