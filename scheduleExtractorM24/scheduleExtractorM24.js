// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Required lookups
const teamLookup = JSON.parse(fs.readFileSync('teamLookup.json', 'utf8'));

// Print tool header message
console.log("This program will allow you to extract the schedule in your Madden 24 franchise file to JSON. This tool must be run during the preseason.\n")

// Set up franchise file
const gameYear = FranchiseUtils.YEARS.M24;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);
const tables = FranchiseUtils.getTablesObject(franchise);

// Object to store the schedule data
const scheduleObject = {
	year: 0,
	weeks: []
};

/**
 * Converts minutes since midnight to a regular time string
 * 
 * @param {number} minutes The number of minutes since midnight
 * @returns {string} The time string in H:MM AM/PM format (ex: 7:30 PM)
 */
function convertMinutesToTime(minutes)
{
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	const period = hours >= 12 ? 'PM' : 'AM';
	const hour = hours % 12 || 12;
	return `${hour}:${remainder.toString().padStart(2, '0')}${period}`;
}

/**
 * Converts a day of the week to its three letter variant
 * 
 * @param {string} day The full day of the week 
 * @returns {strng} The three letter abbreviation of the day
 */
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

/**
 * Parses game data from the season game table
 * 
 * @param {Object} seasonGameTable The season game table object
 * @param {number} j The row number to parse 
 * @param {Object} indGameData The object to store the parsed game data 
 */
async function parseGameData(seasonGameTable, j, indGameData)
{
	let rawDay = seasonGameTable.records[j]['DayOfWeek'];
	let convertedDay = parseDay(rawDay);

	let rawTime = seasonGameTable.records[j]['TimeOfDay'];
	let convertedTime = convertMinutesToTime(rawTime);

	let homeTeamRef = seasonGameTable.records[j]['HomeTeam'];
	let homeTeamRow = await FranchiseUtils.bin2Dec(homeTeamRef.slice(15));
	let homeTeamName = teamLookup[homeTeamRow][0];

	let awayTeamRef = seasonGameTable.records[j]['AwayTeam'];
	let awayTeamRow = await FranchiseUtils.bin2Dec(awayTeamRef.slice(15));
	let awayTeamName = teamLookup[awayTeamRow][0];

	indGameData.day = convertedDay;
	indGameData.time = convertedTime;
	indGameData.homeTeam = homeTeamName;
	indGameData.awayTeam = awayTeamName;

}


franchise.on('ready', async function () {
	// Make sure this franchise file is for a valid game year
	FranchiseUtils.validateGameYears(franchise,gameYear);
	
    // Get required tables
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	
	// Read required tables
	await FranchiseUtils.readTableRecords([teamTable, seasonInfoTable, seasonGameTable]);
	
	// Verify that the franchise file is in a valid week

	// Get the current week type
	const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];

	// Valid week types to run the tool during
	const validWeekTypes = ['PreSeason'];

	// If the file is not in the preseason, inform the user and exit
	if (!validWeekTypes.includes(currentWeekType))
	{
		console.log("Selected file is not in a valid week. Only Franchise Files in the preseason are supported by this tool.")
		FranchiseUtils.EXIT_PROGRAM();
	}
	
	// We can immediately get the year for the schedule object from SeasonInfo
	scheduleObject.year = `${parseInt(seasonInfoTable.records[0]['CurrentSeasonYear'])}`;
	
	// Number of rows in the SeasonGame table
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity;
	
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
				(seasonGameTable.records[j]['HomeTeam'] === FranchiseUtils.ZERO_REF) ||
				(seasonGameTable.records[j]['SeasonWeekType'] !== 'RegularSeason') ||
				(seasonGameTable.records[j]['SeasonWeek'] !== i))
			{
				continue;
			}


			// New object to store the game data
			let indGameData = {
				day: undefined,
				time: undefined,
				homeTeam: undefined,
				awayTeam: undefined
			};

			// Read the game data from the current row into the object
			await parseGameData(seasonGameTable, j, indGameData);

			// Add the game to the array of games for the week
			gamesArray.push(indGameData);

			// If we have 16 games, the week must complete, so no need to continue iterating, move on to the next week
			if (gamesArray.length === 16)
			{
				break;
			}
		}

		// Add the array of games to the week object
		indWeekData.games = gamesArray;
		
		// Add the week object to the schedule object
		scheduleObject.weeks.push(indWeekData);
    }

	// Iterate through each week
	scheduleObject.weeks.forEach(week => {
		// Sort games in chronological order, assuming Wednesday is the first day of the week
		week.games.sort((game1, game2) => {
			// Compare days
			const dayOrder = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
			const day1Index = dayOrder.indexOf(game1.day);
			const day2Index = dayOrder.indexOf(game2.day);

			// If the days are different, just sort by day
			if (day1Index !== day2Index) 
			{
				return day1Index - day2Index;
			}
	
			// If days are the same, compare times, ensuring AM games come before PM games
			const time1 = game1.time.split(':');
			const time2 = game2.time.split(':');
			const hour1 = parseInt(time1[0]);
			const hour2 = parseInt(time2[0]);
			const minute1 = parseInt(time1[1].substr(0, 2));
			const minute2 = parseInt(time2[1].substr(0, 2));

			// Get the two AM/PM values
			const period1 = time1[1].substr(2);
			const period2 = time2[1].substr(2);

			// If they are not the same period, sort based on the period
			if (period1 !== period2) 
			{
				return period1 === 'AM' ? -1 : 1;
			}

			// If the periods are the same, sort by hour
			if (hour1 !== hour2) 
			{
				return hour1 - hour2;
			}

			// If the hours are the same, sort by minute
			return minute1 - minute2;
		});
	});

	// Convert object to string
	const jsonString = JSON.stringify(scheduleObject, null, 2);

	// Write to file named year.json
	const fileName = `${scheduleObject.year}.json`;
	fs.writeFileSync(fileName, jsonString, 'utf-8');

	// Program complete, so print success message and exit
	console.log(`\nSchedule extracted successfully. JSON saved to ${fileName}. Your franchise file has not been modified.\n`);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  