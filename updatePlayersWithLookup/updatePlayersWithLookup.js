// Required modules
const Xlsx = require('xlsx');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');

// Print tool header message
console.log("This program will update values for all players in a Madden 24 franchise file based on a lookup.\n")

// Set up franchise file
const gameYear = 24;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

// Set up the excel lookup file
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
updateVisuals = FranchiseUtils.getYesOrNo("Do you want to update CharacterVisuals for edited players? Choose yes if you will be updating any columns related to player appearance. (yes/no)");

// Ask user if they want to also update draft class players
let updateDraftClass = false;
updateDraftClass = FranchiseUtils.getYesOrNo("Do you want to also update draft class players if they exist? (yes/no)");

// Check if the lookup file is empty or has less columns than required
if (lookupData.length === 0)
{
	console.log("No data found in the lookup file.");
	FranchiseUtils.EXIT_PROGRAM();
}
else if(Object.keys(lookupData[0]).length < (numSearchColumns + 1))
{
	console.log(`Lookup file must have at least ${numSearchColumns + 1} columns.`);
	FranchiseUtils.EXIT_PROGRAM();
}

franchise.on('ready', async function () {
    // Get required tables
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	// Read required tables
	await FranchiseUtils.readTableRecords([playerTable, characterVisualsTable]);

	// Types of players that are not relevant for our purposes and can be skipped
	let invalidStatuses = ['Retired','Deleted','None','Created'];

	// If not updating draft class players, add Draft to the list of invalid statuses
	if (!updateDraftClass)
	{
		invalidStatuses.push('Draft');
	}
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity;

	// Get lookup columns
	const lookupColumns = Object.keys(lookupData[0]).slice(0, numSearchColumns);

	// Array to store the indices of column names that match in the lookup and update columns
	let duplicateIndices = [];

	// Iterate through the search columns
	for(let i = 0; i < numSearchColumns; i++)
	{
		// Check if the column name starts with 'Lookup_'
		if(lookupColumns[i].slice(0, 7) === 'Lookup_')
		{
			// If it does, this is a duplicate, so remove the Lookup_ prefix and add the index to the array
			lookupColumns[i] = lookupColumns[i].slice(7);
			duplicateIndices.push(i);
		}
	}

	// Get columns to update
	const updateColumns = Object.keys(lookupData[0]).slice(numSearchColumns);

	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (playerTable.records[i].isEmpty || invalidStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }

		// Get each of the player's lookup values
		let playerLookupValues = [];
		for(let j = 0; j < numSearchColumns; j++)
		{
			playerLookupValues.push(playerTable.records[i][lookupColumns[j]]);
		}

		// Check if the lookup value exists in the lookup data
		let lookupValueExists = false;
		let row = -1;

		// Iterate through the lookup data based on the search logic
		if (searchLogic === 'AND')
		{
			// Iterate through the search columns for each row in the lookup data
			for(let j = 0; j < lookupData.length; j++)
			{
				for(let k = 0; k < numSearchColumns; k++)
				{
					// Get the column we're checking
					let searchColumn = lookupColumns[k];

					// If it's a duplicate, we need to add the prefix to find the correct data
					if(duplicateIndices.includes(k))
					{
						searchColumn = 'Lookup_' + lookupColumns[k];
					}
					
					// If the lookup value matches, set the flag to true for now
					if(lookupData[j][searchColumn] === playerLookupValues[k])
					{
						lookupValueExists = true;
					}
					else // Otherwise, we don't have a match, and since it's AND logic, we can stop searching
					{
						lookupValueExists = false;
						break;
					}
				}

				// If the lookup value exists, we found the row and can stop searching, so store the row and break
				if(lookupValueExists)
				{
					row = j;
					break;
				}
			}
		}
		else if (searchLogic === 'OR')
		{
			// Iterate through the search columns for each row in the lookup data
			for(let j = 0; j < lookupData.length; j++)
			{
				for(let k = 0; k < numSearchColumns; k++)
				{
					// Get the column we're checking
					let searchColumn = lookupColumns[k];

					// If it's a duplicate, we need to add the prefix to find the correct data
					if(duplicateIndices.includes(k))
					{
						searchColumn = 'Lookup_' + lookupColumns[k];
					}
					
					// If the lookup value matches, set the flag to true. Since we're using OR logic, we're done searching, so break
					if(lookupData[j][searchColumn] === playerLookupValues[k])
					{
						lookupValueExists = true;
						break;
					}
					else // Otherwise, set the flag to false for now and keep searching
					{
						lookupValueExists = false;
					}
				}

				// If the lookup value exists, we found the row and can stop searching, so store the row and break
				if(lookupValueExists)
				{
					row = j;
					break;
				}
			}
		}

		// If the lookup value exists, update the player's values accordingly
		if (lookupValueExists)
		{
			// For each update column, update the player's corresponding value
			updateColumns.forEach(column => {
				playerTable.records[i][column] = lookupData[row][column];
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
	FranchiseUtils.EXIT_PROGRAM();
  
});
  