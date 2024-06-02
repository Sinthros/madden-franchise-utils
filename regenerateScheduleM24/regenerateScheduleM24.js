// Required modules
const fs = require('fs');
const papa = require('papaparse');
const execSync = require('child_process').execSync;
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const TRANSFER_SCHEDULE_FUNCTIONS = require('../retroSchedules/transferScheduleFromJson');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// Required lookup files
const teamLookup = JSON.parse(fs.readFileSync('lookupFiles/teamLookup.json', 'utf8'));
const teamAbbrevLookup = JSON.parse(fs.readFileSync('lookupFiles/teamAbbrevLookup.json', 'utf8'));
const teamIdentityLookup = JSON.parse(fs.readFileSync('lookupFiles/teamIdentityLookup.json', 'utf8'));
const timeSlotLookup = JSON.parse(fs.readFileSync('lookupFiles/timeSlotLookup.json', 'utf8'));

// Print tool header message
console.log("This program will allow you to regenerate the schedule in your Madden 24 franchise file to be closer to a real NFL schedule. This tool must be run during the preseason.\n")

// Set up franchise file
const gameYear = 24;
const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

// Set up base schedule object
const scheduleObject = {
	year: 0,
	weeks: []
};

// This function converts minutes since midnight to a regular time string
function convertMinutesToTime(minutes)
{
	// Get the hour
	const hours = Math.floor(minutes / 60);

	// Get the remaining minutes
	const remainder = minutes % 60;

	// Determine if it's AM or PM
	const period = hours >= 12 ? 'PM' : 'AM';

	// Get the hour in 12-hour format
	const hour = hours % 12 || 12;

	// Return the formatted time
	return `${hour}:${remainder.toString().padStart(2, '0')}${period}`;
}

// This function will convert a day of the week to its three letter variant
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

// This function will parse the game data from the season game table
async function parseGameData(seasonGameTable, j, indGameData, teamTable)
{
	// Get the day and convert it to the three letter variant
	let rawDay = seasonGameTable.records[j]['DayOfWeek'];
	let convertedDay = parseDay(rawDay);

	// Get the minutes since midnight time value and convert it to a time string
	let rawTime = seasonGameTable.records[j]['TimeOfDay'];
	let convertedTime = convertMinutesToTime(rawTime);

	// Get the home team ref and convert it to the team name
	let homeTeamRef = seasonGameTable.records[j]['HomeTeam'];
	let homeTeamRow = await FranchiseUtils.bin2Dec(homeTeamRef.slice(15));
	let homeTeamName = teamLookup[homeTeamRow][0];

	// Get the away team ref and convert it to the team name
	let awayTeamRef = seasonGameTable.records[j]['AwayTeam'];
	let awayTeamRow = await FranchiseUtils.bin2Dec(awayTeamRef.slice(15));
	let awayTeamName = teamLookup[awayTeamRow][0];

	// Add the converted data to the game object
	indGameData.day = convertedDay;
	indGameData.time = convertedTime;
	indGameData.homeTeam = homeTeamName;
	indGameData.awayTeam = awayTeamName;

}

// This function will dump the matchups in the current schedule to a CSV file
function dumpMatchups(scheduleObject)
{
	// Array to hold each matchup object
	let matchups = [];

	// For each week in the schedule
	scheduleObject.weeks.forEach(week => {
		// For each game in the week
		week.games.forEach(game => {
			// Get the abbreviation for the home and away team
			const homeTeam = findTeamAbbrev(game.homeTeam);
			const awayTeam = findTeamAbbrev(game.awayTeam);
			
			// Write the team abbreviations to the matchup object
			let matchup = {
				"Away Team": awayTeam,
				"Home Team": homeTeam
			};

			// Add this matchup to the list of matchups
			matchups.push(matchup);
		});
	});

	// Convert the JSON into a CSV
	const csv = papa.unparse(matchups);

	// Write to a CSV file
	fs.writeFileSync('_internal/Opponents 17G Season 2016.csv', csv, 'utf-8');
}

// This function finds the team abbreviation given the team name
function findTeamAbbrev(teamName)
{
	// Get the possible team table row numbers
	const teamRows = Object.keys(teamLookup);
	
	// Iterate through the list of rows
	for (let i = 0; i < teamRows.length; i++)
	{
		// If the team name mapped by the current row matches the team name we're looking for
		if (teamLookup[teamRows[i]][0] === teamName)
		{
			// Convert the row to an abbreviation and return it
			return rowToAbbrev(teamRows[i]);
		}
	}

	// If the team is not found, return "UNK"
	return "UNK";
}

