// Required modules
const fs = require('fs');
const Xlsx = require('xlsx');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');

// Print tool header message
console.log("This program will update values for all players based on a lookup.\n")

// Set up franchise file
const validGames = ['22','23','24'];
const gameYear = FranchiseUtils.getGameYear(validGames);
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

console.log("Enter the path to the lookup Excel file: ");
const excelPath = prompt();
const workbook = Xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const lookupData = Xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Ask user how many search columns they want to use
let numSearchColumns = 1;
console.log("How many lookup columns (to find players) do you want to use? Enter a number:");
while (true) 
{
	numSearchColumns = parseInt(prompt().trim());
	if (numSearchColumns > 0 && numSearchColumns <= Object.keys(lookupData[0]).length)
	{
		break;
	}
	else
	{
		console.log("Invalid input. Please enter a number between 1 and " + Object.keys(lookupData[0]).length + ".");
	}
}

// Ask user if they would like to use AND or OR logic for the search columns
let searchLogic = "AND";
if(numSearchColumns > 1)
{
	console.log("Do you want to use AND or OR logic for the search columns? AND will require a match in all search columns, while OR will only require a match in at least one search column. Enter 'AND' or 'OR':");
	while (true)
	{
		searchLogic = prompt().trim().toUpperCase();
		if (searchLogic === 'AND' || searchLogic === 'OR')
		{
			break;
		}
		else
		{
			console.log("Invalid input. Please enter 'AND' or 'OR'.");
		}
	}
}

// Ask user if they want to update CharacterVisuals for edited players (if applicable)
let updateVisuals = false;
if(gameYear === '24')
{
	updateVisuals = FranchiseUtils.getYesOrNo("Do you want to update CharacterVisuals for edited players? Choose yes if you will be updating any columns related to player appearance. (yes/no)");
}

if (lookupData.length === 0)
{
	console.log("No data found in the lookup file.");
	console.log("Enter anything to exit.");
	prompt();
	process.exit();
}
else if(Object.keys(lookupData[0]).length < (numSearchColumns + 1))
{
	console.log(`Lookup file must have at least ${numSearchColumns + 1} columns.`);
	console.log("Enter anything to exit.");
	prompt();
	process.exit();
}

franchise.on('ready', async function () {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	// Types of players that are not relevant for our purposes and can be skipped
	const invalidStatuses = ['Draft','Retired','Deleted','None','Created'];

    await playerTable.readRecords();
	await characterVisualsTable.readRecords();
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 

	// Get lookup columns
	const lookupColumns = Object.keys(lookupData[0]).slice(0, numSearchColumns);

	// Get columns to update
	const updateColumns = Object.keys(lookupData[0]).slice(numSearchColumns);

	// Iterate through the player table
    for (i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (playerTable.records[i].isEmpty || invalidStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }

		// Get each of the player's lookup values
		const playerLookupValues = lookupColumns.map(column => playerTable.records[i][column]);

		// Check if the lookup value exists in the lookup data
		let lookupValueExists = false;
		if (searchLogic === 'AND')
		{
			lookupValueExists = playerLookupValues.every((value, index) => lookupData.some(row => row[lookupColumns[index]] === value));
		}
		else if (searchLogic === 'OR')
		{
			lookupValueExists = playerLookupValues.some((value, index) => lookupData.some(row => row[lookupColumns[index]] === value));
		}

		// If the lookup value exists, update the player's values
		if (lookupValueExists)
		{
			const lookupRow = lookupData.find(row => playerLookupValues.every((value, index) => row[lookupColumns[index]] === value));
			updateColumns.forEach(column => {
				playerTable.records[i][column] = lookupRow[column];
			});

			// Update CharacterVisuals for the player if applicable
			if (updateVisuals)
			{
				await characterVisualFunctions.regeneratePlayerVisual(franchise, playerTable, characterVisualsTable, i, true);
			}
		}

    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPlayers updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("\nEnter anything to exit the program.");
    prompt();
  
});
  