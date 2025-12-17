(async () => {
	// Required modules
	const FranchiseUtils = require('../Utils/FranchiseUtils');
	const ISON_FUNCTIONS = require('./isonFunctions');
	const fs = require('fs');
	const prompt = require('prompt-sync')();

	// Print tool header message
	console.log("This program will read raw ISON entries (typically used for CharacterVisuals data) and allow you to convert between ISON and JSON.\n");
	// Set up franchise file
	const validGames = [
		FranchiseUtils.YEARS.M26
	];
	const gameYear = FranchiseUtils.getGameYear(validGames);
	const franchise = await FranchiseUtils.selectFranchiseFileAsync(gameYear);
	FranchiseUtils.validateGameYears(franchise, validGames);
	const tables = FranchiseUtils.getTablesObject(franchise);
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
	await characterVisualsTable.readRecords();

	let option;
	do
	{
		// Ask the user what they want to do
		console.log("\nPlease select an option:");
		console.log("1 - Convert ISON to JSON (read CharacterVisuals)");
		console.log("2 - Convert JSON to ISON (write CharacterVisuals)");
		console.log("3 - Dump raw ISON entry (advanced)");
		console.log("4 - Import raw ISON entry (advanced)");
		console.log("5 - Exit");

		option = parseInt(prompt().trim());

		if(option < 1 || option > 5 || isNaN(option))
		{
			console.log("Invalid option.\n");
		}
		

		if(option === 1)
		{
			let rowNumber;
			do
			{
				// Get the CharacterVisuals row number from the user
				console.log("\nEnter the CharacterVisuals row number to read: ");
				rowNumber = parseInt(prompt().trim());
	
				if(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || rowNumber < 0)
				{
					console.log("Invalid row number. Please enter a valid row number that exists in the table.\n");
				}
	
				if(characterVisualsTable.records[rowNumber].isEmpty)
				{
					console.log("The selected row is an empty record. Please select a non-empty row.\n");
				}
			}
			while(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || characterVisualsTable.records[rowNumber].isEmpty || rowNumber < 0);
	
			// Convert the ISON for the selected row to JSON
			const json = ISON_FUNCTIONS.isonVisualsToJson(characterVisualsTable, rowNumber, gameYear);
	
			// Write the object to a JSON file
			const jsonString = JSON.stringify(json, null, 4);
	
			// Get the target file path from the user
			console.log("\nEnter the path to write the JSON file: ");
			let newFilePath = prompt().trim().replace(/['"]/g, '');
	
			if(!newFilePath.endsWith('.json')) {
				newFilePath += '.json';
			}
	
			fs.writeFileSync(newFilePath, jsonString);
	
			console.log(`\nSuccessfully wrote JSON to ${newFilePath}.`);
			
		}
		else if(option === 2)
		{
			// Get the target file path from the user
			let newFilePath;
			do
			{
				console.log("\nEnter the path to the JSON file to write to ISON: ");
				newFilePath = prompt().trim().replace(/['"]/g, '');
	
				if(!fs.existsSync(newFilePath) && !newFilePath.endsWith('.json')) 
				{
					newFilePath += '.json';
				}
	
				if(!fs.existsSync(newFilePath))
				{
					console.log("JSON file not found at given path. Please enter a valid path to a JSON file.\n");
				}
			}
			while(!fs.existsSync(newFilePath));
	
			// Read the JSON file
			let json;
			try
			{
				json = JSON.parse(fs.readFileSync(newFilePath, 'utf8'));
			}
			catch(e)
			{
				console.error("Error reading JSON file. Please ensure the file is a valid JSON.\n");
				continue;
			}
	
			const keysToRemove = ['skinToneScale', 'genericHead', 'genericHeadName', 'heightInches', 'assetName', 'containerId']
	
			for (let key of keysToRemove) 
			{
				if(json.hasOwnProperty(key))
				{
					FranchiseUtils.removeKeyFromJson(json, key);
					console.log(`Removed key ${key} from JSON as it is not supported in ISON and not necessary.`);
				}
				
			}
	
			// Get the CharacterVisuals row number from the user
			let rowNumber;
			do
			{
				// Get the CharacterVisuals row number from the user
				console.log("\nEnter the CharacterVisuals row number to write to: ");
				rowNumber = parseInt(prompt().trim());
	
				if(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || rowNumber < 0)
				{
					console.log("Invalid row number. Please enter a valid row number that exists in the table.\n");
				}
	
				if(characterVisualsTable.records[rowNumber].isEmpty)
				{
					console.log("The selected row is an empty record. Please select a non-empty row.\n");
				}
			}
			while(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || characterVisualsTable.records[rowNumber].isEmpty || rowNumber < 0);
	
			// Convert the JSON to ISON
			ISON_FUNCTIONS.jsonVisualsToIson(characterVisualsTable, rowNumber, json, gameYear);
	
			console.log(`\nSuccessfully wrote JSON to row ${rowNumber} in CharacterVisuals.`);
	
			await FranchiseUtils.saveFranchiseFile(franchise);
		}
		else if(option === 3)
		{
			let rowNumber;
			do
			{
				// Get the CharacterVisuals row number from the user
				console.log("\nEnter the CharacterVisuals row number to read: ");
				rowNumber = parseInt(prompt().trim());
	
				if(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || rowNumber < 0)
				{
					console.log("Invalid row number. Please enter a valid row number that exists in the table.\n");
				}
	
				if(characterVisualsTable.records[rowNumber].isEmpty)
				{
					console.log("The selected row is an empty record. Please select a non-empty row.\n");
				}
			}
			while(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || characterVisualsTable.records[rowNumber].isEmpty || rowNumber < 0);
			
			ISON_FUNCTIONS.initGameSpecific(gameYear);

			// Get the ISON data for the selected row
			const isonData = gameYear >= FranchiseUtils.YEARS.M26 ? ISON_FUNCTIONS.getZstdTable3IsonData(characterVisualsTable, rowNumber) : ISON_FUNCTIONS.getTable3IsonData(characterVisualsTable, rowNumber);
	
			// Get the target file path from the user
			console.log("\nEnter the path to write the ISON file: ");
	
			let newFilePath = prompt().trim().replace(/['"]/g, '');
	
			if(!newFilePath.endsWith('.ison')) {
				newFilePath += '.ison';
			}
	
			fs.writeFileSync(newFilePath, isonData);
	
			console.log(`\nSuccessfully wrote raw ISON data to ${newFilePath}.`);
		}
		else if(option === 4)
		{
			// Get the target file path from the user
			let newFilePath;
			do
			{
				console.log("\nEnter the path to the ISON file to write: ");
				newFilePath = prompt().trim().replace(/['"]/g, '');
	
				if(!fs.existsSync(newFilePath) && !newFilePath.endsWith('.ison')) 
				{
					newFilePath += '.ison';
				}
	
				if(!fs.existsSync(newFilePath))
				{
					console.log("ISON file not found at given path. Please enter a valid path to an ISON file.\n");
				}
			}
			while(!fs.existsSync(newFilePath));

			// Read the ISON file
			let ison;
			try
			{
				ison = fs.readFileSync(newFilePath, 'utf8');
			}
			catch(e)
			{
				console.error("Error reading ISON file. Please ensure the file is a valid ISON.\n");
				continue;
			}

			let rowNumber;

			do
			{
				// Get the CharacterVisuals row number from the user
				console.log("\nEnter the CharacterVisuals row number to write to: ");
				rowNumber = parseInt(prompt().trim());
	
				if(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || rowNumber < 0)
				{
					console.log("Invalid row number. Please enter a valid row number that exists in the table.\n");
				}
	
				if(characterVisualsTable.records[rowNumber].isEmpty)
				{
					console.log("The selected row is an empty record. Please select a non-empty row.\n");
				}
			}
			while(isNaN(rowNumber) || characterVisualsTable.header.recordCapacity <= rowNumber || characterVisualsTable.records[rowNumber].isEmpty || rowNumber < 0);

			ISON_FUNCTIONS.initGameSpecific(gameYear);

			gameYear >= FranchiseUtils.YEARS.M26 ? ISON_FUNCTIONS.writeZstdTable3IsonData(ison, characterVisualsTable, rowNumber) : ISON_FUNCTIONS.writeTable3IsonData(ison, characterVisualsTable, rowNumber);

		}
		else if(option === 5)
		{
			break;
		}

	}
	while(true);

	FranchiseUtils.EXIT_PROGRAM();
})();
