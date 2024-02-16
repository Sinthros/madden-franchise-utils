// Required modules
const prompt = require('prompt-sync')();
const fs = require('fs');
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const allAssetNames = Object.keys(JSON.parse(fs.readFileSync('lookupFiles/all_asset_names.json', 'utf-8')));

// Print tool header message
console.log("This program will update all draft class player equipment based on existing players. Only Madden 24 franchise files are supported.\n")

// Set up franchise file
const gameYear = '24';
const autoUnempty = true;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear, autoUnempty);

const equipmentCols = ['PLYR_EYEPAINT', 'PlayerVisMoveType', 'PLYR_RIGHTARMSLEEVE', 'PLYR_QBSTYLE', 'PLYR_GRASSLEFTELBOW', 'PLYR_RIGHTTHIGH', 'PLYR_RIGHTSPAT', 'PLYR_RIGHTSHOE', 'PLYR_GRASSLEFTHAND', 'PLYR_GRASSRIGHTHAND', 'PLYR_GRASSRIGHTELBOW', 'PLYR_GRASSLEFTWRIST', 'PLYR_GRASSRIGHTWRIST', 'PLYR_VISOR', 'PLYR_HELMET', 'PLYR_FACEMASK', 'PLYR_JERSEYSLEEVE', 'PLYR_JERSEY_STATE', 'PLYR_LEFTSPAT', 'PLYR_LEFTSHOE', 'PLYR_LEFTARMSLEEVE', 'PLYR_MOUTHPIECE', 'PLYR_TOWEL', 'PLYR_STANCE', 'PLYR_SOCK_HEIGHT', 'RunningStyleRating', 'PLYR_FLAKJACKET', 'PLYR_BACKPLATE'];

async function copyEquipment(targetRow, sourceRow)
{
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	await playerTable.readRecords();
	
	for (let i = 0; i < equipmentCols.length; i++)
	{
		const sourceValue = playerTable.records[sourceRow][equipmentCols[i]];		
		playerTable.records[targetRow][equipmentCols[i]] = sourceValue;
	}
};

function getRandomNumber(floor, ceiling) 
{
  // Ensure that the floor and ceiling are integers
  floor = Math.floor(floor);
  ceiling = Math.floor(ceiling);

  // Generate a random number between 0 (inclusive) and 1 (exclusive)
  const randomFraction = Math.random();

  // Scale the random fraction to fit within the specified range
  const randomInRange = randomFraction * (ceiling - floor + 1) + floor;

  // Convert the result to an integer
  const result = Math.floor(randomInRange);

  return result;
};

async function countAtPosition(playerList, position)
{
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	await playerTable.readRecords();
	
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

async function filterByPosition(playerList, position)
{
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	await playerTable.readRecords();
	
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

franchise.on('ready', async function () {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    
	let draftRows = [];
	let nflRows = [];
	let miscRows = [];
	
	// Types of players that are not relevant for our purposes and can be skipped
	const invalidStatuses = ['Retired','Deleted','None','Created'];

    await playerTable.readRecords();
	
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
			// Check if player is a real NFL player
			if (allAssetNames.includes(playerTable.records[i]['PLYR_ASSETNAME']))
			{
				nflRows.push(i);
			}
			else
			{
				miscRows.push(i);
			}
		}
    }
	
	if (draftRows.length === 0)
	{
		console.log("\nThere are no draft class players in your franchise file. Enter anything to exit.");
		prompt();
		process.exit(0);
	}
	
	let nflPlayersOnly = true;
	
	if (nflRows.length === 0)
	{
		nflPlayersOnly = false;
	}
	
	if (nflPlayersOnly)
	{
		for (let i = 0; i < draftRows.length; i++)
		{
			const position = playerTable.records[draftRows[i]]['Position'];
			const numNflAtPosition = await countAtPosition(nflRows, position);
			if(numNflAtPosition < 5)
			{
				const playersAtPosition = await filterByPosition(miscRows, position);
				const randomAtPosition = playersAtPosition[getRandomNumber(0, playersAtPosition.length - 1)];
				await copyEquipment(draftRows[i], randomAtPosition);
			}
			else
			{
				const nflPlayersAtPosition = await filterByPosition(nflRows, position);
				const randomNflAtPosition = nflPlayersAtPosition[getRandomNumber(0, nflPlayersAtPosition.length - 1)];
				await copyEquipment(draftRows[i], randomNflAtPosition);
			}
		}
	}
	else
	{
		for (let i = 0; i < draftRows.length; i++)
		{
			const playersAtPosition = await filterByPosition(miscRows, position);
			const randomAtPosition = playersAtPosition[getRandomNumber(0, playersAtPosition.length - 1)];
			await copyEquipment(draftRows[i], randomAtPosition);
		}
	}
	
	console.log("\nRegenerating all Character Visuals for players/coaches...");
	await characterVisualFunctions.updateAllCharacterVisuals(franchise);
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nRookie equipment updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("\nEnter anything to exit the program.");
    prompt();
  
});
  