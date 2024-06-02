// Required modules
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Print tool header message
console.log("This program will update your Madden 24 franchise file to use the 6 team playoff format. This tool must be run during wildcard week.\n")

// Set up franchise file
const gameYear = 24;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

franchise.on('ready', async function () {
    // Get required tables
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);

	// Read required tables
	await FranchiseUtils.readTables([teamTable, seasonInfoTable, seasonGameTable]);

	// Validate that the file is in the correct week

	// Get current week
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	
	// Check if file is in wildcard round, exit if not
	if (currentWeek !== 18)
	{
		console.log("\nSelected file is not in the Wildcard Round. Only Franchise Files in the Wildcard Round are supported by this tool.")
		FranchiseUtils.EXIT_PROGRAM();
	}

	// Array to store the rows of the teams that are the 2 seed
	let twoSeedTeamRows = [];

	// Number of rows in the team table
    const numRowsTeam = teamTable.header.recordCapacity;

	// Iterate through the team table
    for (let i = 0; i < numRowsTeam; i++) 
	{ 
        // If an empty row, skip it
		if (teamTable.records[i].isEmpty) 
		{
        	continue;
        }

		// Get the seed of the team
        let teamSeed = parseInt(teamTable.records[i]['CurSeasonConfStanding']);

		// If the team is the 2 seed (zero-based), add it to the array
		if(teamSeed === 1)
		{
			twoSeedTeamRows.push(i);
		}
    }
	
	// Number of rows in the season game table
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity;

	// Iterate through the season game table
	for (let j = 0; j < numRowsSeasonGame; j++) 
	{ 
        // If an empty row, skip it
		if (seasonGameTable.records[j].isEmpty == true) 
		{ 
        	continue;
        }

		// If the game is a wildcard playoff game and the home team is the 2 seed, update the game type to offseason
        if(seasonGameTable.records[j]['SeasonWeekType'] === 'WildcardPlayoff')
		{
			// Get the home team ref and convert it to the row number
			let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
			let teamRowBinVal = homeTeamBinVal.slice(15);
			let homeTeamRowNum = await FranchiseUtils.bin2Dec(teamRowBinVal);
			
			// If the home team is the 2 seed, update the game type to offseason
			if(twoSeedTeamRows.includes(homeTeamRowNum))
			{
				seasonGameTable.records[j]['SeasonWeekType'] = 'OffSeason';
			}
		}
    }
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nPlayoff format updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  