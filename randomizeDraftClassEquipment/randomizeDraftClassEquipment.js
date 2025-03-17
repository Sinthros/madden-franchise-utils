// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const characterVisualFunctions = require('../Utils/characterVisualsLookups/characterVisualFunctions');

// Valid game years
const validYears = [
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];

// Print tool header message
console.log(`This program will update all draft class player equipment based on existing players. Only Madden ${FranchiseUtils.formatListString(validYears)} franchise files are supported.\n`)

// Set up franchise file
const franchise = FranchiseUtils.init(validYears, {isAutoUnemptyEnabled: true});
const gameYear = franchise.schema.meta.gameYear;
const tables = FranchiseUtils.getTablesObject(franchise);

// No equipment columns in M25+, so we must use the JSON strategy
let useJsonStrategy = gameYear >= FranchiseUtils.YEARS.M24; // Latest version of madden-franchise fully supports JSON for M24, so we can now use the JSON strategy for M24 as well

const lookupFileName = `all_asset_names_m${gameYear}.json`;

if(!fs.existsSync(`lookupFiles/${lookupFileName}`))
{
	console.log(`\nAssetname lookup file for Madden ${gameYear} not found. Unable to continue.`);
	FranchiseUtils.EXIT_PROGRAM();
}

let allAssetNames = JSON.parse(fs.readFileSync(`lookupFiles/${lookupFileName}`, 'utf-8'));

if(gameYear === FranchiseUtils.YEARS.M24)
{
	allAssetNames = Object.keys(allAssetNames);
}

// List of relevant equipment/other columns in the player table
const equipmentCols = ['PLYR_EYEPAINT', 'PlayerVisMoveType', 'PLYR_RIGHTARMSLEEVE', 'PLYR_QBSTYLE', 'PLYR_GRASSLEFTELBOW', 'PLYR_RIGHTTHIGH', 'PLYR_RIGHTSPAT', 'PLYR_RIGHTSHOE', 'PLYR_GRASSLEFTHAND', 'PLYR_GRASSRIGHTHAND', 'PLYR_GRASSRIGHTELBOW', 'PLYR_GRASSLEFTWRIST', 'PLYR_GRASSRIGHTWRIST', 'PLYR_VISOR', 'PLYR_HELMET', 'PLYR_FACEMASK', 'PLYR_JERSEYSLEEVE', 'PLYR_JERSEY_STATE', 'PLYR_LEFTSPAT', 'PLYR_LEFTSHOE', 'PLYR_LEFTARMSLEEVE', 'PLYR_MOUTHPIECE', 'PLYR_TOWEL', 'PLYR_STANCE', 'PLYR_SOCK_HEIGHT', 'RunningStyleRating', 'PLYR_FLAKJACKET', 'PLYR_BACKPLATE'];

/**
 * Copies all data in the equipment columns of the source row in the player table to the target row in the player table
 * 
 * @param {number} targetRow The row number of the target player to update
 * @param {number} sourceRow The row number of the source player to copy equipment data from
 * @param {Object} playerTable The player table object
*/
async function copyEquipment(targetRow, sourceRow, playerTable)
{
	// Get all columns in the table
	const keys = Object.keys(playerTable.records[sourceRow].fields);
	
	// Not all columns are present in all games, so we must check if the column exists before copying
	for (let i = 0; i < equipmentCols.length; i++)
	{		
		if(keys.includes(equipmentCols[i]))
		{
			const sourceValue = playerTable.records[sourceRow][equipmentCols[i]];
			playerTable.records[targetRow][equipmentCols[i]] = sourceValue;
		}
	}
};

/**
 * Copies all data in the character visuals JSON data of the source row in the player table to the character visuals JSON data of the target row in the player table
 * 
 * @param {number} targetRow The row number of the target player to update
 * @param {number} sourceRow The row number of the source player to copy equipment data from
 * @param {Object} playerTable The player table object
 * @param {Object} visualsTable The character visuals table object 
 */
