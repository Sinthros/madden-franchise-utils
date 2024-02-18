const fs = require('fs');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

console.log("This program will allow you to extract the schedule in your Madden 24 franchise file to JSON. This tool must be run during the first week of preseason.\n")
const gameYear = '24';

const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

const scheduleObject = {
	year: 0,
	weeks: []
};

const validWeekTypes = ['PreSeason'];
const zeroRef = '00000000000000000000000000000000';

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

function convertMinutesToTime(minutes)
{
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	const period = hours >= 12 ? 'PM' : 'AM';
	const hour = hours % 12 || 12;
	return `${hour}:${remainder.toString().padStart(2, '0')}${period}`;
}

function parseDay(day)
{
	if (day === 'Sunday') {
		return 'Sun';
	}
	else if (day === 'Thursday') {
		return 'Thu';
	}
	else if (day === 'Saturday') {
		return 'Sat';
	}
	else if (day === 'Monday') {
		return 'Mon';
	}
	else if (day === 'Tuesday') {
		return 'Tue';
	}
	else if (day === 'Wednesday') {
		return 'Wed';
	}
	else if (day === 'Friday') {
		return 'Fri';
	}
	else {
		return 'Sun';
	}
}
async function parseGameData(seasonGameTable, j, indGameData, teamTable)
{
	let rawDay = seasonGameTable.records[j]['DayOfWeek'];
	let convertedDay = parseDay(rawDay);

	let rawTime = seasonGameTable.records[j]['TimeOfDay'];
	let convertedTime = convertMinutesToTime(rawTime);

	let homeTeamRef = seasonGameTable.records[j]['HomeTeam'];
	let homeTeamRow = await FranchiseUtils.bin2Dec(homeTeamRef.slice(15));
	let homeTeamName = teamTable.records[homeTeamRow]['LongName'] + ' ' + teamTable.records[homeTeamRow]['DisplayName'];

	let awayTeamRef = seasonGameTable.records[j]['AwayTeam'];
	let awayTeamRow = await FranchiseUtils.bin2Dec(awayTeamRef.slice(15));
	let awayTeamName = teamTable.records[awayTeamRow]['LongName'] + ' ' + teamTable.records[awayTeamRow]['DisplayName'];

	indGameData.day = convertedDay;
	indGameData.time = convertedTime;
	indGameData.homeTeam = homeTeamName;
	indGameData.awayTeam = awayTeamName;

}


franchise.on('ready', async function () {
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	await seasonInfoTable.readRecords();
	const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	scheduleObject.year = `${parseInt(seasonInfoTable.records[0]['CurrentSeasonYear'])}`;
	
	if (!validWeekTypes.includes(currentWeekType) || currentWeek > 0) // Check if file is in first week of preseason, exit if not
	{
		console.log("Selected file is not in a valid week. Only Franchise Files in the first week of the preseason are supported by this tool. Enter anything to exit.")
		prompt();
		process.exit(0);
	}
	
	await teamTable.readRecords();
	
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	await seasonGameTable.readRecords();
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity; // Number of rows in the SeasonGame table
	
	var selectedGame;
	
	// Parse the games one week at a time
	for (let i = 0; i < 18; i++)
	{ 
		let indWeekData = {
			type: 'season',
			number: `${i + 1}`,
			games: undefined
		};
		// Array of games for the week
		let gamesArray = [];
		// Iterate through the schedule table
		for (let j = 0; j < numRowsSeasonGame; j++)
		{
			// If an empty row or irrelevant game, skip this row
			if ((seasonGameTable.records[j].isEmpty) ||
				(seasonGameTable.records[j]['IsPractice'] === true) ||
				(seasonGameTable.records[j]['HomeTeam'] === zeroRef) ||
				(seasonGameTable.records[j]['SeasonWeekType'] !== 'RegularSeason') ||
				(seasonGameTable.records[j]['SeasonWeek'] !== i))
			{
				continue;
			}


			// Parse the game data into the schedule object
			let indGameData = {
				day: undefined,
				time: undefined,
				homeTeam: undefined,
				awayTeam: undefined
			};

			await parseGameData(seasonGameTable, j, indGameData, teamTable);
			gamesArray.push(indGameData);

			// The week is complete, so no need to continue iterating, move on to the next week
			if (gamesArray.length === 16)
			{
				break;
			}
		}

		indWeekData.games = gamesArray;
		scheduleObject.weeks.push(indWeekData);
    }

	// Convert object to string
	const jsonString = JSON.stringify(scheduleObject, null, 2);

	const fileName = `${scheduleObject.year}.json`;

	// Write to file named year.json
	fs.writeFileSync(fileName, jsonString, 'utf-8');

	console.log(`\nSchedule extracted successfully. JSON saved to ${fileName}. Your franchise file has not been modified.\n`);
	console.log("Enter anything to exit.");
    prompt();
  
});
  