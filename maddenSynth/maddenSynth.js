(async () => {
const fs = require('fs');
const os = require('os');
const prompt = require('prompt-sync')();
const path = require('path');
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

const versionNum = 'ALPHA v0.1';

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
const zeroRef = '00000000000000000000000000000000';
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

async function generateScenario()
{
	// Shuffle the scenarios array
	await shuffleArray(scenarios);

	let selectedScenario = scenarios[getRandomNumber(0, scenarios.length - 1)];

	if(selectedScenario.type === 'Injury')
	{
		await handleInjuryScenario(selectedScenario);
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
	console.log(`\n${scenario.title}`);
	console.log(scenario.description);
	console.log(`\nResult: ${playerTable.records[randPlayerRow]['LastName']} will be out for ${scenario.weeksOut} weeks.`);

	// Set injury status to Injured, set InjuryType, and set both MinInjuryDuration and MaxInjuryDuration to the number of weeks
	playerTable.records[randPlayerRow]['InjuryStatus'] = 'Injured';
	playerTable.records[randPlayerRow]['InjuryType'] = scenario.injuryType;
	playerTable.records[randPlayerRow]['MinInjuryDuration'] = scenario.weeksOut;
	playerTable.records[randPlayerRow]['MaxInjuryDuration'] = scenario.weeksOut;

}

async function getRandomPlayerOnTeam(teamIndex)
{
	let playerRows = [];
	for(let i = 0; i < playerTable.header.recordCapacity; i++)
	{
		if(playerTable.records[i].isEmpty || playerTable.records[i]['TeamIndex'] !== teamIndex)
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
	console.log("Injury Scenario Creator");
	let newInjScenario = {
		injuryType: '',
		weeksOut: 0
	};

	newInjScenario.injuryType = await getInjurySelection();

	console.log("\nEnter the number of weeks the player should be out: ");
	do
	{
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
	console.log("Suspension Scenario Creation");

	return null; // Placeholder
}

async function createRatingChangeScenario()
{
	console.log("Rating Change Scenario Creation");

	return null; // Placeholder
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