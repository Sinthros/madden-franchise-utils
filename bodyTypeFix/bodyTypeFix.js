// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Print tool header message
console.log("This program will update player body types in a Madden 25 franchise file to better reflect their body size.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	const tablesList = [characterVisualsTable, playerTable];

	await FranchiseUtils.readTableRecords(tablesList);

	const includeDraftClass = FranchiseUtils.getYesOrNo("\nWould you like to also update body types for draft class players? Enter yes or no.");

	// Number of records
	const playerCount = playerTable.header.recordCapacity;

	for (let i = 0; i < playerCount; i++) 
	{
		if(!FranchiseUtils.isValidPlayer(playerTable.records[i], {includeDraftPlayers: includeDraftClass}))
		{
			continue;
		}
		
		// Leftover code from when we were using EA's formula
		/*
		const visualsRow = FranchiseUtils.bin2Dec(playerTable.records[i]['CharacterVisuals'].slice(15));

		// Get the player's JSON value from the visuals ISON
		const visualsJson = JSON.parse(characterVisualsTable.records[visualsRow]['RawData']);

		if(!visualsJson.hasOwnProperty("loadouts"))
		{
			continue;
		}*/

		// Update the player's body type
		playerTable.records[i]['CharacterBodyType'] = FranchiseUtils.generateBodyType(playerTable.records[i]);
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nBody types updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  