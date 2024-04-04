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

const versionNum = 'v2 ALPHA 0.1';

console.log(`Welcome to MaddenSynth ${versionNum}! This is a customizable franchise scenario generator for Madden 24.\n`)
const gameYear = '24';
const franchise = await FranchiseUtils.selectFranchiseFileAsync(gameYear);
if(franchise.schema.meta.gameYear !== gameYear)
{
	console.log(`\nERROR: Selected file is not a Madden ${gameYear} franchise file. Enter anything to exit.`);
	prompt();
	process.exit(0);

}


const teamTable = franchise.getTableByUniqueId(tables.teamTable);
await teamTable.readRecords();

const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
await seasonInfoTable.readRecords();

const playerTable = franchise.getTableByUniqueId(tables.playerTable);
await playerTable.readRecords();

const validWeekTypes = ['PreSeason','RegularSeason','WildcardPlayoff','DivisionalPlayoff','ConferencePlayoff','SuperBowl'];
const zeroRef = '00000000000000000000000000000000';
const invalidPlayerStatuses = ['Draft','Retired','Deleted','None','Created','PracticeSquad'];

const teamsList = [];
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
			teamRowNum: i
		};

		teamsList.push(teamEntry);
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

async function generateScenario()
{
	if(scenarios.length === 0)
	{
		console.log("\nThere are no scenarios loaded. Create one first to get started.");
		return;
	}
	
	// Shuffle the scenarios array
	await shuffleArray(scenarios);

	let selectedScenario = scenarios[getRandomNumber(0, scenarios.length - 1)];

	if(selectedScenario.type === 'Injury')
	{
		await handleInjuryScenario(selectedScenario);
	}
	else if(selectedScenario.type === 'Rating Change')
	{
		await handleRatingChangeScenario(selectedScenario);
	}
	else if(selectedScenario.type === 'Suspension')
	{
		await handleSuspensionScenario(selectedScenario);
	}
}

async function handleInjuryScenario(scenario)
{
	let randTeam = teamsList[getRandomNumber(0, teamsList.length - 1)];
	let randTeamRow = randTeam.teamRowNum;
	let teamIndex = teamTable.records[randTeamRow]['TeamIndex'];

	let randPlayerRow;
	do
	{
		randPlayerRow = await getRandomPlayerOnTeam(teamIndex);
	}
	while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');

	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']} will be out for ${scenario.weeksOut} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = scenario.injuryType;
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.weeksOut;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.weeksOut;

}

async function handleRatingChangeScenario(scenario)
{
	let randTeam = teamsList[getRandomNumber(0, teamsList.length - 1)];
	let randTeamRow = randTeam.teamRowNum;
	let teamIndex = teamTable.records[randTeamRow]['TeamIndex'];

	let randPlayerRow;
	
	if(scenario.usePositionGroup)
	{
		do
		{
			randPlayerRow = await getRandomPlayerOnTeam(teamIndex);
		}
		while(!scenario.positionGroup.includes(playerTable.records[randPlayerRow]['Position']));
	}
	else
	{
		randPlayerRow = await getRandomPlayerOnTeam(teamIndex);
	}

	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']}'s ratings will change as listed below:`);


	// Iterate through each rating in the scenario's ratings array and apply the change to the player
	scenario.ratings.forEach(rating => {
		
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

}

async function handleSuspensionScenario(scenario)
{
	let randTeam = teamsList[getRandomNumber(0, teamsList.length - 1)];
	let randTeamRow = randTeam.teamRowNum;
	let teamIndex = teamTable.records[randTeamRow]['TeamIndex'];

	let randPlayerRow;
	do
	{
		randPlayerRow = await getRandomPlayerOnTeam(teamIndex);
	}
	while(playerTable.records[randPlayerRow]['InjuryStatus'] !== 'Uninjured');

	console.log(`\n${randTeam.teamName} - ${playerTable.records[randPlayerRow]['Position']} ${playerTable.records[randPlayerRow]['FirstName']} ${playerTable.records[randPlayerRow]['LastName']} (${playerTable.records[randPlayerRow]['OverallRating']} OVR)`);
	console.log(`\n${scenario.title}:`);
	console.log(scenario.description);
	console.log(`\nResult - ${playerTable.records[randPlayerRow]['LastName']} is suspended for ${scenario.suspensionLength} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = 'ElbowDislocatedSeveralGames';
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.suspensionLength;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.suspensionLength;

}

async function getRandomPlayerOnTeam(teamIndex)
{
	let playerRows = [];
	for(let i = 0; i < playerTable.header.recordCapacity; i++)
	{
		if(playerTable.records[i].isEmpty || playerTable.records[i]['TeamIndex'] !== teamIndex || invalidPlayerStatuses.includes(playerTable.records[i]['ContractStatus']))
		{
			continue;
		}
		playerRows.push(i);
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

async function createInjuryScenario()
{
	console.log("\nInjury Scenario Creator");
	let newInjScenario = {
		injuryType: '',
		weeksOut: 0
	};

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
		console.log("\nEnter the number for the rating you want to edit: ");
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


	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	await seasonGameTable.readRecords();
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity; // Number of rows in the SeasonGame table
	
	var selectedGame;
	var allowedGameRows = [];
	
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