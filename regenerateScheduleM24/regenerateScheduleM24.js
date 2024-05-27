const fs = require('fs');
const prompt = require('prompt-sync')();
const papa = require('papaparse');
const execSync = require('child_process').execSync;
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const TRANSFER_SCHEDULE_FUNCTIONS = require('../retroSchedules/transferScheduleFromJson');
const { tables } = require('../lookupFunctions/FranchiseTableId');

console.log("This program will allow you to regenerate the schedule in your Madden 24 franchise file to be closer to a real NFL schedule. This tool must be run during the preseason.\n")
const gameYear = '24';

const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

const scheduleObject = {
	year: 0,
	weeks: []
};

const teamLookup = JSON.parse(fs.readFileSync('lookupFiles/teamLookup.json', 'utf8'));
const teamAbbrevLookup = JSON.parse(fs.readFileSync('lookupFiles/teamAbbrevLookup.json', 'utf8'));
const teamIdentityLookup = JSON.parse(fs.readFileSync('lookupFiles/teamIdentityLookup.json', 'utf8'));
const timeSlotLookup = JSON.parse(fs.readFileSync('lookupFiles/timeSlotLookup.json', 'utf8'));

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
	let homeTeamName = teamLookup[homeTeamRow][0];

	let awayTeamRef = seasonGameTable.records[j]['AwayTeam'];
	let awayTeamRow = await FranchiseUtils.bin2Dec(awayTeamRef.slice(15));
	let awayTeamName = teamLookup[awayTeamRow][0];

	indGameData.day = convertedDay;
	indGameData.time = convertedTime;
	indGameData.homeTeam = homeTeamName;
	indGameData.awayTeam = awayTeamName;

}

function dumpMatchups(scheduleObject)
{
	let matchups = [];
	scheduleObject.weeks.forEach(week => {
		week.games.forEach(game => {
			const homeTeam = findTeamAbbrev(game.homeTeam);
			const awayTeam = findTeamAbbrev(game.awayTeam);

			let matchup = {
				"Away Team": awayTeam,
				"Home Team": homeTeam
			};

			matchups.push(matchup);
		});
	});

	const csv = papa.unparse(matchups);

	// Write to csv
	fs.writeFileSync('_internal/Opponents 17G Season 2016.csv', csv, 'utf-8');
}

function findTeamAbbrev(teamName)
{
	const teamRows = Object.keys(teamLookup);
	
	for (let i = 0; i < teamRows.length; i++)
	{
		if (teamLookup[teamRows[i]][0] === teamName)
		{
			return rowToAbbrev(teamRows[i]);
		}
	}
	return "UNK";
}

function rowToAbbrev(row)
{
	const teamAbbrevs = Object.keys(teamAbbrevLookup);

	for (let i = 0; i < teamAbbrevs.length; i++)
	{
		if (teamAbbrevLookup[teamAbbrevs[i]] === parseInt(row))
		{
			return teamAbbrevs[i];
		}
	}
}

async function getSuperBowlChampion(yearSummaryArray, yearSummary, teamTable)
{
	const numYears = yearSummaryArray.arraySizes[0];

	let yearSummaryRef = yearSummaryArray.records[0][`YearSummary${numYears - 1}`];
	let yearSummaryRow = await FranchiseUtils.bin2Dec(yearSummaryRef.slice(15));

	let nfcScore = yearSummary.records[yearSummaryRow]['NFC_SB_Score'];
	let afcScore = yearSummary.records[yearSummaryRow]['AFC_SB_Score'];

	let winningConference = nfcScore > afcScore ? 'NFC' : 'AFC';

	let winningCityName = yearSummary.records[yearSummaryRow][`${winningConference}_CityName`];
	let winningTeamNameRef = yearSummary.records[yearSummaryRow][`${winningConference}_Team_Identity`];

	let winningTeamName;
	for(let i = 0; i < teamIdentityLookup.length; i++)
	{
		if (teamIdentityLookup[i]['binaryReference'] === winningTeamNameRef)
		{
			winningTeamName = teamIdentityLookup[i]['teamName'];
			break;
		}
	}

	let winningTeamRow = -1;
	let teamRows = Object.keys(teamLookup);
	for (let i = 0; i < teamRows.length; i++)
	{
		if (teamLookup[teamRows[i]][0].includes(winningTeamName))
		{
			if(teamTable.records[teamRows[i]]['LongName'] === winningCityName)
			{
				winningTeamRow = teamRows[i];
				break;
			}
		}
	}

	if(winningTeamRow === -1)
	{
		// If the winning team is not found for some reason, just use the first team row
		winningTeamRow = 0;
	}

	let winningTeamAbbrev = rowToAbbrev(winningTeamRow);

	return winningTeamAbbrev;
}