// This function converts a team table row number to a team abbreviation
function rowToAbbrev(row)
{
	// Get the possible team abbreviations
	const teamAbbrevs = Object.keys(teamAbbrevLookup);

	// Iterate through the list of abbreviations
	for (let i = 0; i < teamAbbrevs.length; i++)
	{
		// If the row mapped by the current abbreviation matches the row we're looking for
		if (teamAbbrevLookup[teamAbbrevs[i]] === parseInt(row))
		{
			// Return the abbreviation
			return teamAbbrevs[i];
		}
	}
}

// This function pulls the most recent Super Bowl champion from the franchise file
async function getSuperBowlChampion(yearSummaryArray, yearSummary, teamTable)
{
	// Determine how many years are complete in this franchise file
	const numYears = yearSummaryArray.arraySizes[0];

	// Get the row number for the most recent year summary
	let yearSummaryRef = yearSummaryArray.records[0][`YearSummary${numYears - 1}`];
	let yearSummaryRow = await FranchiseUtils.bin2Dec(yearSummaryRef.slice(15));

	// Get the team scores from the most recent Super Bowl
	let nfcScore = yearSummary.records[yearSummaryRow]['NFC_SB_Score'];
	let afcScore = yearSummary.records[yearSummaryRow]['AFC_SB_Score'];

	// Figure out which of the two conferences won
	let winningConference = nfcScore > afcScore ? 'NFC' : 'AFC';

	// Get the city name and team identity reference for the winning team
	let winningCityName = yearSummary.records[yearSummaryRow][`${winningConference}_CityName`];
	let winningTeamNameRef = yearSummary.records[yearSummaryRow][`${winningConference}_Team_Identity`];

	// Get the team name from the team identity reference
	let winningTeamName;
	for(let i = 0; i < teamIdentityLookup.length; i++)
	{
		// If the team identity reference matches
		if (teamIdentityLookup[i]['binaryReference'] === winningTeamNameRef)
		{
			// Store this as the team name and stop
			winningTeamName = teamIdentityLookup[i]['teamName'];
			break;
		}
	}

	// Find the row number for the winning team from the team lookup
	let winningTeamRow = -1;

	// List of possible team rows
	let teamRows = Object.keys(teamLookup);
	for (let i = 0; i < teamRows.length; i++)
	{
		// If the team name mapped by the current row contains the winning team name
		if (teamLookup[teamRows[i]][0].includes(winningTeamName))
		{
			// Make sure the winning city name matches too for a sanity check
			if(teamTable.records[teamRows[i]]['LongName'] === winningCityName)
			{
				// Store this as the row of the winning team and stop
				winningTeamRow = teamRows[i];
				break;
			}
		}
	}

	// If the winning team is not found for some reason, just use the first team row
	if(winningTeamRow === -1)
	{
		winningTeamRow = 0;
	}

	// Find the abbreviation for the winning team based on row number and return it
	let winningTeamAbbrev = rowToAbbrev(winningTeamRow);
	return winningTeamAbbrev;
}

