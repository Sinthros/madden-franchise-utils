const fs = require('fs');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

console.log("This program will allow you to update the weather for a game in your Madden 24 franchise file. This tool must be run during the regular season or playoffs.\n")
const gameYear = '24';

const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

const validWeekTypes = ['RegularSeason','WildcardPlayoff','DivisionalPlayoff','ConferencePlayoff','SuperBowl'];
const zeroRef = '00000000000000000000000000000000';

const windOptions = ['Calm', 'LightBreeze', 'Moderate', 'VeryWindy'];
const snowRand = getRandomNumber(2,3);
const rainRand = getRandomNumber(1,3);
const clearRand = getRandomNumber(0,3);

const weatherOptions = ['Snow', 'Rain (Warm)', 'Rain (Cold)', 'Clear (Warm)', 'Clear (Cold)'];
const snowValues = [windOptions[snowRand], 'Heavy', 'Overcast', 'Snow', 0]; // In order of Wind, Precipitation, CloudCover, Weather, and Temperature values
const rainWarmValues = [windOptions[rainRand], 'Heavy', 'Overcast', 'Rain', 70];
const rainColdValues = [windOptions[rainRand], 'Heavy', 'Overcast', 'Rain', 35];
const clearWarmValues = [windOptions[clearRand], 'Invalid_', 'Invalid_', 'Clear', 70];
const clearColdValues = [windOptions[clearRand], 'Invalid_', 'Invalid_', 'Clear', 30];

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

async function adjustWeather(weatherValues, game)
{
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	await seasonGameTable.readRecords();
	
	// Set all needed weather values
	seasonGameTable.records[game]['Wind'] = weatherValues[0];
	seasonGameTable.records[game]['Precipitation'] = weatherValues[1];
	seasonGameTable.records[game]['CloudCover'] = weatherValues[2];
	seasonGameTable.records[game]['Weather'] = weatherValues[3];
	seasonGameTable.records[game]['Temperature'] = weatherValues[4];
};


franchise.on('ready', async function () {
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	await seasonInfoTable.readRecords();
	const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	
	if (!validWeekTypes.includes(currentWeekType)) // Check if file is in regular season or playoffs, exit if not
	{
		console.log("Selected file is not in a valid week. Only Franchise Files in the regular season or playoffs are supported by this tool. Enter anything to exit.")
		prompt();
		process.exit(0);
	}
	
	await teamTable.readRecords();
	
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	await seasonGameTable.readRecords();
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity; // Number of rows in the SeasonGame table
	
	var selectedGame;
	var allowedGameRows = [];
	
	console.log("\nAvailable Games:");
	
	// Iterate through the schedule table
	for (j=0; j < numRowsSeasonGame; j++) 
	{ 
        // If an empty row or invalid game, skip this row
		if (seasonGameTable.records[j].isEmpty || (seasonGameTable.records[j]['IsPractice'] === true)) 
		{ 
			continue;
        }
		
		if(currentWeek >= 0 && currentWeek < 18)
		{
			if((seasonGameTable.records[j]['SeasonWeekType'] === 'RegularSeason') && (parseInt(seasonGameTable.records[j]['SeasonWeek']) === currentWeek))
			{
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
				if(homeTeamBinVal === zeroRef)
				{
					continue;
				}
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 18)
		{
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'WildcardPlayoff')
			{
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
				if(homeTeamBinVal === zeroRef)
				{
					continue;
				}
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 19)
		{
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'DivisionalPlayoff')
			{
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
				if(homeTeamBinVal === zeroRef)
				{
					continue;
				}
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 20)
		{
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'ConferencePlayoff')
			{
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
				if(homeTeamBinVal === zeroRef)
				{
					continue;
				}
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				console.log(`${j} - ${awayTeamName} @ ${homeTeamName}`);
				allowedGameRows.push(j);
			}
		}
		else if(currentWeek === 22)
		{
			if(seasonGameTable.records[j]['SeasonWeekType'] === 'SuperBowl')
			{
				let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
				if(homeTeamBinVal === zeroRef)
				{
					continue;
				}
				const homeTeamRowBinVal = homeTeamBinVal.slice(15);
				const homeTeamRowNum = await FranchiseUtils.bin2Dec(homeTeamRowBinVal);
				const homeTeamName = teamTable.records[homeTeamRowNum]['DisplayName'];
				
				let awayTeamBinVal = seasonGameTable.records[j]['AwayTeam'];
				const awayTeamRowBinVal = awayTeamBinVal.slice(15);
				const awayTeamRowNum = await FranchiseUtils.bin2Dec(awayTeamRowBinVal);
				const awayTeamName = teamTable.records[awayTeamRowNum]['DisplayName'];
				
				console.log(`${j} - ${awayTeamName} vs ${homeTeamName}`);
				allowedGameRows.push(j);
			}
		}
		else // Somehow not a regular season or playoff week despite checks, so inform user and exit
		{
			console.log("No games available this week. Enter anything to exit the tool.");
			prompt();
		}
    }
	while(true)
	{
		console.log("\nPlease enter the number corresponding to the game you would like to edit:");
		selectedGame = prompt();
		if(allowedGameRows.includes(parseInt(selectedGame)))
		{
			break;
		}
		console.log("Invalid selection.");
	}
	const gameRow = parseInt(selectedGame);
	
	console.log("\nAvailable Weather Options:");
	
	for(i = 0; i < weatherOptions.length; i++)
	{
		console.log(`${i} - ${weatherOptions[i]}`);
	}
	
	var selectedWeather;
	
	while(true)
	{
		console.log("\nPlease enter the number corresponding to the weather you would like:");
		selectedWeather = prompt();
		if(parseInt(selectedWeather) >= 0 && parseInt(selectedWeather) < weatherOptions.length)
		{
			break;
		}
		console.log("Invalid selection.");
	}
	
	const weatherChoice = weatherOptions[parseInt(selectedWeather)];
	
	if(weatherChoice === 'Snow')
	{
		await adjustWeather(snowValues, gameRow);
	}
	else if(weatherChoice === 'Rain (Warm)')
	{
		await adjustWeather(rainWarmValues, gameRow);
	}
	else if(weatherChoice === 'Rain (Cold)')
	{
		await adjustWeather(rainColdValues, gameRow);
	}
	else if(weatherChoice === 'Clear (Warm)')
	{
		await adjustWeather(clearWarmValues, gameRow);
	}
	else if(weatherChoice === 'Clear (Cold)')
	{
		await adjustWeather(clearColdValues, gameRow);
	}
	
	console.log("\nWeather updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	console.log("Enter anything to exit.");
    prompt();
  
});
  