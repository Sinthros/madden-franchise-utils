// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGames = [
	FranchiseUtils.YEARS.M25,
	FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log(`This program will randomize sleeve temperature for players in a franchise file to better reflect when players wear sleeves in cold weather. Madden ${FranchiseUtils.formatListString(validGames)} are supported\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGames);
const gameYear = franchise.schema.meta.gameYear;
const tables = FranchiseUtils.getTablesObject(franchise);

function setSleeveTemperature(playerRecord)
{
	const position = playerRecord['Position'];

	if(FranchiseUtils.OLINE_POSITIONS.includes(position) || FranchiseUtils.DEFENSIVE_LINE_POSITIONS.includes(position) || position === "LS")
	{
		let floor = 15;

		if(playerRecord['ToughnessRating'] >= 90)
		{
			floor = 5;
		}

		playerRecord['PLYR_SLEEVETEMPERATURE'] = FranchiseUtils.getRandomNumber(floor, 30);
		return;
	}
	else if(FranchiseUtils.LINEBACKER_POSITIONS.includes(position))
	{
		playerRecord['PLYR_SLEEVETEMPERATURE'] = FranchiseUtils.getRandomNumber(20, 40);
		return;
	}

	playerRecord['PLYR_SLEEVETEMPERATURE'] = FranchiseUtils.getRandomNumber(30, 45);

}

franchise.on('ready', async function () {
    // Get required tables	
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	const tablesList = [playerTable];

	await FranchiseUtils.readTableRecords(tablesList);

	const includeDraftClass = FranchiseUtils.getYesOrNo("\nWould you like to update sleeve temperatures for draft class players? Enter yes or no.");
	let draftClassOnly = false;


	if(includeDraftClass)
	{
		draftClassOnly = FranchiseUtils.getYesOrNo("\nWould you like to only update draft class players and not active players? Enter yes or no.");
	}

	// Number of records
	const playerCount = playerTable.header.recordCapacity;

	for (let i = 0; i < playerCount; i++) 
	{
		if(draftClassOnly)
		{
			if(!FranchiseUtils.isValidDraftPlayer(playerTable.records[i]))
			{
				continue;
			}
		}
		else if(!FranchiseUtils.isValidPlayer(playerTable.records[i], {includeDraftPlayers: includeDraftClass}))
		{
			continue;
		}

		// Update the player's sleeve temperature
		setSleeveTemperature(playerTable.records[i]);
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nSleeve temperatures updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  