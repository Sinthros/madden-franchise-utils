// Required modules
const fs = require('fs');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Required lookups
const allAssetNames = Object.keys(JSON.parse(fs.readFileSync('lookupFiles/all_asset_names.json', 'utf-8')));

// Print tool header message
console.log("This program will update all draft class player equipment based on existing players. Only Madden 24 franchise files are supported.\n")

// Set up franchise file
const gameYear = FranchiseUtils.YEARS.M24;
const autoUnempty = true;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear, autoUnempty);

// List of relevant equipment columns in the player table
const equipmentCols = ['PLYR_EYEPAINT', 'PlayerVisMoveType', 'PLYR_RIGHTARMSLEEVE', 'PLYR_QBSTYLE', 'PLYR_GRASSLEFTELBOW', 'PLYR_RIGHTTHIGH', 'PLYR_RIGHTSPAT', 'PLYR_RIGHTSHOE', 'PLYR_GRASSLEFTHAND', 'PLYR_GRASSRIGHTHAND', 'PLYR_GRASSRIGHTELBOW', 'PLYR_GRASSLEFTWRIST', 'PLYR_GRASSRIGHTWRIST', 'PLYR_VISOR', 'PLYR_HELMET', 'PLYR_FACEMASK', 'PLYR_JERSEYSLEEVE', 'PLYR_JERSEY_STATE', 'PLYR_LEFTSPAT', 'PLYR_LEFTSHOE', 'PLYR_LEFTARMSLEEVE', 'PLYR_MOUTHPIECE', 'PLYR_TOWEL', 'PLYR_STANCE', 'PLYR_SOCK_HEIGHT', 'RunningStyleRating', 'PLYR_FLAKJACKET', 'PLYR_BACKPLATE'];

// This function copies all data in the equipment columns of the source row in the player table to the target row in the player table
async function copyEquipment(targetRow, sourceRow, playerTable)
{
	for (let i = 0; i < equipmentCols.length; i++)
	{
		const sourceValue = playerTable.records[sourceRow][equipmentCols[i]];		
		playerTable.records[targetRow][equipmentCols[i]] = sourceValue;
	}
};

// This function, given a list of player rows and a position, returns the number of players in the list that have the given position
async function countAtPosition(playerList, position, playerTable)
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

// This function, given a list of player rows and a position, returns a list of player rows that have the given position
async function filterByPosition(playerList, position, playerTable)
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

// This function enumerates all players in the player table and sorts them into draft class players, NFL players, and other active players
async function enumeratePlayers(playerTable, draftRows, nflRows, miscRows)
{
	// Types of players that are not relevant for our purposes and can be skipped
	const invalidStatuses = ['Retired','Deleted','None','Created'];
	
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

	FranchiseUtils.validateGameYears(franchise,gameYear);
	
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
			const numNflAtPosition = await countAtPosition(nflRows, position, playerTable);

			// If we have less than 5 NFL players at the position, we will use all active players at the position to copy from
			if(numNflAtPosition < 5)
			{
				// Filter the list of active players by position
				const playersAtPosition = await filterByPosition(miscRows, position, playerTable);

				// Randomly select a player from the filtered list to copy from
				const randomAtPosition = playersAtPosition[FranchiseUtils.getRandomNumber(0, playersAtPosition.length - 1)];

				// Copy the equipment from the selected player to the draft class player
				await copyEquipment(draftRows[i], randomAtPosition, playerTable);
			}
			else // Otherwise, we can use exclusively NFL players at the position
			{
				// Filter the list of NFL players by position
				const nflPlayersAtPosition = await filterByPosition(nflRows, position, playerTable);

				// Randomly select an NFL player from the filtered list to copy from
				const randomNflAtPosition = nflPlayersAtPosition[FranchiseUtils.getRandomNumber(0, nflPlayersAtPosition.length - 1)];

				// Copy the equipment from the selected NFL player to the draft class player
				await copyEquipment(draftRows[i], randomNflAtPosition, playerTable);
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
			const playersAtPosition = await filterByPosition(miscRows, position, playerTable);

			// Randomly select a player from the filtered list to copy from
			const randomAtPosition = playersAtPosition[FranchiseUtils.getRandomNumber(0, playersAtPosition.length - 1)];

			// Copy the equipment from the selected player to the draft class player
			await copyEquipment(draftRows[i], randomAtPosition, playerTable);
		}
	}
	
	console.log("\nRegenerating Character Visuals for draft class players...");

	// Iterate through the draft rows array and regenerate visuals for each player
	for (let i = 0; i < draftRows.length; i++)
    {
        await characterVisualFunctions.regeneratePlayerVisual(franchise, playerTable, visualsTable, draftRows[i],false);
    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nRookie equipment updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  