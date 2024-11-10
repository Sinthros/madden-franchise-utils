(async () => {
// Required modules
const fs = require('fs');
const prompt = require('prompt-sync')();
const path = require('path');
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Required lookups
const ratingTypes = (JSON.parse(fs.readFileSync(`lookupFiles/ratingTypes.json`, 'utf-8')));
const positionGroups = (JSON.parse(fs.readFileSync(`lookupFiles/positionGroups.json`, 'utf-8')));
const allPositions = (JSON.parse(fs.readFileSync(`lookupFiles/allPositions.json`, 'utf-8')));

// Supported game years
const validGameYears = [
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];

// Version number constant
const VERSION = 'v3.0';

// Print tool header message
console.log(`Welcome to MaddenSynth ${VERSION}! This is a customizable franchise scenario generator for Madden ${FranchiseUtils.formatListString(validGameYears)}.\n`);

// Set up franchise file
const gameYear = FranchiseUtils.getGameYear(validGameYears);
const franchise = await FranchiseUtils.selectFranchiseFileAsync(gameYear);
const tables = FranchiseUtils.getTablesObject(franchise);

// Validate file's game year
FranchiseUtils.validateGameYears(franchise, gameYear);

// Get required tables
const teamTable = franchise.getTableByUniqueId(tables.teamTable);
const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
const playerTable = franchise.getTableByUniqueId(tables.playerTable);

// Read required tables
await FranchiseUtils.readTableRecords([teamTable, seasonInfoTable, playerTable]);

// Globally accessed lists
const invalidPlayerStatuses = ['Draft','Retired','Deleted','None','Created','PracticeSquad'];
const teamsList = [];
const validTeamIndex = [];
let scenarios = [];

// Initial setup function calls
await loadTeams();
loadScenarios();

/**
 * Loads all teams from the team table into the global team list.
 */
async function loadTeams()
{
	// Iterate through all rows in the team table
	for(let i = 0; i < teamTable.header.recordCapacity; i++)
	{
		// List of team shortnames that represent rows that are not actual teams and should be ignored
		const shortNameBlacklist = ['NFC','AFC','FA'];
		
		// Skip empty/invalid rows
		if(teamTable.records[i].isEmpty || shortNameBlacklist.includes(teamTable.records[i]['ShortName']))
		{
			continue;
		}

		// Get the city and team name for the current team
		let cityName = teamTable.records[i]['LongName'];
		let teamName = teamTable.records[i]['DisplayName'];

		// Combine the city and team name to get the full team name
		let teamFullName = `${cityName} ${teamName}`;

		// Create a new object and store the team's key information in it
		let teamEntry = {
			teamName: teamFullName,
			teamAbbrev: teamTable.records[i]['ShortName'],
			teamIndex: teamTable.records[i]['TeamIndex'],
			teamRowNum: i
		};

		// Add the team object to the global list of teams
		teamsList.push(teamEntry);

		// Add the team index to the list of valid team indices
		validTeamIndex.push(teamEntry.teamIndex);
	}
}

/**
 * Loads all existing scenarios from file into the global scenarios list.
 */
function loadScenarios()
{
	// Name of the scenarios directory
	const scenariosDir = 'scenarios';

	// Check if the scenarios directory exists, and create it if it doesn't
	if(!fs.existsSync(scenariosDir))
	{
		fs.mkdirSync(scenariosDir);
	}

	// Read all files in the scenarios directory
	const scenarioFiles = fs.readdirSync(scenariosDir);

	// Counter for scenarios that failed to load
	let loadErrorCount = 0;

	// Iterate through each file in the scenarios directory
	scenarioFiles.forEach(file => {
		// New scenario object to store the scenario data
		let scenario;

		// Attempt to load the scenario from the file
		try
		{
			scenario = JSON.parse(fs.readFileSync(path.join(scenariosDir, file), 'utf-8'));
		}
		catch(error) // If it fails, increment the error count and continue to the next file
		{
			loadErrorCount++;
			return;
		}

		// Check if the scenario is a legacy scenario and convert it if necessary
		if(scenario.type === 'Rating Change')
		{
			// Convert the scenario to the new format if needed
			scenario = convertLegacyRatingScenario(scenario);

			// Save file after conversion
			fs.writeFileSync(path.join(scenariosDir, file), JSON.stringify(scenario, null, 2));
		}
		else if(scenario.type === 'Injury')
		{
			// Convert the scenario to the new format if needed
			scenario = convertLegacyInjuryScenario(scenario);

			// Save file after conversion
			fs.writeFileSync(path.join(scenariosDir, file), JSON.stringify(scenario, null, 2));
		}

		// Add the scenario to the global list of scenarios
		scenarios.push(scenario);
	});

	// If any scenarios failed to load, display a message with the number of failures
	if(loadErrorCount > 0)
	{
		console.log(`\nFailed to load ${loadErrorCount} scenarios. Check the scenarios folder for any invalid files.`);
	}

	// Display a message based on the number of scenarios loaded
	if(scenarios.length > 1)
	{
		console.log(`\nLoaded ${scenarios.length} scenarios.`);
	}
	else if(scenarios.length === 1)
	{
		console.log(`\nLoaded ${scenarios.length} scenario.`);
	}
	else
	{
		console.log("\nNo scenarios loaded. Create one to get started.");
	}
}

/**
 * Converts a legacy rating change scenario made on old versions of the tool to the new format
 * 
 * @param {Object} scenario The rating change scenario object
 * @returns {Object} The converted scenario object
 */
function convertLegacyRatingScenario(scenario)
{
	// If the scenario has a single rating and rating change property, convert it to the new object format
	if(scenario.hasOwnProperty('rating'))
	{
		scenario.ratings = [{
			rating: scenario.rating,
			ratingPrettyName: scenario.ratingPrettyName,
			ratingChange: scenario.ratingChange
		}];
		delete scenario.rating;
		delete scenario.ratingChange;
	}

	return scenario;
}

/**
 * Converts a legacy injury scenario made on old versions of the tool to the new format
 * 
 * @param {Object} scenario The injury scenario object
 * @returns {Object} The converted scenario object
 */
function convertLegacyInjuryScenario(scenario)
{
	// If the scenario does not have a position group bool, add it and set it to false
	if(!scenario.hasOwnProperty('usePositionGroup'))
	{
		scenario.usePositionGroup = false;
	}

	return scenario;
}

/**
 * Selects scenario(s) based on the user's input. 
 */
async function generateScenario()
{
	// If there are no scenarios, we can't proceed, so inform the user and return
	if(scenarios.length === 0)
	{
		console.log("\nThere are no scenarios loaded. Create one first to get started.");
		return;
	}
	
	// Counter to keep track of how many times we've tried to apply a scenario without success, to prevent infinite loops
	let recycleCount = 0;

	// Get from user how many scenarios they want to generate, then generate that many
	let numScenarios;
	do
	{
		console.log("\nEnter how many scenarios you want to generate: ");
		numScenarios = parseInt(prompt());
		
		// Check if the number of scenarios is valid
		if(numScenarios < 1)
		{
			console.log(`Please enter a number from 1-${scenarios.length}.`);
		}

		// Check if the number of scenarios to generate is greater than the number of scenarios loaded
		if(numScenarios > scenarios.length)
		{
			if(scenarios.length === 1)
			{
				console.log("There is only 1 scenario loaded. Please enter 1.");
			}
			else
			{
				console.log(`There are only ${scenarios.length} scenarios loaded. Please enter a number less than or equal to that.`);
			}
		}
	}
	while(numScenarios < 1 || numScenarios > scenarios.length); // Loop until a valid number is entered

	// Generate the specified number of scenarios
	for(let i = 0; i < numScenarios; i++)
	{
		// Shuffle the scenarios array for randomness
		await FranchiseUtils.shuffleArray(scenarios);

		// Variable to store the selected scenario
		let selectedScenario;

		// Loop until a valid scenario is selected
		while(true)
		{
			// Randomly choose a scenario from the shuffled list
			selectedScenario = scenarios[FranchiseUtils.getRandomNumber(0, scenarios.length - 1)];

			// If applicable, check if the scenario should be redrawn based on a random threshold
			if(selectedScenario.hasOwnProperty('useRandomThreshold') && selectedScenario.useRandomThreshold)
			{
				// Get the scenario's random threshold value
				const randomThreshold = selectedScenario.randomThreshold;

				// Get a random number between 1 and 50
				const randomNum = FranchiseUtils.getRandomNumber(1, 50);

				// If the threshold is not met, continue to the next iteration of the loop to redraw, otherwise break out of the loop
				if(randomNum < randomThreshold)
				{
					continue;
				}
				else
				{
					break;
				}
			}
			else // If the scenario does not have a random threshold, break out of the loop
			{
				break;
			}
		}

		// Print a separator between scenarios if it's not the first one
		if(i > 0)
		{
			console.log("\n----------------------------------------");
		}

		// Keep track of whether the scenario was successfully applied or not
		let success = false;

		// Handle the scenario based on its type, and store the result
		if(selectedScenario.type === 'Injury')
		{
			success = await handleInjuryScenario(selectedScenario);
		}
		else if(selectedScenario.type === 'Rating Change')
		{
			success = await handleRatingChangeScenario(selectedScenario);
		}
		else if(selectedScenario.type === 'Suspension')
		{
			success = await handleSuspensionScenario(selectedScenario);
		}

		// If the scenario was not successfully applied
		if(!success)
		{
			// Increment the recycle count
			recycleCount++;

			// If we've tried to apply a scenario more than 50 times without success, skip it and move on to the next iteration of the loop
			if(recycleCount > 50)
			{
				console.log("\nNo scenarios could be applied. Skipping and moving on.");

				// Reset the recycle count for the next iteration
				recycleCount = 0;

				continue;
			}

			// Inform the user that the scenario was skipped
			console.log(`\nScenario "${selectedScenario.title}" skipped as there were no valid players found to apply it to. Trying again.`);

			// Decrement the loop counter to try to generate an i-th scenario again
			i--;
		}
		else // If the scenario was successfully applied
		{
			// Reset the recycle count for the next iteration
			recycleCount = 0;
		}
	}
}

/**
 * Applies an injury scenario to a player
 * 
 * @param {Object} scenario The injury scenario object to apply
 * @returns {boolean} True if the scenario was successfully applied, false if not
 */
async function handleInjuryScenario(scenario)
{
	// Variable to store the row number of the randomly selected player
	let randPlayerRow;

	// Counter to keep track of how many times we've tried to find a valid player without success, to prevent infinite loops
	let randCount = 0;

	// Loop until a valid player is found
	do
	{
		// If we've tried to find a player more than 50 times without success, return false as we can't apply the scenario
		if(randCount > 50)
		{
			return false;
		}

		// If the scenario is for a specific position group
		if(scenario.usePositionGroup)
		{
			// If the scenario has selection parameters
			if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
			{
				// Loop until a valid player is found that meets the selection parameters and is in the specified position group
				do
				{
					// Get a random signed player that meets the selection parameters
					randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);

					// If no valid player is found, increment the random count and break out of the loop
					if(randPlayerRow === -1)
					{
						randCount++;
						break;
					}
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']) && playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
			else // If the scenario does not have selection parameters
			{
				// Loop until a valid player is found that is in the specified position group
				do
				{
					randPlayerRow = await getRandomSignedPlayer();
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']) && playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
		}
		else // If the scenario is not for a specific position group
		{
			// If the scenario has selection parameters
			if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
			{
				// Loop until a valid player is found that meets the selection parameters
				do
				{
					// Get a random signed player that meets the selection parameters
					randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);

					// If no valid player is found, increment the random count and break out of the loop
					if(randPlayerRow === -1)
					{
						randCount++;
						break;
					}
				}
				while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
			else // If the scenario does not have selection parameters
			{
				// Loop until a valid player is found
				do
				{
					randPlayerRow = await getRandomSignedPlayer();
				}
				while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
		}
	}
	while(randPlayerRow === -1)
	
	// Get the team object for the randomly selected player
	let randTeam = teamsList.find(team => team.teamIndex === playerTable.records[randPlayerRow]['TeamIndex']);

	// Print a message describing the scenario and the player it will be applied to
	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']} will be out for ${scenario.weeksOut} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = scenario.injuryType;
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.weeksOut;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.weeksOut;

	// Return true to indicate that the scenario was successfully applied
	return true;
}

/**
 * Applies a rating change scenario to a player
 * 
 * @param {Object} scenario The rating change scenario object to apply
 * @returns {boolean} True if the scenario was successfully applied, false if not
 */
async function handleRatingChangeScenario(scenario)
{
	// Variable to store the row number of the randomly selected player
	let randPlayerRow;

	// Counter to keep track of how many times we've tried to find a valid player without success, to prevent infinite loops
	let randCount = 0;

	// Loop until a valid player is found
	do
	{
		// If we've tried to find a player more than 50 times without success, return false as we can't apply the scenario
		if(randCount > 50)
		{
			return false;
		}

		// If the scenario has selection parameters
		if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
		{
			// If the scenario is for a specific position group
			if(scenario.usePositionGroup)
			{
				// Loop until a valid player is found that meets the selection parameters and is in the specified position group
				do
				{
					// Get a random signed player that meets the selection parameters
					randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);

					// If no valid player is found, increment the random count and break out of the loop
					if(randPlayerRow === -1)
					{
						randCount++;
						break;
					}
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']));
			}
			else // If the scenario is not for a specific position group
			{
				// Get a valid player that meets the selection parameters
				randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);
			}
		}
		else // If the scenario does not have selection parameters
		{
			// If the scenario is for a specific position group
			if(scenario.usePositionGroup)
			{
				// Loop until a valid player is found that is in the specified position group
				do
				{
					randPlayerRow = await getRandomSignedPlayer();
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']));
			}
			else // If the scenario is not for a specific position group
			{
				// Get a random signed player
				randPlayerRow = await getRandomSignedPlayer();
			}
		}
	}
	while(randPlayerRow === -1)

	// Get the team object for the randomly selected player
	let randTeam = teamsList.find(team => team.teamIndex === playerTable.records[randPlayerRow]['TeamIndex']); 

	// Print a message describing the scenario and the player it will be applied to
	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']}'s ratings will change as listed below:`);
	
	// List of ratings that only use one column in the player table
	const singleHeaderRatings = ['Morale', 'Weight']

	// Iterate through each rating in the scenario's ratings array and apply the change to the player
	scenario.ratings.forEach(rating => {
		
		// Separately Handle ratings that only have one header
		if(singleHeaderRatings.includes(rating.ratingPrettyName))
		{
			// Get the pretty name of the rating
			let ratingPrettyName = rating.ratingPrettyName;
			
			// Variable to store the new original rating
			let newOriginalRating;

			// If the rating is Morale, normalize to be between 0 and 100
			if(ratingPrettyName === 'Morale')
			{
				newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][rating.rating] + rating.ratingChange, 100), 0);
			}
			else if (ratingPrettyName === 'Weight') // If the rating is Weight, normalize to be between 0 and 240
			{
				newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][rating.rating] + rating.ratingChange, 240), 0);
			}
			else // Otherwise, normalize to be between 0 and 99
			{
				newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][rating.rating] + rating.ratingChange, 99), 0);
			}

			// Variable to store the sign of the rating change
			let ratingChangeSign;

			// Determine the sign of the rating change
			if(rating.ratingChange < 0)
			{
				ratingChangeSign = '-';
			}
			else
			{
				ratingChangeSign = '+';
			}

			// Display the rating name and change from old to new
			if(ratingPrettyName === 'Weight')
			{
				// Weight is stored as a value from 0-240, but displayed as 160-400
				console.log(`${ratingPrettyName}: ${ratingChangeSign}${Math.abs(rating.ratingChange)} (${(playerTable.records[randPlayerRow][rating.rating] - rating.ratingChange) + 160} -> ${playerTable.records[randPlayerRow][rating.rating] + 160})`);
			}
			else
			{
				console.log(`${ratingPrettyName}: ${ratingChangeSign}${Math.abs(rating.ratingChange)} (${playerTable.records[randPlayerRow][rating.rating] - rating.ratingChange} -> ${playerTable.records[randPlayerRow][rating.rating]})`);
			}

			// Continue to the next rating
			return;
		}
		
		// Get the pretty name of the rating
		let ratingPrettyName = rating.ratingPrettyName;

		// Create the original rating header based on the rating name
		let originalRatingHeader = `Original${rating.rating}`;

		// Store the morale boost amount
		let moraleDiff = playerTable.records[randPlayerRow][rating.rating] - playerTable.records[randPlayerRow][originalRatingHeader];

		// Calculate the new original rating and normalize to be between 0 and 99
		let newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][originalRatingHeader] + rating.ratingChange, 99), 0);

		// Calculate the new morale affected rating and normalize to be between 0 and 99
		let newRating = Math.max(Math.min(newOriginalRating + moraleDiff, 99), 0);

		// Update the original rating and set the morale affected rating to the new rating + the morale boost amount
		playerTable.records[randPlayerRow][originalRatingHeader] = newOriginalRating;
		playerTable.records[randPlayerRow][rating.rating] = newRating;

		// Variable to store the sign of the rating change
		let ratingChangeSign;

		// Determine the sign of the rating change
		if(rating.ratingChange < 0)
		{
			ratingChangeSign = '-';
		}
		else
		{
			ratingChangeSign = '+';
		}

		// Display the rating name and change from old to new
		console.log(`${ratingPrettyName}: ${ratingChangeSign}${Math.abs(rating.ratingChange)} (${playerTable.records[randPlayerRow][originalRatingHeader] - rating.ratingChange} -> ${playerTable.records[randPlayerRow][originalRatingHeader]})`);

	});

	// Store current overall and archetype for comparison
	const currentOverall = playerTable.records[randPlayerRow]['OverallRating'];
	const currentArchetype = playerTable.records[randPlayerRow]['PlayerType'];

	// Recalculate overall and archetype to account for new ratings
	const {newOverall, newArchetype} = FranchiseUtils.calculateBestOverall(playerTable.records[randPlayerRow]);
	playerTable.records[randPlayerRow]['OverallRating'] = newOverall;
	playerTable.records[randPlayerRow]['PlayerType'] = newArchetype;

	// Display new overall if it is different from before
	if(newOverall !== currentOverall)
	{
		console.log(`\nNew Overall: ${newOverall} OVR`);
	}

	// Display new archetype if it is different from before
	if(newArchetype !== currentArchetype)
	{
		console.log(`New Archetype: ${newArchetype}`);
	}

	// Return true to indicate that the scenario was successfully applied
	return true;
}

/**
 * Applies a suspension scenario to a player
 * 
 * @param {Object} scenario The suspension scenario object to apply 
 * @returns {boolean} True if the scenario was successfully applied, false if not
 */
async function handleSuspensionScenario(scenario)
{
	// Variable to store the row number of the randomly selected player
	let randPlayerRow;

	// Counter to keep track of how many times we've tried to find a valid player without success, to prevent infinite loops
	let randCount = 0;

	// Loop until a valid player is found
	do
	{
		// If we've tried to find a player more than 50 times without success, return false as we can't apply the scenario
		if(randCount > 50)
		{
			return false;
		}

		// If the scenario has selection parameters
		if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
		{
			// Loop until a valid player is found that meets the selection parameters
			do
			{
				// Get a random signed player that meets the selection parameters
				randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);

				// If no valid player is found, increment the random count and break out of the loop
				if(randPlayerRow === -1)
				{
					randCount++;
					break;
				}
			}
			while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
		}
		else // If the scenario does not have selection parameters
		{
			// Loop until a valid player is found
			do
			{
				// Get a random signed player
				randPlayerRow = await getRandomSignedPlayer();
			}
			while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
		}
	}
	while(randPlayerRow === -1);

	// Get the team object for the randomly selected player
	let randTeam = teamsList.find(team => team.teamIndex === playerTable.records[randPlayerRow]['TeamIndex']);

	// Print a message describing the scenario and the player it will be applied to
	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']} is suspended for ${scenario.suspensionLength} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = 'ElbowDislocatedSeveralGames';
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.suspensionLength;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.suspensionLength;

	// Return true to indicate that the scenario was successfully applied
	return true;
}

/**
 * Randomly selects a player who is signed to a team
 * 
 * @returns {number} The row number of a randomly selected signed player
 */
async function getRandomSignedPlayer()
{
	// List of row numbers of signed players
	let playerRows = [];

	// Iterate through all rows in the player table
	for(let i = 0; i < playerTable.header.recordCapacity; i++)
	{
		// Skip empty/invalid rows, players not on teams, and players with invalid contract statuses
		if(playerTable.records[i].isEmpty || !validTeamIndex.includes(playerTable.records[i]['TeamIndex']) || invalidPlayerStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
		}

		// Add the row number to the list of signed players
		playerRows.push(i);
	}

	// Randomly select a row number from the list of signed players
	return playerRows[FranchiseUtils.getRandomNumber(0, playerRows.length - 1)];
}

// This function randomly selects a player who is signed to a team and meets the specified selection parameters
/**
 * Randomly selects a player who is signed to a team and meets the specified selection parameters
 * 
 * @param {Object} selectionParameters The selection parameters object to verify against
 * @returns {number} The row number of a randomly selected signed player that meets the selection parameters, or -1 if no valid player is found
 */
async function getRandomSignedPlayerWithParameters(selectionParameters)
{
	// List of row numbers of signed players that meet the selection parameters
	let playerRows = [];

	// Iterate through all rows in the player table
	for(let i = 0; i < playerTable.header.recordCapacity; i++)
	{
		// Skip empty/invalid rows, players not on teams, and players with invalid contract statuses
		if(playerTable.records[i].isEmpty || !validTeamIndex.includes(playerTable.records[i]['TeamIndex']) || invalidPlayerStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
		}

		// Variable to store whether the player meets all selection parameters
		let validPlayer = true;

		// Iterate through each selection parameter
		selectionParameters.forEach(param => {
			// If the player does not meet the range of the parameter, set their validity to false
			if(playerTable.records[i][param.type] < param.min || playerTable.records[i][param.type] > param.max)
			{
				validPlayer = false;
			}
		});

		// If the player meets all selection parameters, add their row number to the list of valid players
		if(validPlayer)
		{
			playerRows.push(i);
		}
	}

	// If no valid players are found, return -1
	if(playerRows.length === 0)
	{
		return -1;
	}

	// Randomly select a row number from the list of signed players that meet the selection parameters
	return playerRows[FranchiseUtils.getRandomNumber(0, playerRows.length - 1)];

}

/**
 * Prompts the user to create a new scenario and saves it to a file
 */
async function createScenario()
{
	// List of scenario types
	const scenarioTypes = ['Injury', 'Suspension', 'Rating Change'];

	// Display the list of scenario types to the user
	console.log("\nScenario types:");
	scenarioTypes.forEach((type, index) => {
		console.log(`${index} - ${type}`);
	});

	// Get the user's choice of scenario type
	let scenarioTypeChoice;
	do
	{
		console.log("\nEnter the number for the type you want: ");
		scenarioTypeChoice = scenarioTypes[parseInt(prompt())];
		if(!scenarioTypes.includes(scenarioTypeChoice))
		{
			console.log("Invalid choice. Please try again.");
		}
	}
	while(!scenarioTypes.includes(scenarioTypeChoice));

	// Variable to store the new scenario object
	let newScenario;

	// Call the appropriate creation function based on the user's choice of scenario type
	if(scenarioTypeChoice === 'Injury')
	{
		newScenario = await createInjuryScenario();
	}
	else if(scenarioTypeChoice === 'Suspension')
	{
		newScenario = await createSuspensionScenario();
	}
	else if(scenarioTypeChoice === 'Rating Change')
	{
		newScenario = await createRatingChangeScenario();
	}

	// Handle all global scenario properties
	console.log("\nEnter a title for the scenario:");
	newScenario.title = prompt();

	console.log("\nEnter a description for the scenario:");
	newScenario.description = prompt();

	newScenario.useRandomThreshold = FranchiseUtils.getYesOrNo("\nDo you want to apply a random threshold to this scenario? (yes/no)");

	// If the user wants to apply a random threshold, get the threshold value
	if(newScenario.useRandomThreshold)
	{
		console.log("\nEnter the random threshold:");
		newScenario.randomThreshold = parseInt(prompt());
	}

	newScenario.hasSelectionParameters = FranchiseUtils.getYesOrNo("\nDo you want to apply player selection parameters to this scenario? (yes/no)");

	// If the user wants to apply selection parameters, get them
	if(newScenario.hasSelectionParameters)
	{
		newScenario.selectionParameters = await getSelectionParameters();
	}

	// Add the new scenario to the global list of scenarios
	scenarios.push(newScenario);

	// Save the scenario object to a file named after the title (without spaces or special characters)
	let scenarioFileName = newScenario.title.replace(/[^a-zA-Z0-9]/g, '');

	// If the filename already exists, append a number to the end of the filename
	let fileNum = 2;
	while(fs.existsSync(`scenarios/${scenarioFileName}.json`))
	{
		scenarioFileName = `${scenarioFileName}${fileNum}`;
		fileNum++;
	}

	// Write the scenario object to a file`
	fs.writeFileSync(`scenarios/${scenarioFileName}.json`, JSON.stringify(newScenario, null, 2));

	// Inform the user that the scenario was created and saved to a file
	console.log("\nScenario created successfully and saved to file.");
}

// This function gets the selection parameters for a scenario from the user
async function getSelectionParameters(scenario)
{
	// List of selection parameter options
	const parameterOptions = ['Age', 'Overall', 'Injury Rating', 'Awareness Rating', 'Morale', 'Other Rating'];

	// Variable to store the user's choice
	let userChoice;

	// List to store the chosen selection parameters
	let selectionParameters = [];

	// Loop until the user is finished adding selection parameters
	do
	{
		// Display the list of selection parameter options to the user
		console.log("\nSelection Parameter Options:");
		parameterOptions.forEach((param, index) => {
			console.log(`${index} - ${param}`);
		});

		// Get the user's choice of selection parameter
		console.log("\nEnter the number for the parameter you want to add, or nothing if you are finished: ");
		userChoice = prompt();

		// If the user enters nothing, break out of the loop
		if(userChoice === '')
		{
			break;
		}

		// Parse the user's choice as an integer
		userChoice = parseInt(userChoice);

		// If the user's choice is invalid, inform them and continue to the next iteration of the loop
		if(userChoice < 0 || userChoice >= parameterOptions.length)
		{
			console.log("Invalid choice. Please try again.");
			continue;
		}

		// Get the chosen parameter from the list of options
		const parameterChoice = parameterOptions[userChoice];

		// Variable to store the new selection parameter object
		let newParameter = {};

		// Handle the parameter based on the user's choice
		if(parameterChoice === 'Age')
		{
			newParameter.type = 'Age';
			
			do
			{
				console.log("\nEnter the minimum age: ");
				newParameter.min = parseInt(prompt());
				if(newParameter.min < 0)
				{
					console.log("Please enter a positive number.");
				}
			}
			while(newParameter.min < 0);

			do
			{
				console.log("\nEnter the maximum age: ");
				newParameter.max = parseInt(prompt());
				if(newParameter.max < 0)
				{
					console.log("Please enter a positive number.");
				}

				if(newParameter.max < newParameter.min)
				{
					console.log("Maximum age must be greater than or equal to minimum age.");
				}
			}
			while(newParameter.max < 0 || newParameter.max < newParameter.min);
		
		}
		else if(parameterChoice === 'Overall')
		{
			newParameter.type = 'OverallRating';
			
			do
			{
				console.log("\nEnter the minimum overall: ");
				newParameter.min = parseInt(prompt());
				if(newParameter.min < 0 || newParameter.min > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}
			}
			while(newParameter.min < 0 || newParameter.min > 99);

			do
			{
				console.log("\nEnter the maximum overall: ");
				newParameter.max = parseInt(prompt());
				if(newParameter.max < 0 || newParameter.max > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}

				if(newParameter.max < newParameter.min)
				{
					console.log("Maximum overall must be greater than or equal to minimum overall.");
				}
			}
			while(newParameter.max < 0 || newParameter.max < newParameter.min || newParameter.max > 99);
		
		}
		else if(parameterChoice === 'Injury Rating')
		{
			newParameter.type = 'InjuryRating';

			do
			{
				console.log("\nEnter the minimum injury rating: ");
				newParameter.min = parseInt(prompt());
				if(newParameter.min < 0 || newParameter.min > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}
			}
			while(newParameter.min < 0 || newParameter.min > 99);

			do
			{
				console.log("\nEnter the maximum injury rating: ");
				newParameter.max = parseInt(prompt());
				if(newParameter.max < 0 || newParameter.max > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}

				if(newParameter.max < newParameter.min)
				{
					console.log("Maximum injury rating must be greater than or equal to injury rating.");
				}
			}
			while(newParameter.max < 0 || newParameter.max < newParameter.min || newParameter.max > 99);
		}
		else if(parameterChoice === 'Awareness Rating')
		{
			newParameter.type = 'AwarenessRating';

			do
			{
				console.log("\nEnter the minimum awareness rating: ");
				newParameter.min = parseInt(prompt());
				if(newParameter.min < 0 || newParameter.min > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}
			}
			while(newParameter.min < 0 || newParameter.min > 99);

			do
			{
				console.log("\nEnter the maximum awareness rating: ");
				newParameter.max = parseInt(prompt());
				if(newParameter.max < 0 || newParameter.max > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}

				if(newParameter.max < newParameter.min)
				{
					console.log("Maximum awareness rating must be greater than or equal to awareness rating.");
				}
			}
			while(newParameter.max < 0 || newParameter.max < newParameter.min || newParameter.max > 99);
		}
		else if(parameterChoice === 'Morale')
		{
			newParameter.type = 'ConfidenceRating';

			do
			{
				console.log("\nEnter the minimum morale rating: ");
				newParameter.min = parseInt(prompt());
				if(newParameter.min < 0 || newParameter.min > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}
			}
			while(newParameter.min < 0 || newParameter.min > 99);

			do
			{
				console.log("\nEnter the maximum morale rating: ");
				newParameter.max = parseInt(prompt());
				if(newParameter.max < 0 || newParameter.max > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}

				if(newParameter.max < newParameter.min)
				{
					console.log("Maximum morale rating must be greater than or equal to morale rating.");
				}
			}
			while(newParameter.max < 0 || newParameter.max < newParameter.min || newParameter.max > 99);
		}
		else if(parameterChoice === 'Other Rating')
		{
			newParameter.type = ratingTypes[await getRatingSelection()];
			
			do
			{
				console.log("\nEnter the minimum value for the rating: ");
				newParameter.min = parseInt(prompt());
				if(newParameter.min < 0 || newParameter.min > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}
			}
			while(newParameter.min < 0 || newParameter.min > 99);

			do
			{
				console.log("\nEnter the maximum value for the rating: ");
				newParameter.max = parseInt(prompt());
				if(newParameter.max < 0 || newParameter.max > 99)
				{
					console.log("Please enter a positive number from 0-99.");
				}

				if(newParameter.max < newParameter.min)
				{
					console.log("Maximum rating must be greater than or equal to minimum rating.");
				}
			}
			while(newParameter.max < 0 || newParameter.max < newParameter.min || newParameter.max > 99);
		
		}

		// Add the new selection parameter to the list of selection parameters
		selectionParameters.push(newParameter);
	}
	while(true);

	// Return the list of selection parameters
	return selectionParameters;
}

// This function allows the user to create a new injury scenario
async function createInjuryScenario()
{
	// Header message
	console.log("\nInjury Scenario Creator");

	// Variable to store the new injury scenario object
	let newInjScenario = {
		injuryType: '',
		weeksOut: 0,
		usePositionGroup: false,
		positionGroup: []
	};

	// Ask the user if they want to apply the injury to a specific position group
	newInjScenario.usePositionGroup = FranchiseUtils.getYesOrNo("\nDo you want to apply this injury to a specific position group? (yes/no)");

	// If the user wants to apply the injury to a specific position group, get the position group
	if(newInjScenario.usePositionGroup)
	{
		newInjScenario.positionGroup = getPositionGroupSelection();
	}

	// Get the injury type from the user
	newInjScenario.injuryType = await getInjurySelection();

	// Get the number of weeks the player should be out from the user
	do
	{
		console.log("\nEnter the number of weeks the player should be out: ");
		newInjScenario.weeksOut = parseInt(prompt());
		if(newInjScenario.weeksOut < 0)
		{
			console.log("Please enter a positive number.");
		}

	}
	while(newInjScenario.weeksOut < 0);

	// Set the scenario type to Injury
	newInjScenario.type = 'Injury';

	// Return the new injury scenario object
	return newInjScenario;
}

// This function allows the user to create a new suspension scenario
async function createSuspensionScenario()
{
	// Header message
	console.log("\nSuspension Scenario Creator");

	// Variable to store the new suspension scenario object
	let newSuspScenario = {
		suspensionLength: 0
	};

	// Get the number of weeks the player should be suspended from the user
	do
	{
		console.log("\nEnter the number of weeks the player should be suspended: ");
		newSuspScenario.suspensionLength = parseInt(prompt());
		if(newSuspScenario.suspensionLength < 0)
		{
			console.log("Please enter a positive number.");
		}
	}
	while(newSuspScenario.suspensionLength < 0);

	// Set the scenario type to Suspension
	newSuspScenario.type = 'Suspension';

	// Return the new suspension scenario object
	return newSuspScenario;
}

// This function allows the user to create a new rating change scenario
async function createRatingChangeScenario()
{
	// Header message
	console.log("\nRating Change Scenario Creator");

	// Variable to store the new rating change scenario object
	let newRatingScenario = {
		ratings: [],
		usePositionGroup: false,
		positionGroup: []
	};

	// Ask the user if they want to apply the rating change to a specific position group
	newRatingScenario.usePositionGroup = FranchiseUtils.getYesOrNo("\nDo you want to apply this rating change to a specific position group? (yes/no)");

	// If the user wants to apply the rating change to a specific position group, get the position group
	if(newRatingScenario.usePositionGroup)
	{
		newRatingScenario.positionGroup = getPositionGroupSelection();
	}

	// Variable to store the number of ratings the user wants to change
	let numRatings;

	// Get the number of ratings the user wants to change
	do
	{
		console.log(`\nEnter how many ratings you want to change (1-${Object.keys(ratingTypes).length}): `);
		try
		{
			numRatings = parseInt(prompt());
		}
		catch(error)
		{
			console.log("Invalid choice. Please try again.");
			continue;
		}

		if(numRatings < 1 || numRatings > ratingTypes.length)
		{
			console.log("Invalid choice. Please try again.");
		}
	}
	while(numRatings < 1 || numRatings > ratingTypes.length);

	// Loop through the number of ratings the user wants to change and get the rating and change amount for each
	for(let i = 0; i < numRatings; i++)
	{
		let newRating = {
			rating: '',
			ratingPrettyName: '',
			ratingChange: 0
		};

		newRating.ratingPrettyName = await getRatingSelection();
		newRating.rating = ratingTypes[newRating.ratingPrettyName];

		console.log("\nEnter how much the rating should change by (positive for increase, negative for decrease): ");
		newRating.ratingChange = parseInt(prompt());

		newRatingScenario.ratings.push(newRating);
	}

	// Set the scenario type to Rating Change
	newRatingScenario.type = 'Rating Change';

	// Return the new rating change scenario object
	return newRatingScenario;
}

// This function displays a list of position groups and allows the user to select one or create a custom group
function getPositionGroupSelection()
{
	// Load the position groups and all positions from the lookup files
	let positionGroupKeys = Object.keys(positionGroups);

	// Add the custom position group option to the list of position groups
	positionGroupKeys.push('Custom');

	// Display the list of position groups to the user
	console.log("\nPosition Groups:");
	positionGroupKeys.forEach((group, index) => {
		console.log(`${index} - ${group}`);
	});

	// Get the user's choice of position group
	let inputNumber;
	while(true)
	{
		console.log("\nEnter the number for the position group you want to edit: ");
		inputNumber = parseInt(prompt());
		if(inputNumber < 0 || inputNumber >= positionGroupKeys.length)
		{
			console.log("Invalid choice. Please try again.");
		}
		else
		{
			break;
		}
	}

	// Get the position group choice based on the user's input
	const positionGroupChoice = positionGroupKeys[inputNumber];

	// If the user chose the Custom option, get the custom position group
	if(positionGroupChoice === 'Custom')
	{
		let customPositionGroup = [];
		let allPositionsList = allPositions['List'];

		let numPositions;
		do
		{
			console.log("\nEnter how many positions you want to include in the custom group: ");
			numPositions = parseInt(prompt());
			if(numPositions < 1)
			{
				console.log("Please enter a number greater than 0.");
			}
		}
		while(numPositions < 1);

		for(let i = 0; i < numPositions; i++)
		{
			let positionChoice;

			do
			{
				console.log(`\nEnter position ${i + 1} (ex: QB): `);
				positionChoice = prompt().toUpperCase();
				if(!allPositionsList.includes(positionChoice))
				{
					console.log("Invalid position. Please try again.");
				}
			}
			while(!allPositionsList.includes(positionChoice));

			customPositionGroup.push(positionChoice);
		}

		// Return the custom position group
		return customPositionGroup;
	
	}

	// Return the chosen position group
	return positionGroups[positionGroupChoice];
}

// This function gets the user's choice of injury
async function getInjurySelection()
{
	// Load the injury types from the lookup file
	let injuryTypes = (JSON.parse(fs.readFileSync(`lookupFiles/injuryTypes.json`, 'utf-8')));
	let injuryTypeKeys = Object.keys(injuryTypes);

	// Display the list of injury types to the user
	console.log("\nInjury Types:");
	injuryTypeKeys.forEach((type, index) => {
		console.log(`${index} - ${type}`);
	});

	// Get the user's choice of injury type
	console.log("\nEnter the number for the injury type you want: ");
	const injuryTypeChoice = injuryTypeKeys[parseInt(prompt())];

	// Get the values for the chosen injury type
	const injuryTypeValues = injuryTypes[injuryTypeChoice];

	// Display the list of injury values for the chosen injury type to the user
	console.log(`\n${injuryTypeChoice} Injuries:`);
	injuryTypeValues.forEach((value, index) => {
		console.log(`${index} - ${value}`);
	});

	// Get the user's choice of injury value
	console.log("\nEnter the number for the injury you want: ");
	const injuryChoice = injuryTypeValues[parseInt(prompt())];

	// Return the chosen injury value
	return injuryChoice;

	// This is development code that is left just for documentation purposes, showing how I created the injuryTypes.json file
	/*
	let injuryTypes = (JSON.parse(fs.readFileSync(`injuryenum.json`, 'utf-8')))["enum"]["_members"];
	let injuryValuesSorted = {};
	// Print the _name attribute of each object in the injuryTypes array to a file, one per line
	fs.writeFileSync(`injuryTypes.txt`, '');
	injuryTypes.forEach(injury => {
		// If name contains an underscore, skip it
		if(injury["_name"].includes('_') || injury["_name"] === 'DoNotUse')
		{
			return;
		}

		// Get the substring from the name up until the second capital letter using regex pattern ^[^A-Z]*[A-Z][^A-Z]*
		let injuryType = injury["_name"].match(/^[insertpatternhere]/)[0];

		if(injuryValuesSorted.hasOwnProperty(injuryType))
		{
			injuryValuesSorted[injuryType].push(injury["_name"]);
		}
		else
		{
			injuryValuesSorted[injuryType] = [injury["_name"]];
		}
	});

	// Convert sorted injury object to string and save to file
	fs.writeFileSync(`injuryTypes.json`, JSON.stringify(injuryValuesSorted, null, 2));
	*/
}

// This function gets the user's choice of rating
async function getRatingSelection()
{
	// Load the rating types from the lookup file
	let ratingTypeKeys = Object.keys(ratingTypes);

	// Display the list of rating types to the user
	console.log("\nRating Types:");
	ratingTypeKeys.forEach((type, index) => {
		console.log(`${index} - ${type}`);
	});

	// Get the user's choice of rating type
	let inputNumber;
	while(true)
	{
		console.log("\nEnter the number for the rating you want to use: ");
		inputNumber = parseInt(prompt());
		if(inputNumber < 0 || inputNumber >= ratingTypeKeys.length)
		{
			console.log("Invalid choice. Please try again.");
		}
		else
		{
			break;
		}
	}

	// Get the rating choice based on the user's input
	const ratingTypeChoice = ratingTypeKeys[inputNumber];

	// Return the chosen rating type
	return ratingTypeChoice;

}

// Get the current week and week type from the season info table
const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];
const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);

// Valid weeks when the tool can be run
const validWeekTypes = ['PreSeason','RegularSeason','WildcardPlayoff','DivisionalPlayoff','ConferencePlayoff','SuperBowl'];

// Check if file is in preseason, regular season, or playoffs, exit if not
if (!validWeekTypes.includes(currentWeekType)) 
{
	console.log("Selected file is not in a valid week. Only Franchise Files from the preseason to the playoffs are supported by this tool.");
	FranchiseUtils.EXIT_PROGRAM();
}

// Main menu loop	
let userOption;

// Loop until the user quits the program
while(true)
{
	// Display the header and main menu options to the user
	console.log("\nMAIN MENU\nOptions:");
	console.log("g - Generate a new scenario");
	console.log("c - Create a scenario");
	console.log("r - Reload scenarios");
	console.log("q - Quit\n");
	console.log("Select an option: ");

	// Get the user's choice of option
	userOption = prompt().toLowerCase();

	// Handle the user's choice of option
	if(userOption === 'q')
	{
		await FranchiseUtils.saveFranchiseFile(franchise);
		FranchiseUtils.EXIT_PROGRAM();
	}
	else if(userOption === 'g')
	{
		await generateScenario();
	}
	else if(userOption === 'c')
	{
		await createScenario();
	}
	else if(userOption === 'r')
	{
		scenarios = [];
		loadScenarios();
	}
	else // If the user's choice is invalid, inform them and continue to the next iteration of the loop
	{
		console.log("Invalid option. Please try again.\n");
	}
}

})();