function convertOptimizedSchedule(scheduleSolutionInfo, newSchedule)
{
	// Parse each game in the schedule solution
	for (let i = 0; i < scheduleSolutionInfo["Vars"].length; i++)
		{ 
			let gameString = scheduleSolutionInfo["Vars"][i]['VarName'];
	
			let gameData = gameString.split('_');
	
			let awayTeam = gameData[1];
	
			if(awayTeam === 'BYE')
			{
				continue;
			}
	
			awayTeam = teamLookup[teamAbbrevLookup[gameData[1]]][0];
	
			let homeTeam = teamLookup[teamAbbrevLookup[gameData[2]]][0];
			let timeSlot = gameData[3] + "_" + gameData[4];
			let week = gameData[5];
	
			//console.log(timeSlot);
	
			let day = timeSlotLookup[timeSlot]["Day"];
			let time = timeSlotLookup[timeSlot]["Time"];
			
			let indGameData = {
				day: day,
				time: time,
				homeTeam: homeTeam,
				awayTeam: awayTeam
			};
	
			if(newSchedule.weeks.find(weekData => weekData.number === week) === undefined)
			{
				let indWeekData = {
					type: 'season',
					number: week,
					games: []
				};
	
				newSchedule.weeks.push(indWeekData);
			}
	
			newSchedule.weeks.find(weekData => weekData.number === week).games.push(indGameData);
			
		}
	
		// Iterate through each week
		newSchedule.weeks.forEach(week => {
			// Sort games within the week
			week.games.sort((game1, game2) => {
				// Compare days
				const dayOrder = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
				const day1Index = dayOrder.indexOf(game1.day);
				const day2Index = dayOrder.indexOf(game2.day);
				if (day1Index !== day2Index) {
					return day1Index - day2Index;
				}
	
				// If days are the same, compare times
				const [hour1, minute1] = game1.time.split(":").map(Number);
				const [hour2, minute2] = game2.time.split(":").map(Number);
	
				if (hour1 !== hour2) {
					return hour1 - hour2;
				}
	
				return minute1 - minute2;
			});
		});
	
		// Sort weeks by week number
		newSchedule.weeks = newSchedule.weeks.sort((week1, week2) => week1.number - week2.number);

		return newSchedule;
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

function runProgram(command)
{
	try
	{
		execSync(command);
	}
	catch (error)
	{
		console.log("Execution failed. Please inform WiiMaster immediately. Enter anything to exit.");
		fs.unlinkSync('HW12-17Game.exe');
		prompt();
		process.exit(0);
	}

}


franchise.on('ready', async function () {
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	await seasonInfoTable.readRecords();
	const currentWeekType = seasonInfoTable.records[0]['CurrentWeekType'];
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	scheduleObject.year = `${parseInt(seasonInfoTable.records[0]['CurrentSeasonYear'])}`;
	
	if (!validWeekTypes.includes(currentWeekType)) // Check if file is in first week of preseason, exit if not
	{
		console.log("Selected file is not in a valid week. Only Franchise Files in the preseason are supported by this tool. Enter anything to exit.")
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

	// Iterate through each week
	scheduleObject.weeks.forEach(week => {
		// Sort games within the week
		week.games.sort((game1, game2) => {
			// Compare days
			const dayOrder = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];
			const day1Index = dayOrder.indexOf(game1.day);
			const day2Index = dayOrder.indexOf(game2.day);
			if (day1Index !== day2Index) {
				return day1Index - day2Index;
			}

			// If days are the same, compare times
			const [hour1, minute1] = game1.time.split(":").map(Number);
			const [hour2, minute2] = game2.time.split(":").map(Number);

			if (hour1 !== hour2) {
				return hour1 - hour2;
			}

			return minute1 - minute2;
		});
	});

	dumpMatchups(scheduleObject);

	// Auxiliary lookup for other relevant info
	const auxLookup = {
		superBowlChampion: ""
	};

	const yearSummaryArray = franchise.getTableByUniqueId(tables.yearSummaryArray);
	const yearSummary = franchise.getTableByUniqueId(tables.yearSummary);
	await yearSummaryArray.readRecords();
	await yearSummary.readRecords();

	auxLookup.superBowlChampion = await getSuperBowlChampion(yearSummaryArray, yearSummary, teamTable);

	const auxLookupString = JSON.stringify(auxLookup, null, 2);

	const auxFilePath = `_internal/auxiliaryLookup.json`;

	fs.writeFileSync(auxFilePath, auxLookupString, 'utf-8');

	fs.copyFileSync('HW12-17Game.exe', './HW12-17Game.exe');

	if(fs.existsSync('solution.json'))
	{
		const useOld = getYesOrNo("\nAn existing generated schedule was found from a previous run of this tool. Would you like to use this? Enter yes to use it or no to generate a new one:");
		if(!useOld)
		{
			fs.unlinkSync('solution.json');
			console.log("\nBeginning generation of schedule. Please be patient, as this may take several minutes.");
			runProgram('HW12-17Game.exe > GeneratorLog.txt');
			if(!fs.existsSync('solution.json'))
			{
				console.log("\nSchedule generation failed. Please inform WiiMaster immediately. Enter anything to exit.");
				fs.unlinkSync('HW12-17Game.exe');
				prompt();
				process.exit(0);
			}
		}
	}
	else
	{
		console.log("\nBeginning generation of schedule. Please be patient, as this may take several minutes.");

		runProgram('HW12-17Game.exe > GeneratorLog.txt');
	}
	

	if(!fs.existsSync('solution.json'))
	{
		console.log("\nSchedule generation failed. Please inform WiiMaster immediately.\n\nEnter anything to exit.");
		fs.unlinkSync('HW12-17Game.exe');
		prompt();
		process.exit(0);
	}

	fs.unlinkSync('HW12-17Game.exe');

	const scheduleFilePath = 'solution.json';

	const scheduleSolutionData = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'));

	let newScheduleObject = {
		weeks: []
	};

	newScheduleObject = convertOptimizedSchedule(scheduleSolutionData, newScheduleObject);

	newScheduleObject.year = scheduleObject.year;

	// Save new schedule to file
	const newScheduleJsonString = JSON.stringify(newScheduleObject, null, 2);
	const newScheduleFileName = `${newScheduleObject.year}.json`;
	//fs.writeFileSync(newScheduleFileName, newScheduleJsonString, 'utf-8');

	let transferStatus = await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(newScheduleObject, franchise);

	if(!transferStatus)
	{
		console.log("\nUnable to transfer new schedule. Please inform WiiMaster immediately.\n\nEnter anything to exit.");
		prompt();
		process.exit(0);
	}

	console.log(`\nSchedule generated and transferred successfully.`);
	await FranchiseUtils.saveFranchiseFile(franchise);
	console.log("\nEnter anything to exit.");
    prompt();
  
});
  