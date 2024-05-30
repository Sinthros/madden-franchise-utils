(async () => {
const fs = require('fs');
const os = require('os');
const prompt = require('prompt-sync')();
const path = require('path');
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const ratingTypes = (JSON.parse(fs.readFileSync(`lookupFiles/ratingTypes.json`, 'utf-8')));
const positionGroups = (JSON.parse(fs.readFileSync(`lookupFiles/positionGroups.json`, 'utf-8')));
const allPositions = (JSON.parse(fs.readFileSync(`lookupFiles/allPositions.json`, 'utf-8')));

const versionNum = 'v2.1';

console.log(`Welcome to MaddenSynth ${versionNum}! This is a customizable franchise scenario generator for Madden 24.\n`)
const gameYear = '24';
const franchise = await FranchiseUtils.selectFranchiseFileAsync(gameYear);


const teamTable = franchise.getTableByUniqueId(tables.teamTable);
await teamTable.readRecords();

const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
await seasonInfoTable.readRecords();

const playerTable = franchise.getTableByUniqueId(tables.playerTable);
await playerTable.readRecords();

const validWeekTypes = ['PreSeason','RegularSeason','WildcardPlayoff','DivisionalPlayoff','ConferencePlayoff','SuperBowl'];
const invalidPlayerStatuses = ['Draft','Retired','Deleted','None','Created','PracticeSquad'];

const teamsList = [];
const validTeamIndex = [];
let scenarios = [];

await loadTeams();
loadScenarios();


// Function to shuffle an array (Fisher-Yates algorithm)
async function shuffleArray(array) 
{
	for (let i = array.length - 1; i > 0; i--) 
	{
	  const j = Math.floor(Math.random() * (i + 1));
	  [array[i], array[j]] = [array[j], array[i]];
	}
}
  
function getRandomNumber(floor, ceiling) 
{
  // Ensure that the floor and ceiling are integers
  floor = Math.floor(floor);
  ceiling = Math.floor(ceiling);

  // Generate a random number between 0 (inclusive) and 1 (exclusive)
  const randomFraction = Math.random();

  // Scale the random fraction to fit within the specified range
  const randomInRange = randomFraction * (ceiling - floor + 1) + floor;

  // Convert the result to an integer
  const result = Math.floor(randomInRange);

  return result;
}

function getYesOrNo(message) 
{
	while (true) 
	{
		console.log(message);
		const input = prompt().trim().toUpperCase();
  
		if (input === 'YES') 
		{
			return true;
		} 
		else if (input === 'NO') 
		{
			return false;
		} 
		else 
		{
			console.log("Invalid input. Please enter yes or no.");
		}
	}
}

async function loadTeams()
{
	for(let i = 0; i < teamTable.header.recordCapacity; i++)
	{
		const shortNameBlacklist = ['NFC','AFC','FA'];
		
		if(teamTable.records[i].isEmpty || shortNameBlacklist.includes(teamTable.records[i]['ShortName']))
		{
			continue;
		}
		let cityName = teamTable.records[i]['LongName'];
		let teamName = teamTable.records[i]['DisplayName'];

		let teamFullName = `${cityName} ${teamName}`;

		let teamEntry = {
			teamName: teamFullName,
			teamAbbrev: teamTable.records[i]['ShortName'],
			teamIndex: teamTable.records[i]['TeamIndex'],
			teamRowNum: i
		};

		teamsList.push(teamEntry);
		validTeamIndex.push(teamEntry.teamIndex);
	}
}

function loadScenarios()
{
	const scenariosDir = 'scenarios';
	if(!fs.existsSync(scenariosDir))
	{
		fs.mkdirSync(scenariosDir);
	}
	const scenarioFiles = fs.readdirSync(scenariosDir);
	let loadErrorCount = 0;

	scenarioFiles.forEach(file => {
		let scenario;
		try
		{
			scenario = JSON.parse(fs.readFileSync(path.join(scenariosDir, file), 'utf-8'));
		}
		catch(error)
		{
			loadErrorCount++;
			return;
		}

		if(scenario.type === 'Rating Change')
		{
			scenario = convertLegacyRatingScenario(scenario);
			// Save file after conversion
			fs.writeFileSync(path.join(scenariosDir, file), JSON.stringify(scenario, null, 2));
		}
		else if(scenario.type === 'Injury')
		{
			scenario = convertLegacyInjuryScenario(scenario);
			// Save file after conversion
			fs.writeFileSync(path.join(scenariosDir, file), JSON.stringify(scenario, null, 2));
		}

		scenarios.push(scenario);
	});

	if(loadErrorCount > 0)
	{
		console.log(`\nFailed to load ${loadErrorCount} scenarios. Check the scenarios folder for any invalid files.`);
	}

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

function convertLegacyRatingScenario(scenario)
{
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

function convertLegacyInjuryScenario(scenario)
{
	if(!scenario.hasOwnProperty('usePositionGroup'))
	{
		scenario.usePositionGroup = false;
	}

	return scenario;
}

async function generateScenario()
{
	if(scenarios.length === 0)
	{
		console.log("\nThere are no scenarios loaded. Create one first to get started.");
		return;
	}
	
	let recycleCount = 0;
	// Get from user how many scenarios they want to generate, then generate that many
	let numScenarios;
	do
	{
		console.log("\nEnter how many scenarios you want to generate: ");
		numScenarios = parseInt(prompt());
		if(numScenarios < 1)
		{
			console.log(`Please enter a number from 1-${scenarios.length}.`);
		}

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
	while(numScenarios < 1 || numScenarios > scenarios.length);

	for(let i = 0; i < numScenarios; i++)
	{
		// Shuffle the scenarios array
		await shuffleArray(scenarios);

		let selectedScenario;

		while(true)
		{
			selectedScenario = scenarios[getRandomNumber(0, scenarios.length - 1)];

			if(selectedScenario.hasOwnProperty('useRandomThreshold') && selectedScenario.useRandomThreshold)
			{
				const randomThreshold = selectedScenario.randomThreshold;
				const randomNum = getRandomNumber(1, 50);
				if(randomNum < randomThreshold)
				{
					continue;
				}
				else
				{
					break;
				}
			}
			else
			{
				break;
			}
		}

		// Print a separator between scenarios if it's not the first one
		if(i > 0)
		{
			console.log("\n----------------------------------------");
		}

		let success = false;

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

		if(!success)
		{
			recycleCount++;
			if(recycleCount > 50)
			{
				console.log("\nNo scenarios could be applied. Skipping and moving on.");
				recycleCount = 0;
				continue;
			}

			console.log(`\nScenario "${selectedScenario.title}" skipped as there were no valid players found to apply it to. Trying again.`);
			i--;
		}
		else
		{
			recycleCount = 0;
		}
	}
}

async function handleInjuryScenario(scenario)
{
	let randPlayerRow;

	let randCount = 0;

	do
	{
		if(randCount > 50)
		{
			return false;
		}

		if(scenario.usePositionGroup)
		{
			if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
			{
				do
				{
					randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);
					if(randPlayerRow === -1)
					{
						randCount++;
						break;
					}
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']) && playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
			else
			{
				do
				{
					randPlayerRow = await getRandomSignedPlayer();
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']) && playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
		}
		else
		{
			if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
			{
				do
				{
					randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);
					if(randPlayerRow === -1)
					{
						randCount++;
						break;
					}
				}
				while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
			else
			{
				do
				{
					randPlayerRow = await getRandomSignedPlayer();
				}
				while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
			}
		}
	}
	while(randPlayerRow === -1)

	let randTeam = teamsList.find(team => team.teamIndex === playerTable.records[randPlayerRow]['TeamIndex']); 
	let randTeamRow = randTeam.teamRowNum; 
	let teamIndex = randTeam.teamIndex;

	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']} will be out for ${scenario.weeksOut} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = scenario.injuryType;
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.weeksOut;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.weeksOut;

	return true;

}

async function handleRatingChangeScenario(scenario)
{
	let randPlayerRow;

	let randCount = 0;

	do
	{
		if(randCount > 50)
		{
			return false;
		}

		if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
		{
			if(scenario.usePositionGroup)
			{
				do
				{
					randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);
					if(randPlayerRow === -1)
					{
						randCount++;
						break;
					}
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']));
			}
			else
			{
				randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);
			}
		}
		else
		{
			if(scenario.usePositionGroup)
			{
				do
				{
					randPlayerRow = await getRandomSignedPlayer();
				}
				while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']));
			}
			else
			{
				randPlayerRow = await getRandomSignedPlayer();
			}
		}
	}
	while(randPlayerRow === -1)

	let randTeam = teamsList.find(team => team.teamIndex === playerTable.records[randPlayerRow]['TeamIndex']); 
	let randTeamRow = randTeam.teamRowNum; 
	let teamIndex = randTeam.teamIndex;

	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']}'s ratings will change as listed below:`);

	const singleHeaderRatings = ['Morale', 'Weight']

	// Iterate through each rating in the scenario's ratings array and apply the change to the player
	scenario.ratings.forEach(rating => {
		
		// Separately Handle ratings that only have one header
		if(singleHeaderRatings.includes(rating.ratingPrettyName))
		{
			let ratingPrettyName = rating.ratingPrettyName;
			
			let newOriginalRating;

			if(ratingPrettyName === 'Morale')
			{
				newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][rating.rating] + rating.ratingChange, 100), 0);
			}
			else if (ratingPrettyName === 'Weight')
			{
				newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][rating.rating] + rating.ratingChange, 240), 0);
			}
			else
			{
				newOriginalRating = Math.max(Math.min(playerTable.records[randPlayerRow][rating.rating] + rating.ratingChange, 99), 0);
			}

			let ratingChangeSign;

			if(rating.ratingChange < 0)
			{
				ratingChangeSign = '-';
			}
			else
			{
				ratingChangeSign = '+';
			}

			if(ratingPrettyName === 'Weight')
			{
				console.log(`${ratingPrettyName}: ${ratingChangeSign}${Math.abs(rating.ratingChange)} (${(playerTable.records[randPlayerRow][rating.rating] - rating.ratingChange) + 160} -> ${playerTable.records[randPlayerRow][rating.rating] + 160})`);
			}
			else
			{
				console.log(`${ratingPrettyName}: ${ratingChangeSign}${Math.abs(rating.ratingChange)} (${playerTable.records[randPlayerRow][rating.rating] - rating.ratingChange} -> ${playerTable.records[randPlayerRow][rating.rating]})`);
			}

			return;
		}
		
		let ratingPrettyName = rating.ratingPrettyName;
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

		let ratingChangeSign;

		if(rating.ratingChange < 0)
		{
			ratingChangeSign = '-';
		}
		else
		{
			ratingChangeSign = '+';
		}

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

	return true;
}

async function handleSuspensionScenario(scenario)
{
	let randPlayerRow;

	let randCount = 0;

	do
	{
		if(randCount > 50)
		{
			return false;
		}

		if(scenario.hasOwnProperty('hasSelectionParameters') && scenario.hasSelectionParameters)
		{
			do
			{
				randPlayerRow = await getRandomSignedPlayerWithParameters(scenario.selectionParameters);
				if(randPlayerRow === -1)
				{
					randCount++;
					break;
				}
			}
			while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
		}
		else
		{
			do
			{
				randPlayerRow = await getRandomSignedPlayer();
			}
			while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');
		}
	}
	while(randPlayerRow === -1);

	let randTeam = teamsList.find(team => team.teamIndex === playerTable.records[randPlayerRow]['TeamIndex']); 
	let randTeamRow = randTeam.teamRowNum; 
	let teamIndex = randTeam.teamIndex;

	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']} is suspended for ${scenario.suspensionLength} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = 'ElbowDislocatedSeveralGames';
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.suspensionLength;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.suspensionLength;

	return true;
}

async function getRandomSignedPlayer()
{
	let playerRows = [];
	for(let i = 0; i < playerTable.header.recordCapacity; i++)
	{
		if(playerTable.records[i].isEmpty || !validTeamIndex.includes(playerTable.records[i]['TeamIndex']) || invalidPlayerStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
		}
		playerRows.push(i);
	}

	return playerRows[getRandomNumber(0, playerRows.length - 1)];
}

async function getRandomSignedPlayerWithParameters(selectionParameters)
{
	let playerRows = [];
	for(let i = 0; i < playerTable.header.recordCapacity; i++)
	{
		if(playerTable.records[i].isEmpty || !validTeamIndex.includes(playerTable.records[i]['TeamIndex']) || invalidPlayerStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
		}

		let validPlayer = true;

		selectionParameters.forEach(param => {
			if(playerTable.records[i][param.type] < param.min || playerTable.records[i][param.type] > param.max)
			{
				validPlayer = false;
			}
		});

		if(validPlayer)
		{
			playerRows.push(i);
		}
	}

	if(playerRows.length === 0)
	{
		return -1;
	}

	return playerRows[getRandomNumber(0, playerRows.length - 1)];

}

async function createScenario()
{
	const scenarioTypes = ['Injury', 'Suspension', 'Rating Change'];

	console.log("\nScenario types:");
	scenarioTypes.forEach((type, index) => {
		console.log(`${index} - ${type}`);
	});

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

	let newScenario;

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

	console.log("\nEnter a title for the scenario:");
	newScenario.title = prompt();

	console.log("\nEnter a description for the scenario:");
	newScenario.description = prompt();

	newScenario.useRandomThreshold = getYesOrNo("\nDo you want to apply a random threshold to this scenario? (yes/no)");

	if(newScenario.useRandomThreshold)
	{
		console.log("\nEnter the random threshold:");
		newScenario.randomThreshold = parseInt(prompt());
	}

	newScenario.hasSelectionParameters = getYesOrNo("\nDo you want to apply player selection parameters to this scenario? (yes/no)");

	if(newScenario.hasSelectionParameters)
	{
		newScenario.selectionParameters = await getSelectionParameters();
	}

	scenarios.push(newScenario);

	// Save the scenario object to a file named after the title (without spaces or special characters)
	let scenarioFileName = newScenario.title.replace(/[^a-zA-Z0-9]/g, '');

	// If the file already exists, append a number to the end of the filename
	let fileNum = 2;
	while(fs.existsSync(`scenarios/${scenarioFileName}.json`))
	{
		scenarioFileName = `${scenarioFileName}${fileNum}`;
		fileNum++;
	}

	fs.writeFileSync(`scenarios/${scenarioFileName}.json`, JSON.stringify(newScenario, null, 2));

	console.log("\nScenario created successfully and saved to file.");
}

async function getSelectionParameters(scenario)
{
	const parameterOptions = ['Age', 'Overall', 'Injury Rating', 'Awareness Rating', 'Morale', 'Other Rating'];

	let userChoice;

	let selectionParameters = [];

	do
	{
		console.log("\nSelection Parameter Options:");
		parameterOptions.forEach((param, index) => {
			console.log(`${index} - ${param}`);
		});

		console.log("\nEnter the number for the parameter you want to add, or nothing if you are finished: ");
		userChoice = prompt();

		if(userChoice === '')
		{
			break;
		}

		userChoice = parseInt(userChoice);

		if(userChoice < 0 || userChoice >= parameterOptions.length)
		{
			console.log("Invalid choice. Please try again.");
		}

		const parameterChoice = parameterOptions[userChoice];

		let newParameter = {};

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

		selectionParameters.push(newParameter);
	}
	while(true);

	return selectionParameters;
	
}

async function createInjuryScenario()
{
	console.log("\nInjury Scenario Creator");
	let newInjScenario = {
		injuryType: '',
		weeksOut: 0,
		usePositionGroup: false,
		positionGroup: []
	};

	newInjScenario.usePositionGroup = getYesOrNo("\nDo you want to apply this injury to a specific position group? (yes/no)");

	if(newInjScenario.usePositionGroup)
	{
		newInjScenario.positionGroup = getPositionGroupSelection();
	}

	newInjScenario.injuryType = await getInjurySelection();

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

	newInjScenario.type = 'Injury';

	return newInjScenario;
}

async function createSuspensionScenario()
{
	console.log("\nSuspension Scenario Creator");

	let newSuspScenario = {
		suspensionLength: 0
	};

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

	newSuspScenario.type = 'Suspension';

	return newSuspScenario;
}

async function createRatingChangeScenario()
{
	console.log("\nRating Change Scenario Creator");

	let newRatingScenario = {
		ratings: [],
		usePositionGroup: false,
		positionGroup: []
	};

	newRatingScenario.usePositionGroup = getYesOrNo("\nDo you want to apply this rating change to a specific position group? (yes/no)");

	if(newRatingScenario.usePositionGroup)
	{
		newRatingScenario.positionGroup = getPositionGroupSelection();
	}

	let numRatings;
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

	newRatingScenario.type = 'Rating Change';

	return newRatingScenario;
}

function getPositionGroupSelection()
{
	let positionGroupKeys = Object.keys(positionGroups);
	positionGroupKeys.push('Custom');


	console.log("\nPosition Groups:");
	positionGroupKeys.forEach((group, index) => {
		console.log(`${index} - ${group}`);
	});

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

	const positionGroupChoice = positionGroupKeys[inputNumber];

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

		return customPositionGroup;
	
	}

	return positionGroups[positionGroupChoice];
}

async function getInjurySelection()
{
	let injuryTypes = (JSON.parse(fs.readFileSync(`lookupFiles/injuryTypes.json`, 'utf-8')));
	let injuryTypeKeys = Object.keys(injuryTypes);

	console.log("\nInjury Types:");
	injuryTypeKeys.forEach((type, index) => {
		console.log(`${index} - ${type}`);
	});

	console.log("\nEnter the number for the injury type you want: ");
	const injuryTypeChoice = injuryTypeKeys[parseInt(prompt())];

	const injuryTypeValues = injuryTypes[injuryTypeChoice];

	console.log(`\n${injuryTypeChoice} Injuries:`);
	injuryTypeValues.forEach((value, index) => {
		console.log(`${index} - ${value}`);
	});

	console.log("\nEnter the number for the injury you want: ");
	const injuryChoice = injuryTypeValues[parseInt(prompt())];

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

async function getRatingSelection()
{
	let ratingTypeKeys = Object.keys(ratingTypes);

	console.log("\nRating Types:");
	ratingTypeKeys.forEach((type, index) => {
		console.log(`${index} - ${type}`);
	});

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
	const ratingTypeChoice = ratingTypeKeys[inputNumber];

	return ratingTypeChoice;

}

const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];
const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	
if (!validWeekTypes.includes(currentWeekType)) // Check if file is in preseason, regular season, or playoffs, exit if not
{
	console.log("Selected file is not in a valid week. Only Franchise Files from the preseason to the playoffs are supported by this tool. Enter anything to exit.")
	prompt();
	process.exit(0);
}

	
	let userOption;
	while(true)
	{
		console.log("\nMAIN MENU\nOptions:");
		console.log("g - Generate a new scenario");
		console.log("c - Create a scenario");
		console.log("r - Reload scenarios");
		console.log("q - Quit\n");
		console.log("Select an option: ");
		userOption = prompt().toLowerCase();

		if(userOption === 'q')
		{
			await FranchiseUtils.saveFranchiseFile(franchise);
			console.log("Enter anything to exit.");
			prompt();
			process.exit(0);
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
		else
		{
			console.log("Invalid option. Please try again.\n");
		}
	}
})();