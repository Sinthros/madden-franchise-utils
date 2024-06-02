// Required modules
const prompt = require('prompt-sync')();
const Xlsx = require('xlsx');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Print tool header message
console.log("This program will update all draft class players based on the NCAA conversion tool output. Only Madden 24 franchise files are supported.\n");

// Set up franchise file
const gameYear = 24;
const autoUnempty = true;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear, autoUnempty);

// Set up Excel file
console.log("Enter the path to the Excel file from the NCAA converter: ");
const excelPath = prompt();
const workbook = Xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const convertedDraftClassData = Xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Filter out any players that do not have a Draft contractstatus, and sort by draft round and pick
const validStatuses = ['Draft'];
const draftClassData = convertedDraftClassData
	.filter(player => validStatuses.includes(player['ContractStatus']))
	.sort((a, b) => {
		// If they are from the same round, sort by pick number
		if (a['PLYR_DRAFTROUND'] === b['PLYR_DRAFTROUND'])
		{
			return a['PLYR_DRAFTPICK'] - b['PLYR_DRAFTPICK'];
		}
		
		// Otherwise just sort by round number
		return a['PLYR_DRAFTROUND'] - b['PLYR_DRAFTROUND'];
	});

// This function converts a position value from the player table to the corresponding value in the draft player table
function getDraftPosition(playerPosition)
{
	switch (playerPosition) 
	{
		case "HB":
		case "FB":
		  finalPosition = "RB";
		  break;
		case "LT":
		case "RT":
		  finalPosition = "OT";
		  break;
		case "LG":
		case "C":
		case "RG":
		  finalPosition = "IOL";
		  break;
		case "LE":
		case "RE":
		  finalPosition = "DE";
		  break;
		case "LOLB":
		case "ROLB":
		  finalPosition = "OLB";
		  break;
		case "SS":
		case "FS":
		  finalPosition = "S"
		  break;
		default:
		  finalPosition = playerPosition;
		  break;
	}

	return finalPosition;
}

franchise.on('ready', async function () {
	// Get required tables
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);
	const draftPlayerTable = franchise.getTableByUniqueId(tables.draftClassTable);
	const visualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
    
	await FranchiseUtils.readTableRecords([playerTable, draftPlayerTable, visualsTable]);

	// Array to store the rows of the draft class players in the player table
	let draftRows = [];
	
	// Types of players that are we are looking for (based on contract status)
	const validStatuses = ['Draft'];
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 
	
	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (playerTable.records[i].isEmpty || !validStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
        }
		
		// Add the row to the list of draft class players
		draftRows.push(i);
    }
	
	// If no draft class players are found, we can't continue, so inform the user and exit
	if (draftRows.length === 0)
	{
		console.log("\nThere are no draft class players in your franchise file, so we can't import a class.");
		FranchiseUtils.EXIT_PROGRAM();
	}
	
	// If the number of draft class players in the franchise is less than the number of players to import, we need to trim the data to match
	let trimmedDraftClassData = draftClassData;
	if(draftClassData.length > draftRows.length)
	{
		// Get the number of players we need to remove
		let numToTrim = draftClassData.length - draftRows.length;
		
		// Ensure the user is okay with trimming the draft class data
		console.log("\nThere are more players in the draft class to import than the size of the draft class in the franchise.");
		console.log(`Due to this, the lowest ${numToTrim} player(s) in the draft class will be removed.`);
		let proceedTrim = FranchiseUtils.getYesOrNo("\nIs this okay? Enter yes or no:");

		// If the user doesn't want to trim, we can't continue, so exit
		if(!proceedTrim)
		{
			console.log("\nImport cancelled.");
			FranchiseUtils.EXIT_PROGRAM();
		}

		// Because we sorted the draft class data previously, we can easily trim by just chopping off the end of the array
		trimmedDraftClassData = draftClassData.slice(0, draftRows.length);
	}

	console.log("\nBeginning import of draft class players...");

	// Sort the draft rows by draft round and draft pick, so we can match them up with the trimmed draft class data.
	// Uses the same sorting logic from the earlier draft class data sort
	draftRows.sort((a, b) => {
		if (playerTable.records[a]['PLYR_DRAFTROUND'] === playerTable.records[b]['PLYR_DRAFTROUND'])
		{
			return playerTable.records[a]['PLYR_DRAFTPICK'] - playerTable.records[b]['PLYR_DRAFTPICK'];
		}
		
		return playerTable.records[a]['PLYR_DRAFTROUND'] - playerTable.records[b]['PLYR_DRAFTROUND'];
	});

	// An array to store all the columns available for each draft class player
	let tableColumns;

	// Iterate through the trimmed draft class data and update the draft rows
	for (let i = 0; i < trimmedDraftClassData.length; i++)
	{
		// Get the draft row and the corresponding draft player data
		const draftRow = draftRows[i];
		const draftPlayer = trimmedDraftClassData[i];
		
		// If this is the first iteration, get the columns available for the draft class players
		if(i === 0)
		{
			tableColumns = Object.keys(playerTable.records[draftRow].fields);
		}

		// Iterate through the keys of the draftPlayer object
		for (const key in draftPlayer)
		{
			// If the key is a column in the player table
			if (tableColumns.includes(key))
			{
				// Update the corresponding key in the player row
				playerTable.records[draftRow][key] = draftPlayer[key];
			}
		}
	}

	// Number of rows in the draft player table
	const draftPlayerNumRows = draftPlayerTable.header.recordCapacity;

	// Iterate through the draft player table and update things as needed
	for (let i = 0; i < draftPlayerNumRows; i++)
	{
		// If it's an empty row, skip it
		if (draftPlayerTable.records[i].isEmpty)
		{
			continue;
		}

		// Get the player reference and the corresponding row in the player table
		const playerRef = draftPlayerTable.records[i]['Player'];
		const playerRow = await FranchiseUtils.bin2Dec(playerRef.slice(15));
		const player = playerTable.records[playerRow];

		// Calculate their new position based on the player table position
		const calculatedPosition = getDraftPosition(player['Position']);

		// Update the draft player table with the new position and audio ID (based on their existing ID from the player table)
		draftPlayerTable.records[i]['DraftPosition'] = calculatedPosition;
		draftPlayerTable.records[i]['SurnameAudioID'] = player['PLYR_COMMENT'];
	}


	console.log("\nRegenerating Character Visuals for all draft class players...");

	// Iterate through draft rows array and regenerate visuals for each draft class player
	for (let i = 0; i < draftRows.length; i++)
    {
        await characterVisualFunctions.regeneratePlayerVisual(franchise, playerTable, visualsTable, draftRows[i], true);
    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nDraft class players imported successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  