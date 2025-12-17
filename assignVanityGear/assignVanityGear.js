// Required modules
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../Utils/FranchiseUtils');
const characterVisualFunctions = require('../Utils/characterVisualsLookups/characterVisualFunctions');

// Print tool header message
console.log("This program will update all players with your chosen vanity gear item.\n")

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25,
	FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = parseInt(franchise.schema.meta.gameYear);

const lookupFileName = path.join(__dirname, `./lookupFiles/vanityGearLookup${gameYear}.json`);
if(!fs.existsSync(lookupFileName))
{
	console.log("No lookup file exists for the current game year. Unable to continue.");
	FranchiseUtils.EXIT_PROGRAM();
}

const vanityGearLookup = JSON.parse(fs.readFileSync(lookupFileName, 'utf8'));

/**
 * Takes a table reference value and converts it to a row number.
 * 
 * @param {string} ref The reference value
 * @returns {number} The row number specified by the reference, or -1 if it's a zero reference
 */
async function getRowFromRef(ref)
{
	// If the ref is all zeroes, we can save time and just return -1
	if(ref === FranchiseUtils.ZERO_REF)
	{
		return -1;
	}

	// Get the last 15 digits of the ref, which is the row number in binary, then convert it to decimal
	const rowBinVal = ref.slice(15);
	const rowNum = await FranchiseUtils.bin2Dec(rowBinVal);
	
	// Return the converted row number
	return rowNum;
}

/**
 * Assigns a gear item to a player's visuals JSON object.
 * 
 * @param {Object} visualsData The visuals JSON object for the player
 * @param {Object} gearAssetInfo The gear asset JSON object for the desired gear item
 * @returns {Object} The updated visuals JSON object with the new gear item added
 */
function assignGear(visualsData, gearAssetInfo)
{
	// If the gear info includes multiple gear items, we need to repeat this process for each one
	for(let i = 0; i < gearAssetInfo.length; i++)
	{
		// Get what slot type this gear item is for
		const slotType = gearAssetInfo[i]['SlotName'];

		// Figure out which loadout is the one that contains player gear
		let loadouts = visualsData['loadouts'];
		let j;
		for(j = 0; j < loadouts.length; j++)
		{
			if(loadouts[j].hasOwnProperty("loadoutType") && loadouts[j].hasOwnProperty("loadoutElements"))
			{
				break;
			}
		}

		// If the gear loadout was not found for some reason, skip this player entirely
		if(j === loadouts.length)
		{
			return visualsData;
		}


		// Check if the slot type is already in the loadout elements, if so, assign the new item to it
		let loadoutElements = loadouts[j]['loadoutElements'];
		let foundSlot = false;
		for(let k = 0; k < loadoutElements.length; k++)
		{
			if(loadoutElements[k]['slotType'] === slotType)
			{
				loadoutElements[k]['itemAssetName'] = gearAssetInfo[i]['GearAsset'];
				visualsData['loadouts'][j]['loadoutElements'] = loadoutElements;
				foundSlot = true;
			}
		}

		// If the slot type is not found, create a new element and add it to the loadout elements
		if(!foundSlot)
		{
			loadoutElements.push({
				"itemAssetName": gearAssetInfo[i]['GearAsset'],
				"slotType": slotType
			});
		}

		// Update the visuals data JSON with the new loadout elements
		visualsData['loadouts'][j]['loadoutElements'] = loadoutElements;

	}

	// Return modified visuals data
	return visualsData;
}

franchise.on('ready', async function () {

	// Get the required tables
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	// Read required tables
	await FranchiseUtils.readTableRecords([playerTable, characterVisualsTable]);
    
	// Types of players that are not relevant for our purposes and can be skipped
	const invalidStatuses = ['Draft', 'Retired', 'Deleted', 'None'];

	// Present the user with a list of gear options pulled from the lookup JSON
	const vanityGearOptions = Object.keys(vanityGearLookup);
	console.log("\nVanity gear options:");
	for (let i = 0; i < vanityGearOptions.length; i++) 
	{
		console.log(`${i}: ${vanityGearOptions[i]}`);
	}

	// Get the user's selection and look up the corresponding gear asset info
	console.log("\nPlease enter the number of the gear you want: ");
	const gearChoice = vanityGearOptions[parseInt(prompt())];
	const gearAssetInfo = vanityGearLookup[gearChoice];

	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 
	
	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (!FranchiseUtils.isValidPlayer(playerTable.records[i]))
		{
			continue;
        }
		
		// Figure out which row in the character visuals table corresponds to this player
		let playerVisualsRow = getRowFromRef(playerTable.records[i]['CharacterVisuals']);

		// If this player does not have CharacterVisuals assigned for some reason, try to generate it
		if(playerVisualsRow === -1)
		{
			if(gameYear === FranchiseUtils.YEARS.M24)
			{
				// Attempt to generate the visuals for this player
				await characterVisualFunctions.regeneratePlayerVisual(franchise, playerTable, characterVisualsTable, i, true);
			}
			else
			{
				// Regenerating visuals is not supported for M25 and up, so we have to skip this player
				continue;
			}

			// Try to get their visuals row number again
			playerVisualsRow = getRowFromRef(playerTable.records[i]['CharacterVisuals']);
			
			// If it's still a zero ref for some reason, we have to skip this player
			if(playerVisualsRow === -1)
			{
				continue;
			}
		}


		// Get the visuals data for this player and attempt to parse it. If it throws an exception, it is likely because this player has been edited in-game, so skip them.
		const playerVisuals = characterVisualsTable.records[playerVisualsRow];

		let visualsData;

		try
		{
			visualsData = JSON.parse(playerVisuals['RawData']);
		}
		catch(e)
		{
			continue;
		}
	

		// Update the visuals for this player with the new gear item included
		characterVisualsTable.records[playerVisualsRow]['RawData'] = JSON.stringify(assignGear(visualsData, gearAssetInfo));
    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nAll gear updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  