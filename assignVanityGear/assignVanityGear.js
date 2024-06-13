// Required modules
const fs = require('fs');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const vanityGearLookup = JSON.parse(fs.readFileSync('./lookupFiles/vanityGearLookup.json', 'utf8'));

// Print tool header message
console.log("This program will update all players with your chosen vanity gear item.\n")

// Set up franchise file
const gameYear = FranchiseUtils.YEARS.M24;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

// Convert a row reference to a row number
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

// Assign a given gear item to a given visuals JSON
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
			if(loadouts[j].hasOwnProperty("loadoutType"))
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
		if (playerTable.records[i].isEmpty || invalidStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }
		
		// Figure out which row in the character visuals table corresponds to this player
		let playerVisualsRow = await getRowFromRef(playerTable.records[i]['CharacterVisuals']);

		// If this player does not have CharacterVisuals assigned for some reason, try to generate it
		if(playerVisualsRow === -1)
		{
			// Attempt to generate the visuals for this player
			await characterVisualFunctions.regeneratePlayerVisual(franchise, playerTable, characterVisualsTable, i, true);

			// Try to get their visuals row number again
			playerVisualsRow = await getRowFromRef(playerTable.records[i]['CharacterVisuals']);
			
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
  