// Required modules
const fs = require('fs');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Print tool header message
console.log("This program will update all presentation IDs based on player asset name to fix commentary lines.\n")

// Set up franchise file
const validGames = ['22','23','24'];
const gameYear = FranchiseUtils.getGameYear(validGames);
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

if(gameYear !== '23')
{
	console.log("\nWARNING: If you have used the progression tool on this franchise, modifying the presentation ID of players who have a progression path can cause their path to get rerolled.")

	let continueChoice = FranchiseUtils.getYesOrNo("\nDo you still wish to continue? (yes/no)");
	if (!continueChoice) 
	{
		console.log("\nExiting program. Enter anything to exit.");
		prompt();
		process.exit(0);
	}
}

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
		fingerprintTable = franchise.getTableByUniqueId(tables.franchiseDebugModuleTable);
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
	
	let modifiedNonRookieCount = 0;

	// Iterate through the player table
    for (i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (playerTable.records[i].isEmpty || invalidStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }
		
		// Get player's assetname value
        let playerAssetName = playerTable.records[i]['PLYR_ASSETNAME'];

		// Clean up assetname by removing spaces
		playerAssetName = playerAssetName.trim();

		// Account for selective strandhair by removing "_nostrand" from the assetname if it exists
		if(playerAssetName.includes('_nostrand'))
		{
			playerAssetName = playerAssetName.replace('_nostrand', '');
		}
		
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
			try
			{
				// Extract the numbers after the underscore and convert them to an integer
				newPresentationId = parseInt(playerAssetName.substring(underscoreIndex + 1), 10);
			}
			catch(e)
			{
				// If unable to parse, set the presentation ID to 0
				newPresentationId = 0;
			}
		} 
		else 
		{
			// Update the presentation ID to 0 if underscore does not exist (ie: player likely doesn't have their own commentary lines)
			newPresentationId = 0;
		}
		
		if(playerTable.records[i]['YearsPro'] > 0 && playerTable.records[i]['PresentationId'] !== newPresentationId)
		{
			modifiedNonRookieCount++;
		}

		// Assign the updated presentation ID 
		playerTable.records[i]['PresentationId'] = newPresentationId;
    }
	
	if(gameYear !== '23' && modifiedNonRookieCount > 0)
	{
		console.log(`\n${modifiedNonRookieCount} non-rookie players updated. These players' progression paths will be rerolled next time you run the progression tool.`);
	}

	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPresentation IDs updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("\nEnter anything to exit the program.");
    prompt();
  
});
  