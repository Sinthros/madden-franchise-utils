// Required modules
const fs = require('fs');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Print tool header message
console.log("This program will update all presentation IDs based on player asset name to fix commentary lines.")

// Set up franchise file
const validGames = ['22','23','24'];
const gameYear = FranchiseUtils.getGameYear(validGames);
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

franchise.on('ready', async function () {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	// Special logic for files with custom cyberfaces
	let fingerprintTable;
	let fingerprint;
	let customMeshFile = false;
	let overrideAssetNames;
	const customMeshFingerprints = ['WiiMaster2015', 'WiiMaster2017'];
	if(gameYear === '24')
	{
		// Get the fingerprint from the file, if it's in the list, then set the bool to true and read the override file
		fingerprintTable = franchise.getTableByUniqueId(4212179270);
		await fingerprintTable.readRecords();
		fingerprint = fingerprintTable.records[0]['SideActivityToForce'];
		if(customMeshFingerprints.includes(fingerprint))
		{
			customMeshFile = true;
			try
			{
				overrideAssetNames = JSON.parse(fs.readFileSync(`lookupFiles/${fingerprint}.json`, 'utf-8'));
			}
			catch(error)
			{
				console.error(`Error reading override assetname file: `, error);
				console.log("Enter anything to exit the program.");
    			prompt();
    			process.exit(0);
			}
		}
	}

	

    
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
		
		// Get player's assetname value
        var playerAssetName = playerTable.records[i]['PLYR_ASSETNAME'];
		
		// If this is a file with custom cyberfaces and this assetname is one that has an override, use the override assetname instead
		if(customMeshFile && overrideAssetNames.hasOwnProperty(playerAssetName))
		{
			playerAssetName = overrideAssetNames[playerAssetName];
		}

		// Check if the assetname has an underscore
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
  