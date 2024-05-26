// Required modules
const fs = require('fs');
const Xlsx = require('xlsx');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

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

if (lookupData.length === 0)
{
	console.log("No data found in the lookup file.");
	console.log("Enter anything to exit.");
	prompt();
	process.exit();
}
else if(Object.keys(lookupData[0]).length < 2)
{
	console.log("Lookup file must have at least two columns.");
	console.log("Enter anything to exit.");
	prompt();
	process.exit();
}

franchise.on('ready', async function () {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	// Types of players that are not relevant for our purposes and can be skipped
	const invalidStatuses = ['Draft','Retired','Deleted','None','Created'];

    await playerTable.readRecords();
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 

	// Get lookup column
	const lookupColumn = Object.keys(lookupData[0])[0];

	// Get columns to update
	const updateColumns = Object.keys(lookupData[0]).slice(1);

	// Iterate through the player table
    for (i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (playerTable.records[i].isEmpty || invalidStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }

		// Get the player's lookup value
		const lookupValue = playerTable.records[i][lookupColumn];

		// Check if the lookup value exists in the lookup data
		const lookupRow = lookupData.find(row => row[lookupColumn] === lookupValue);

		// If the lookup value exists, update the player's values
		if (lookupRow)
		{
			updateColumns.forEach(column => {
				playerTable.records[i][column] = lookupRow[column];
			});
		}

    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPlayers updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("\nEnter anything to exit the program.");
    prompt();
  
});
  