async function copyEquipmentJson(targetRow, sourceRow, playerTable, visualsTable)
{
	// Get row numbers for each player's CharacterVisuals data
	const sourceVisualsRow = FranchiseUtils.bin2Dec(playerTable.records[sourceRow]['CharacterVisuals'].slice(15));
	const targetVisualsRow = FranchiseUtils.bin2Dec(playerTable.records[targetRow]['CharacterVisuals'].slice(15));

	let sourceVisualsData;
	let targetVisualsData;

	// Attempt to parse the JSON data for both players, if either fails, then chances are the player was edited in-game and is no longer JSON, so we skip
	try
	{
		sourceVisualsData = JSON.parse(visualsTable.records[sourceVisualsRow]['RawData']);
		targetVisualsData = JSON.parse(visualsTable.records[targetVisualsRow]['RawData']);
	}
	catch (e)
	{
		return;
	}

	const sourceVisualsLoadouts = sourceVisualsData['loadouts'];
	const targetVisualsLoadouts = targetVisualsData['loadouts'];

	let sourceEquipmentLoadouts;

	// Find the equipment loadouts for the source player
	for (let i = 0; i < sourceVisualsLoadouts.length; i++)
	{
		if(sourceVisualsLoadouts[i]['loadoutType'] === 'PlayerOnField')
		{
			sourceEquipmentLoadouts = sourceVisualsLoadouts[i];
			break;
		}
	}

	// If the player doesn't have equipment loadouts for some reason, we can't continue, so skip
	if(!sourceEquipmentLoadouts)
	{
		return;
	}

	// Update the equipment loadouts for the target player if it exists
	for(let i = 0; i < targetVisualsLoadouts.length; i++)
	{
		if(targetVisualsLoadouts[i]['loadoutType'] === 'PlayerOnField')
		{
			targetVisualsLoadouts[i] = sourceEquipmentLoadouts;
			break;
		}
	}

	// Update the target player's JSON data with the new equipment loadouts
	targetVisualsData['loadouts'] = targetVisualsLoadouts;

	// Attempt to update the target player's JSON data
	try
	{
		visualsTable.records[targetVisualsRow]['RawData'] = JSON.stringify(targetVisualsData);
	}
	catch (e)
	{
		return;
	}

	return;
}

/**
 * Given a list of player rows and a position, returns the number of players in the list that have the given position
 * 
 * @param {Array<number>} playerList A list of player row numbers
 * @param {string} position The position to count
 * @param {Object} playerTable The player table object
 * @returns 
 */
function countAtPosition(playerList, position, playerTable)
{
	let numAtPosition = 0;
	
	for (let i = 0; i < playerList.length; i++)
	{
		if(playerTable.records[playerList[i]]['Position'] === position)
		{
			numAtPosition++;
		}
	}
	
	return numAtPosition;
};

/**
 * Given a list of player rows and a position, returns a list of player rows that have the given position
 * 
 * @param {Array<number>} playerList A list of player row numbers
 * @param {string} position The position to filter by
 * @param {Object} playerTable The player table object
 * @returns {Array<number>} A list of player row numbers that are the given position
 */
function filterByPosition(playerList, position, playerTable)
{
	let playersAtPosition = [];
	
	for (let i = 0; i < playerList.length; i++)
	{
		if(playerTable.records[playerList[i]]['Position'] === position)
		{
			playersAtPosition.push(playerList[i]);
		}
	}
	
	return playersAtPosition;
};

/**
 * Enumerates all players in the player table and sorts them into draft class players, NFL players, and other active players
 * 
 * @param {Object} playerTable The player table object
 * @param {Array<number>} draftRows A list to store row numbers of draft class players
 * @param {Array<number>} nflRows A list to store row numbers of real NFL players
 * @param {Array<number>} miscRows A list to store row numbers of all other active players
 */
async function enumeratePlayers(playerTable, draftRows, nflRows, miscRows)
{	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 
	
	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (!FranchiseUtils.isValidPlayer(playerTable.records[i], {includeDraftPlayers: true}))
		{
			continue;
        }
		
		// If it's a draft class player, add to list of draft players
		if (playerTable.records[i]['ContractStatus'] === 'Draft')
		{
			draftRows.push(i);
		}
		else
		{	
			// Check if player is a real NFL player based on assetname lookup
			if (allAssetNames.includes(playerTable.records[i]['PLYR_ASSETNAME']))
			{
				// If they are, add to list of NFL players
				nflRows.push(i);
			}
			else
			{
				// Otherwise, add to list of other active players
				miscRows.push(i);
			}
		}
    }
}


