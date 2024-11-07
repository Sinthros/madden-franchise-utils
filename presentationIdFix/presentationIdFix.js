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

// Assetname lookup
let nflcLookup;

if(fs.existsSync(`lookupFiles/nflcLookup_${gameYear}.json`))
{
	try
	{
		nflcLookup = Object.keys(JSON.parse(fs.readFileSync(`lookupFiles/nflcLookup_${gameYear}.json`, 'utf-8')));
	}
	catch(error)
	{

	}
}

// If the game has the dynamic progression tool, inform the user and ask if they want to continue
if(gameYear !== FranchiseUtils.YEARS.M23)
{
	console.log("\nWARNING: If you have used the progression tool on this franchise, modifying the presentation ID of players who have a progression path will cause their path to get disrupted, meaning you will have to rerun initial progression next time you run the tool.");

	let continueChoice = FranchiseUtils.getYesOrNo("\nDo you still wish to continue? (yes/no)");
	if (!continueChoice) 
	{
		FranchiseUtils.EXIT_PROGRAM();
	}
}

// Function to get usable presentation IDs
function getUsablePresentationIds(playerTable, overrideAssetNames)
{
	// Array of presentation IDs that can't be used
	let idBlacklist = [];
``	
	// If we have a list of override assetnames
	if(overrideAssetNames)
	{
		// For each assetname in the list
		for(let assetName in Object.values(overrideAssetNames))
		{
			// Clear white space
			assetName = assetName.trim();
			
			let idToPush;

			// Find underscore
			const underscoreIndex = assetName.indexOf('_');

			// If underscore exists
			if (underscoreIndex !== -1) 
			{
				try
				{
					// Extract the numbers after the underscore and convert them to an integer
					idToPush = parseInt(assetName.substring(underscoreIndex + 1), 10);
				}
				catch(e)
				{
					// If unable to parse, set the presentation ID to 0
					idToPush = 0;
				}

				if(isNaN(idToPush))
				{
					idToPush = 0;
				}
			} 
			else 
			{
				// Update the presentation ID to 0 if underscore does not exist (ie: player likely doesn't have their own commentary lines)
				idToPush = 0;
			}

			// Add this ID to the blacklist if it's not already there
			if(!idBlacklist.includes(idToPush))
			{
				idBlacklist.push(idToPush);
			}
		}
	}

	if(nflcLookup)
	{
		for(let assetName of nflcLookup)
		{
			assetName = assetName.trim();
			
			let idToPush;

			const underscoreIndex = assetName.indexOf('_');

			if (underscoreIndex !== -1) 
			{
				try
				{
					// Extract the numbers after the underscore and convert them to an integer
					idToPush = parseInt(assetName.substring(underscoreIndex + 1), 10);
				}
				catch(e)
				{
					// If unable to parse, set the presentation ID to 0
					idToPush = 0;
				}

				if(isNaN(idToPush))
				{
					idToPush = 0;
				}
			} 
			else 
			{
				idToPush = 0;
			}

			// Add this ID to the blacklist if it's not already there
			if(!idBlacklist.includes(idToPush))
			{
				idBlacklist.push(idToPush);
			}
		}
	}

	/*
	// Max player table rows
	const numRows = playerTable.header.recordCapacity;
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
		if(overrideAssetNames && overrideAssetNames.hasOwnProperty(playerAssetName))
		{
			playerAssetName = overrideAssetNames[playerAssetName];
		}

		// Check if the assetname has an underscore
		const underscoreIndex = playerAssetName.indexOf('_');
		let idToPush;

		// If the underscore exists
		if (underscoreIndex !== -1) 
		{
			try
			{
				// Extract the numbers after the underscore and convert them to an integer
				idToPush = parseInt(playerAssetName.substring(underscoreIndex + 1), 10);
			}
			catch(e)
			{
				// If unable to parse, set the presentation ID to 0
				idToPush = 0;
			}
		} 
		else 
		{
			idToPush = 0;
		}

		if(!idBlacklist.includes(idToPush))
		{
			idBlacklist.push(idToPush);
		}
	}*/

	let idWhitelist = [];

	// From 0 to max presentation ID value
	for(let i = 0; i < 32767; i++)
	{
		// If this ID isn't in the blacklist, add it to the whitelist
		if(!idBlacklist.includes(i))
		{
			idWhitelist.push(i);
		}
	}

	return idWhitelist;
}

function handleRemainingPlayers(playerTable, playersToRevisit, presentationIdWhitelist)
{
	// For each player that needs a new ID
	for(let i of playersToRevisit)
	{
		// Randomly select an ID from the whitelist
		let newPresentationId = presentationIdWhitelist[FranchiseUtils.getRandomNumber(0, presentationIdWhitelist.length - 1)];

		// Assign the new presentation ID to the player
		playerTable.records[i]['PresentationId'] = newPresentationId;

		// Create new assetname for this player based on the selected presentation ID
		let nameString = FranchiseUtils.removeSuffixes(`${playerTable.records[i].LastName}${playerTable.records[i].FirstName}`).replace(/\s+/g, '');
		let assetName = `${nameString}_${newPresentationId}`;

		// Assign the new assetname to the player
		playerTable.records[i]['PLYR_ASSETNAME'] = assetName;

		// Remove the presentation ID from the whitelist so it can't be used multiple times
		presentationIdWhitelist = presentationIdWhitelist.filter(id => id !== newPresentationId);
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

	// Set up presentation ID whitelist
	let presentationIdWhitelist = getUsablePresentationIds(playerTable, overrideAssetNames);
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 
	
	// Counter for the number of non-rookies that have been modified
	let modifiedNonRookieCount = 0;

	// Array of players that we will select a new ID for later
	let playersToRevisit = [];

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
				// If unable to parse, we need to revisit this player
				newPresentationId = -1;
				playersToRevisit.push(i);
			}

			if(isNaN(newPresentationId))
			{
				newPresentationId = -1;
				if(!playersToRevisit.includes(i))
				{
					playersToRevisit.push(i);
				}
			}
		} 
		else 
		{
			// Otherwise, we need to revisit this player
			newPresentationId = -1;
			playersToRevisit.push(i);
		}
		
		// If the player is not a rookie and the presentation ID has been or will be updated, increment the non-rookie counter
		if(playerTable.records[i]['YearsPro'] > 0 && playerTable.records[i]['PresentationId'] !== newPresentationId)
		{
			modifiedNonRookieCount++;
		}

		// Assign the updated presentation ID if it's valid
		if(newPresentationId !== -1)
		{
			playerTable.records[i]['PresentationId'] = newPresentationId;

			// If this ID is in the whitelist
			if(presentationIdWhitelist.includes(newPresentationId))
			{
				// Remove the presentation ID from the whitelist
				presentationIdWhitelist = presentationIdWhitelist.filter(id => id !== newPresentationId);
			}
		}
    }

	// If we need to pick a new ID and assetname for someone, do so now
	if(playersToRevisit.length > 0)
	{
		handleRemainingPlayers(playerTable, playersToRevisit, presentationIdWhitelist);
	}
	
	// If this is a game with the dynamic progression tool and we've modified non-rookie players, inform the user how many have been updated
	if(gameYear !== FranchiseUtils.YEARS.M23 && modifiedNonRookieCount > 0)
	{
		console.log(`\n${modifiedNonRookieCount} non-rookie players updated. These players' progression paths will be lost. Next time you run the progression tool, you will need to rerun initial progression.`);
	}

	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPresentation IDs updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  