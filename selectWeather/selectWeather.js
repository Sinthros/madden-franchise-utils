// Required modules
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Print tool header message
console.log("This program will allow you to update the weather for a game in your Madden 24 or 25 franchise file. This tool must be run during the regular season or playoffs.\n")

// Set up franchise file
const validGameYears = [
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = parseInt(franchise.schema.meta.gameYear);

// List of wind options
const windOptions = ['Calm', 'LightBreeze', 'Moderate', 'VeryWindy'];

// Random selection of wind for each weather type
const snowRand = FranchiseUtils.getRandomNumber(2,3);
const rainRand = FranchiseUtils.getRandomNumber(1,3);
const clearRand = FranchiseUtils.getRandomNumber(0,3);

// List of available weather options
let weatherOptions = ['Snow', 'Rain (Warm)', 'Rain (Cold)', 'Clear (Warm)', 'Clear (Cold)', 'Overcast (Warm)', 'Overcast (Cold)'];

// Weather values for each option in order of Wind, Precipitation, CloudCover, Weather, and Temperature values
let snowValues = [windOptions[snowRand], gameYear >= FranchiseUtils.YEARS.M25 ? 'Medium' : 'Heavy', 'Overcast', 'Snow', 0]; // Override for M25 precipitation requirement
let rainWarmValues = [windOptions[rainRand], 'Heavy', 'Overcast', 'Rain', 70];
let rainColdValues = [windOptions[rainRand], 'Heavy', 'Overcast', 'Rain', 35];
let clearWarmValues = [windOptions[clearRand], 'None', 'None', 'Clear', 70];
let clearColdValues = [windOptions[clearRand], 'None', 'None', 'Clear', 30];
let overcastWarmValues = [windOptions[clearRand], 'None', 'Overcast', 'Overcast', 70];
let overcastColdValues = [windOptions[clearRand], 'None', 'Overcast', 'Overcast', 30];

/**
 * Prompts the user for a custom temperature within inclusive bounds and sets it if valid
 * 
 * @param {Array} weatherValues The list of weather values to update 
 * @param {number} lowerBound The lower bound for the temperature selection 
 * @param {number} upperBound The upper bound for the temperature selection
 */
function temperatureChoice(weatherValues, lowerBound, upperBound)
{
	// Loop until a valid temperature is entered
	while(true)
	{
		// Prompt the user for a temperature within the specified range
		console.log(`\nPlease enter a temperature between ${lowerBound} and ${upperBound} degrees or enter nothing to keep the default of ${weatherValues[4]} degrees: `);
		let tempChoice = prompt();

		// If the user entered nothing, use the existing default temperature
		if(tempChoice === '')
		{
			console.log("Using default temperature.");
			break;
		}

		// Convert the user input to an integer
		tempChoice = parseInt(tempChoice);

		// If the temperature is within the specified range, set it and break out of the loop
		if(tempChoice >= lowerBound && tempChoice <= upperBound)
		{
			weatherValues[4] = tempChoice;
			break;
		}
		else // If the temperature is outside the specified range, inform the user and continue the loop
		{
			console.log("Invalid temperature. Please try again.");
			continue;
		}
	}
}

/**
 * Applies a list of weather values to a game
 * 
 * @param {Array} weatherValues The list of weather values to apply
 * @param {number} game The row number of the game to update 
 * @param {Object} seasonGameTable The season game table object 
 */
async function adjustWeather(weatherValues, game, seasonGameTable)
{
	// Set all needed weather values
	seasonGameTable.records[game]['Wind'] = weatherValues[0];
	seasonGameTable.records[game]['Precipitation'] = weatherValues[1];
	seasonGameTable.records[game]['CloudCover'] = weatherValues[2];
	seasonGameTable.records[game]['Weather'] = weatherValues[3];
	seasonGameTable.records[game]['Temperature'] = weatherValues[4];
};

/**
 * Updates the roof status of a stadium
 * 
 * @param {string} state The state to set the roof to ('Open' or 'Closed')
 * @param {number} game The row number of the game to update
 * @param {number} homeTeam The row number of the home team
 * @param {Object} seasonGameTable The season game table object
 * @param {Object} teamTable The team table object
 */
async function handleRoof(state, game, homeTeam, seasonGameTable, teamTable)
{
	if(state === 'Open')
	{
		const openStadiumRef = teamTable.records[homeTeam]['AltStadium'];
		seasonGameTable.records[game]['Stadium'] = openStadiumRef;
		return;
	}

	seasonGameTable.records[game]['Stadium'] = FranchiseUtils.ZERO_REF;
};


franchise.on('ready', async function () {
	
    // Get required tables
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);

	// Read required tables
	await FranchiseUtils.readTableRecords([teamTable, seasonInfoTable, seasonGameTable]);

	// Validate that the file is in a valid week

	// List of week types when the tool can be run
	const validWeekTypes = ['RegularSeason','WildcardPlayoff','DivisionalPlayoff','ConferencePlayoff','SuperBowl'];

	// Get the current week type and number
	const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	
	// Check if file is in regular season or playoffs, exit if not
	if (!validWeekTypes.includes(currentWeekType)) 
	{
		console.log("Selected file is not in a valid week. Only Franchise Files in the regular season or playoffs are supported by this tool.")
		FranchiseUtils.EXIT_PROGRAM();
	}
	
	// Number of rows in the SeasonGame table
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity;
	
	// Variable to hold user's selected game
	let selectedGame;

	// List of rows that are valid for the current week
	let allowedGameRows = [];
	
	// Print available games for the current week
	console.log("\nAvailable Games:");
	
	// Iterate through the schedule table
	for (j=0; j < numRowsSeasonGame; j++) 
	{ 
        // If an empty row or invalid game, skip this row
		if (seasonGameTable.records[j].isEmpty || (seasonGameTable.records[j]['IsPractice'] === true)) 
		{ 
			continue;
        }
		
		// If it's the regular season
		if(currentWeek >= 0 && currentWeek < 18)
		{
			// If the current game is a regular season game for the current week
			if((seasonGameTable.records[j]['SeasonWeekType'] === 'RegularSeason') && (parseInt(seasonGameTable.records[j]['SeasonWeek']) === currentWeek))
			{
				// Get the home team ref
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];

				// If it's the zero ref, this is somehow not a real game, so skip it
				if(homeTeamBinVal === FranchiseUtils.ZERO_REF)
				{
					continue;
				}

				// Convert the home team ref to the row number
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				// Convert the away team ref to the row number
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				// Print the game and the index
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);

				// Add the row to the list of valid games
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 18) // If it's the wildcard round
		{
			// If the current game is a wildcard playoff game
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'WildcardPlayoff')
			{
				// Get the home team ref
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];

				// If it's the zero ref, this is somehow not a real game, so skip it
				if(homeTeamBinVal === FranchiseUtils.ZERO_REF)
				{
					continue;
				}

				// Convert the home team ref to the row number
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				// Convert the away team ref to the row number
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				// Print the game and the index
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);

				// Add the row to the list of valid games
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 19) // If it's the divisional round
		{
			// If the current game is a divisional playoff game
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'DivisionalPlayoff')
			{
				// Get the home team ref
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];

				// If it's the zero ref, this is somehow not a real game, so skip it
				if(homeTeamBinVal === FranchiseUtils.ZERO_REF)
				{
					continue;
				}

				// Convert the home team ref to the row number
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				// Convert the away team ref to the row number
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				// Print the game and the index
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);

				// Add the row to the list of valid games
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 20) // If it's the conference championship round
		{
			// If the current game is a conference playoff game
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'ConferencePlayoff')
			{
				// Get the home team ref
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];

				// If it's the zero ref, this is somehow not a real game, so skip it
				if(homeTeamBinVal === FranchiseUtils.ZERO_REF)
				{
					continue;
				}

				// Convert the home team ref to the row number
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				// Convert the away team ref to the row number
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				// Print the game and the index
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);

				// Add the row to the list of valid games
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 22) // If it's the Super Bowl
		{
			// If the current game is the Super Bowl
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'SuperBowl')
			{
				// Get the home team ref
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];

				// If it's the zero ref, this is somehow not a real game, so skip it
				if(homeTeamBinVal === FranchiseUtils.ZERO_REF)
				{
					continue;
				}

				// Convert the home team ref to the row number
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				// Convert the away team ref to the row number
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				// Print the game and the index
				console.log(`${j} - ${awayTeamName} vs ${homeTeamName}`);

				// Add the row to the list of valid games
				allowedGameRows.push(j);
			}
		}
		else // Somehow not a regular season or playoff week despite checks, so inform user and exit
		{
			console.log("No games available this week.");
			FranchiseUtils.EXIT_PROGRAM();
		}
    }
	
	// Loop until a valid game is selected
	while(true)
	{
		// Get the user's game choice
		console.log("\nPlease enter the number corresponding to the game you would like to edit:");
		selectedGame = prompt();

		// If the selected game is in the list of valid games, break out of the loop
		if(allowedGameRows.includes(parseInt(selectedGame)))
		{
			break;
		}

		// If the selected game is not in the list of valid games, inform the user and continue the loop
		console.log("Invalid selection.");
	}

	// Convert the selected game to an integer
	const gameRow = parseInt(selectedGame);


	// Special case for teams with hybrid stadiums
	let homeTeamBinVal = seasonGameTable.records[gameRow]['HomeTeam'];
	const homeTeamRowBinVal = homeTeamBinVal.slice(15);
	const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
	const validStadiums = [teamTable.records[homeTeamRowNum]['AltStadium'], FranchiseUtils.ZERO_REF];

	// Make sure the home team has a retractable stadium and that the game is not at a neutral site (ex: international games) or Super Bowl
	if(teamTable.records[homeTeamRowNum]['AltStadium'] !== FranchiseUtils.ZERO_REF && validStadiums.includes(seasonGameTable.records[gameRow]['Stadium']) && currentWeekType !== 'SuperBowl')
	{
		// If the roof is closed, remove the option to choose weather
		if(seasonGameTable.records[gameRow]['Stadium'] === FranchiseUtils.ZERO_REF)
		{
			console.log("\nThis game is in a stadium with a retractable roof. The roof is currently closed, so you can only choose between closed and open roof.");
			weatherOptions = [];
			weatherOptions.push("Closed Roof");
			weatherOptions.push("Open Roof");
		}
		else // Otherwise give the option to choose weather or roof status
		{
			weatherOptions.push("Closed Roof");
			weatherOptions.push("Open Roof");

			console.log("\nThis game is in a stadium with a retractable roof. You can also choose to have the roof open or closed.");
		}
	}
	
	// Display the available weather options
	console.log("\nAvailable Weather Options:");
	for(i = 0; i < weatherOptions.length; i++)
	{
		console.log(`${i} - ${weatherOptions[i]}`);
	}
	
	// Get the user's selected weather option
	let selectedWeather;
	
	// Loop until a valid weather option is selected
	while(true)
	{
		console.log("\nPlease enter the number corresponding to the weather you would like:");
		selectedWeather = prompt();
		
		// If the selected weather is in the list of valid options, break out of the loop
		if(parseInt(selectedWeather) >= 0 && parseInt(selectedWeather) < weatherOptions.length)
		{
			break;
		}

		// If the selected weather is not in the list of valid options, inform the user and continue the loop
		console.log("Invalid selection.");
	}
	
	// Convert the weather integer into the corresponding option
	const weatherChoice = weatherOptions[parseInt(selectedWeather)];

	// Apply the right weather option based on the user's choice
	if(weatherChoice === 'Snow')
	{
		temperatureChoice(snowValues, -100, 31);
		await adjustWeather(snowValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Rain (Warm)')
	{
		temperatureChoice(rainWarmValues, 51, 100);
		await adjustWeather(rainWarmValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Rain (Cold)')
	{
		temperatureChoice(rainColdValues, 32, 50);
		await adjustWeather(rainColdValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Clear (Warm)')
	{
		temperatureChoice(clearWarmValues, 32, 100);
		await adjustWeather(clearWarmValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Clear (Cold)')
	{
		temperatureChoice(clearColdValues, -100, 31);
		await adjustWeather(clearColdValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Overcast (Warm)')
	{
		temperatureChoice(overcastWarmValues, 32, 100);
		await adjustWeather(overcastWarmValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Overcast (Cold)')
	{
		temperatureChoice(overcastColdValues, -100, 31);
		await adjustWeather(overcastColdValues, gameRow, seasonGameTable);
	}
	else if(weatherChoice === 'Closed Roof')
	{
		await handleRoof('Closed', gameRow, homeTeamRowNum, seasonGameTable, teamTable);
	}
	else if(weatherChoice === 'Open Roof')
	{
		await handleRoof('Open', gameRow, homeTeamRowNum, seasonGameTable, teamTable);
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nWeather updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  