franchise.on('ready', async function () {

	
	
    // Get required tables
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	const visualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	// Read required tables
	await FranchiseUtils.readTableRecords([playerTable, visualsTable]);
    
	// Arrays to represent the draft class player rows, rows of real NFL players, and rows of other active players
	let draftRows = [];
	let nflRows = [];
	let miscRows = [];
	
	// Enumerate all players in the player table and sort them into the appropriate arrays
	await enumeratePlayers(playerTable, draftRows, nflRows, miscRows);
	
	// If there are no draft class players, we can't continue, so inform the user and exit
	if (draftRows.length === 0)
	{
		console.log("\nThere are no draft class players in your franchise file.");
		FranchiseUtils.EXIT_PROGRAM();
	}
	
	// Check if there are NFL players at all in the franchise file so we can know if we can use NFL players to copy from
	let nflPlayersOnly = !(nflRows.length === 0);
	
	// If we can use NFL players
	if (nflPlayersOnly)
	{
		// Iterate through the draft class row array
		for (let i = 0; i < draftRows.length; i++)
		{
			// Read the player's position
			const position = playerTable.records[draftRows[i]]['Position'];

			// Check how many NFL players are at the player's position
			const numNflAtPosition = countAtPosition(nflRows, position, playerTable);

			// If we have less than 5 NFL players at the position, we will use all active players at the position to copy from
			if(numNflAtPosition < 5)
			{
				// Filter the list of active players by position
				const playersAtPosition = filterByPosition(miscRows, position, playerTable);

				// Randomly select a player from the filtered list to copy from
				const randomAtPosition = playersAtPosition[FranchiseUtils.getRandomNumber(0, playersAtPosition.length - 1)];

				// Copy the equipment from the selected player to the draft class player
				if(useJsonStrategy)
				{
					await copyEquipmentJson(draftRows[i], randomAtPosition, playerTable, visualsTable);
					await copyEquipment(draftRows[i], randomAtPosition, playerTable);
				}
				else
				{
					await copyEquipment(draftRows[i], randomAtPosition, playerTable);
				}
			}
			else // Otherwise, we can use exclusively NFL players at the position
			{
				// Filter the list of NFL players by position
				const nflPlayersAtPosition = filterByPosition(nflRows, position, playerTable);

				// Randomly select an NFL player from the filtered list to copy from
				const randomNflAtPosition = nflPlayersAtPosition[FranchiseUtils.getRandomNumber(0, nflPlayersAtPosition.length - 1)];

				// Copy the equipment from the selected NFL player to the draft class player
				if(useJsonStrategy)
				{
					await copyEquipmentJson(draftRows[i], randomNflAtPosition, playerTable, visualsTable);
					await copyEquipment(draftRows[i], randomNflAtPosition, playerTable);
				}
				else
				{
					await copyEquipment(draftRows[i], randomNflAtPosition, playerTable);
				}
			}
		}
	}
	else // If we can't use NFL players, we will use all active players to copy from
	{
		// Iterate through the draft class row array
		for (let i = 0; i < draftRows.length; i++)
		{
			// Read the player's position
			const position = playerTable.records[draftRows[i]]['Position'];

			// Filter the list of active players by position
			const playersAtPosition = filterByPosition(miscRows, position, playerTable);

			// Randomly select a player from the filtered list to copy from
			const randomAtPosition = playersAtPosition[FranchiseUtils.getRandomNumber(0, playersAtPosition.length - 1)];

			// Copy the equipment from the selected player to the draft class player
			if(useJsonStrategy)
			{
				await copyEquipmentJson(draftRows[i], randomAtPosition, playerTable, visualsTable);
				await copyEquipment(draftRows[i], randomAtPosition, playerTable);
			}
			else
			{
				await copyEquipment(draftRows[i], randomAtPosition, playerTable);
			}
		}
	}

	// Regenerate visuals if we are using the player table strategy in M24+ and not the JSON strategy
	if(!useJsonStrategy && gameYear >= FranchiseUtils.YEARS.M24)
	{
		console.log("\nRegenerating CharacterVisuals for draft class players...");

		// Iterate through the draft rows array and regenerate visuals for each player
		for (let i = 0; i < draftRows.length; i++)
		{
			await characterVisualFunctions.regeneratePlayerVisual(franchise, playerTable, visualsTable, draftRows[i],false);
		}
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nRookie equipment updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  