// This function converts the optimized schedule solution into a JSON format we can transfer to the franchise file
function convertOptimizedSchedule(scheduleSolutionInfo, newSchedule)
{
	// Parse each game in the schedule solution
	for (let i = 0; i < scheduleSolutionInfo["Vars"].length; i++)
	{ 
		// Get the string representing the game
		let gameString = scheduleSolutionInfo["Vars"][i]['VarName'];
		
		// Split the string into its components
		let gameData = gameString.split('_');
		
		// The away team is the second component
		let awayTeam = gameData[1];
		
		// If it's a bye game, skip processing it
		if(awayTeam === 'BYE')
		{
			continue;
		}
		
		// Get the name of the away team from the abbreviation
		awayTeam = teamLookup[teamAbbrevLookup[gameData[1]]][0];
		
		// Get the name of the home team from the abbreviation pulled from the second component of the game string
		let homeTeam = teamLookup[teamAbbrevLookup[gameData[2]]][0];

		// Get the day and time slot from the fourth and fifth components
		let timeSlot = gameData[3] + "_" + gameData[4];

		// Get the week number from the sixth component
		let week = gameData[5];
		
		// Get the day and time values based on the time slot
		let day = timeSlotLookup[timeSlot]["Day"];
		let time = timeSlotLookup[timeSlot]["Time"];
		
		// Create the game object based on the parsed data
		let indGameData = {
			day: day,
			time: time,
			homeTeam: homeTeam,
			awayTeam: awayTeam
		};
		
		// If the week number is not already in the schedule object, add it
		if(newSchedule.weeks.find(weekData => weekData.number === week) === undefined)
		{
			// Create the new week object
			let indWeekData = {
				type: 'season',
				number: week,
				games: []
			};
			
			// Add it to the list of weeks
			newSchedule.weeks.push(indWeekData);
		}
		
		// Add the game to the appropriate week
		newSchedule.weeks.find(weekData => weekData.number === week).games.push(indGameData);
			
	}
	
	// Iterate through each week
	newSchedule.weeks.forEach(week => {
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
	
	// Sort weeks by week number
	newSchedule.weeks = newSchedule.weeks.sort((week1, week2) => week1.number - week2.number);

	// Return the converted schedule
	return newSchedule;
}

// This function will synchronously run the command passed to it
function runProgram(command)
{
	try
	{
		execSync(command);
	}
	catch (error)
	{
		console.log("Execution failed. Please inform WiiMaster immediately.");
		fs.unlinkSync('HW12-17Game.exe');
		FranchiseUtils.EXIT_PROGRAM();
	}

}


franchise.on('ready', async function () {
    // Get required tables
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	const yearSummaryArray = franchise.getTableByUniqueId(tables.yearSummaryArray);
	const yearSummary = franchise.getTableByUniqueId(tables.yearSummary);

	// Read required tables
	await FranchiseUtils.readTableRecords([teamTable, seasonInfoTable, seasonGameTable, yearSummaryArray, yearSummary]);	

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
	
	// Parse the games one week at a time into the schedule object
	for (let i = 0; i < 18; i++)
	{ 
		// Create a new week object
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
			await parseGameData(seasonGameTable, j, indGameData, teamTable);

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

	// Dump the matchups in the current schedule to a CSV file
	dumpMatchups(scheduleObject);

	// Auxiliary lookup object for other relevant info from the franchise file that is needed for generation
	const auxLookup = {
		superBowlChampion: ""
	};

	// Get the most recent Super Bowl champion and store it in the auxiliary lookup object
	auxLookup.superBowlChampion = await getSuperBowlChampion(yearSummaryArray, yearSummary, teamTable);

	// Write the auxiliary lookup object to a JSON file
	const auxLookupString = JSON.stringify(auxLookup, null, 2);
	const auxFilePath = `_internal/auxiliaryLookup.json`;
	fs.writeFileSync(auxFilePath, auxLookupString, 'utf-8');

	// Copy the generator to the working directory
	fs.copyFileSync('HW12-17Game.exe', './HW12-17Game.exe');

	// If an existing schedule solution is present
	if(fs.existsSync('solution.json'))
	{
		// Ask the user if they want to use the existing solution
		const useOld = FranchiseUtils.getYesOrNo("\nAn existing generated schedule was found from a previous run of this tool. Would you like to use this? Enter yes to use it or no to generate a new one:");
		
		// If not, delete the old solution and generate a new one
		if(!useOld)
		{
			fs.unlinkSync('solution.json');
			console.log("\nBeginning generation of schedule. Please be patient, as this may take several minutes.");
			// Run the generator and log the output to a file
			runProgram('HW12-17Game.exe > GeneratorLog.txt');

			// Check if the solution was generated successfully, if not, inform the user, clean up, and exit
			if(!fs.existsSync('solution.json'))
			{
				console.log("\nSchedule generation failed. Please inform WiiMaster immediately.");
				fs.unlinkSync('HW12-17Game.exe');
				FranchiseUtils.EXIT_PROGRAM();
			}
		}
	}
	else // If no existing solution is present, generate a new one
	{
		console.log("\nBeginning generation of schedule. Please be patient, as this may take several minutes.");

		// Run the generator and log the output to a file
		runProgram('HW12-17Game.exe > GeneratorLog.txt');
	}
	
	// Check if the solution was generated successfully, if not, inform the user, clean up, and exit
	if(!fs.existsSync('solution.json'))
	{
		console.log("\nSchedule generation failed. Please inform WiiMaster immediately.");
		fs.unlinkSync('HW12-17Game.exe');
		FranchiseUtils.EXIT_PROGRAM();
	}

	// Delete the generator executable
	fs.unlinkSync('HW12-17Game.exe');

	// Read the schedule solution data from the file
	const scheduleFilePath = 'solution.json';
	const scheduleSolutionData = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'));

	// Convert the optimized schedule solution into a JSON format we can transfer to the franchise file
	let newScheduleObject = {
		weeks: []
	};
	newScheduleObject = convertOptimizedSchedule(scheduleSolutionData, newScheduleObject);

	// Copy the year from the old schedule to the new schedule
	newScheduleObject.year = scheduleObject.year;

	// Attempt to transfer the new schedule JSON to the franchise file
	let transferStatus = await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(newScheduleObject, franchise);

	// If the transfer failed, inform the user and exit
	if(!transferStatus)
	{
		console.log("\nUnable to transfer new schedule. Please inform WiiMaster immediately.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	// Program complete, so print success message, save the franchise file, and exit
	console.log(`\nSchedule generated and transferred successfully.`);
	await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  