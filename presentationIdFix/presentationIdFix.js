// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Valid years
const validGames = [
	FranchiseUtils.YEARS.M22,
	FranchiseUtils.YEARS.M23,
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];

// Print tool header message
console.log(`This program will update all presentation IDs based on player asset name to fix commentary lines. Madden ${FranchiseUtils.formatListString(validGames)} franchise files are supported.\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = parseInt(franchise.schema.meta.gameYear);

// If the game has the dynamic progression tool, inform the user and ask if they want to continue
if(gameYear !== FranchiseUtils.YEARS.M23)
{
	console.log("\nWARNING: If you have used the progression tool on this franchise, modifying the presentation ID of players who have a progression path can cause their path to get rerolled.");

	let continueChoice = FranchiseUtils.getYesOrNo("\nDo you still wish to continue? (yes/no)");
	if (!continueChoice) 
	{
		FranchiseUtils.EXIT_PROGRAM();
	}
}

franchise.on('ready', async function () {
    // Get required tables	
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	// Read required tables
	await playerTable.readRecords();

	// Special logic for files with custom cyberfaces
	let fingerprintTable;
	let fingerprint;
	let customMeshFile = false;
	let overrideAssetNames;

	// List of fingerprints used by files with custom cyberfaces
	const customMeshFingerprints = ['WiiMaster2015', 'WiiMaster2017'];

	// This logic is only for Madden 24 and newer
	if(gameYear >= FranchiseUtils.YEARS.M24)
	{
		// Get the fingerprint from the franchise file if it's in the list, then set the bool to true and read the override file

		// M24 uses a different table from M25 and newer
		fingerprintTable = gameYear === FranchiseUtils.YEARS.M24 ? franchise.getTableByUniqueId(tables.franchiseDebugModuleTable) : franchise.getTableByUniqueId(tables.tutorialInfoTable);
		await fingerprintTable.readRecords();
		const fingerprintFieldName = gameYear === FranchiseUtils.YEARS.M24 ? 'SideActivityToForce' : 'Message';
		fingerprint = fingerprintTable.records[0][fingerprintFieldName];

		// If it's in the fingerprint list, then set the bool to true and read the override file
		if(customMeshFingerprints.includes(fingerprint))
		{
			customMeshFile = true;
			try
			{
				overrideAssetNames = JSON.parse(fs.readFileSync(`lookupFiles/${fingerprint}_${gameYear}.json`, 'utf-8'));
			}
			catch(error)
			{
				console.error(`Error reading override assetname file: `, error);
				FranchiseUtils.EXIT_PROGRAM();
			}
		}
	}
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 
	
	// Counter for the number of non-rookies that have been modified
	let modifiedNonRookieCount = 0;

	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (!FranchiseUtils.isValidPlayer(playerTable.records[i]))
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
		const underscoreIndex = playerAssetName.indexOf('_');
		let newPresentationId;

		// If the underscore exists
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
		
		// If the player is not a rookie and the presentation ID has been updated, increment the non-rookie counter
		if(playerTable.records[i]['YearsPro'] > 0 && playerTable.records[i]['PresentationId'] !== newPresentationId)
		{
			modifiedNonRookieCount++;
		}

		// Assign the updated presentation ID 
		playerTable.records[i]['PresentationId'] = newPresentationId;
    }
	
	// If this is a game with the dynamic progression tool and we've modified non-rookie players, inform the user how many have been updated
	if(gameYear !== FranchiseUtils.YEARS.M23 && modifiedNonRookieCount > 0)
	{
		console.log(`\n${modifiedNonRookieCount} non-rookie players updated. These players' progression paths will be rerolled next time you run the progression tool.`);
	}

	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPresentation IDs updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  