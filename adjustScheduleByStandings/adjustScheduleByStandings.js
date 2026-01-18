// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const path = require('path');
const { getBinaryReferenceData } = require('madden-franchise').utilService;

// Required lookups
const teamDivisionLookup = JSON.parse(fs.readFileSync(path.join(__dirname, './lookupFiles/teamDivisionLookup.json')));

// Print tool header message
console.log("This program will adjust all matchups in a 16 game schedule based on previous year standings to follow the actual previous year's standings.\n");

// Set up franchise file
const validGames = [ 
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25,
	FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

async function adjustGameByStanding(gameRecord, teamRecord, opponentRecord, teamTable, opponentIsAway)
{
	const teamStanding = teamRecord.PrevSeasonDivStanding;
	const opponentStanding = opponentRecord.PrevSeasonDivStanding;

	if(teamStanding < 0 || opponentStanding < 0)
	{
		console.log(`Warning: Unable to adjust game for team ${teamRecord.DisplayName} vs ${opponentRecord.DisplayName} due to invalid standings.`);
		return;
	}

	if(teamStanding === opponentStanding || teamDivisionLookup[teamRecord.index] === teamDivisionLookup[opponentRecord.index])
	{
		// If standings are the same or teams are in the same division, no adjustment needed
		return;
	}

	const columnToAdjust = opponentIsAway ? 'AwayTeam' : 'HomeTeam';

	// Figure out which team should be the opponent based on standings in the division
	const divisionTeams = Object.keys(teamDivisionLookup).filter(teamRow => teamDivisionLookup[teamRow] === teamDivisionLookup[opponentRecord.index]);
	for(const teamRow of divisionTeams)
	{
		const teamDivisionStanding = teamTable.records[teamRow].PrevSeasonDivStanding;

		if(teamDivisionStanding === teamStanding)
		{
			// Found the correct opponent
			const newOpponentBinary = getBinaryReferenceData(teamTable.header.tableId, parseInt(teamRow));

			gameRecord[columnToAdjust] = newOpponentBinary;

			if(FranchiseUtils.DEBUG_MODE)
			{
				console.log(`Adjusted game for team ${teamRecord.DisplayName}: Replaced opponent ${opponentRecord.DisplayName} with ${teamTable.records[teamRow].DisplayName}`);
			}

			return;
		}
	}

	console.log(`Warning: Unable to find suitable opponent to adjust game for team ${teamRecord.DisplayName} vs ${opponentRecord.DisplayName}.`);
}

async function processTeamSchedule(teamRecord, seasonGameTable, teamTable, seasonGameIndices, divisionVsDivisionMap)
{
	const teamRow = teamRecord.index;
	const teamBinary = getBinaryReferenceData(teamTable.header.tableId, teamRow);

	// Filter seasonGameIndices by checking the seasonGameTable value
	const teamScheduleIndices = seasonGameIndices.filter(seasonGameIndex => {
		const seasonGameRecord = seasonGameTable.records[seasonGameIndex];
		return (seasonGameRecord.AwayTeam === teamBinary || seasonGameRecord.HomeTeam === teamBinary);
	});

	const teamPerDivisionGameCount = {};
	const teamPerDivisionGameIndices = {};

	const teamDivision = teamDivisionLookup[teamRow];

	if(!divisionVsDivisionMap.hasOwnProperty(teamDivision))
	{
		divisionVsDivisionMap[teamDivision] = [];
	}
	
	// Process each game in the team's schedule
	for(const seasonGameIndex of seasonGameIndices)
	{		
		const seasonGameRecord = seasonGameTable.records[seasonGameIndex];

		if(seasonGameRecord.AwayTeam !== teamBinary && seasonGameRecord.HomeTeam !== teamBinary)
		{
			continue;
		}

		const opponentBinary = (seasonGameRecord.AwayTeam === teamBinary) ? seasonGameRecord.HomeTeam : seasonGameRecord.AwayTeam;
		const opponentRow = FranchiseUtils.getRowFromRef(opponentBinary);

		const opponentDivision = teamDivisionLookup[opponentRow];

		if(teamDivision === opponentDivision)
		{
			continue; // Skip intra-division games
		}

		if(!teamPerDivisionGameCount.hasOwnProperty(opponentDivision))
		{
			teamPerDivisionGameCount[opponentDivision] = 0;
		}

		if(!teamPerDivisionGameIndices.hasOwnProperty(opponentDivision))
		{
			teamPerDivisionGameIndices[opponentDivision] = [];
		}
		teamPerDivisionGameIndices[opponentDivision].push(seasonGameIndex);
		teamPerDivisionGameCount[opponentDivision]++;
	}

	// Now figure out which divisions only have one game, and those are the ones we need to adjust
	const divisionsToAdjust = Object.keys(teamPerDivisionGameCount).filter(division => teamPerDivisionGameCount[division] === 1);

	if(teamRecord.DisplayName === "Seahawks")
	{
		console.log(teamPerDivisionGameCount);
		console.log(teamPerDivisionGameIndices);
		console.log(divisionsToAdjust);
	}

	// For each division to adjust, we need to find a suitable opponent from that division based on standings
	for(const division of divisionsToAdjust)
	{		
		const gameIndices = teamPerDivisionGameIndices[division];
		if(gameIndices.length !== 1)
		{
			console.log(`Warning: Unexpected number of games to adjust for team ${teamRecord.DisplayName} in division ${division}.`);
			continue; // Should not happen, but just in case
		}
		
		if(!divisionVsDivisionMap[teamDivision].includes(parseInt(division)))
		{
			divisionVsDivisionMap[teamDivision].push(parseInt(division));
		}
	}

}

async function enumerateSeasonGames(seasonGameTable, relevantSeasonGames)
{
	const seasonGameCount = seasonGameTable.header.recordCapacity;

	for(let i = 0; i < seasonGameCount; i++)
	{
		const seasonGameRecord = seasonGameTable.records[i];

		if(seasonGameRecord.isEmpty || seasonGameRecord.SeasonWeekType !== "RegularSeason" || seasonGameRecord.IsPractice || seasonGameRecord.GameStatus !== "Unplayed")
		{
			continue;
		}

		relevantSeasonGames.push(i);
	}
}

async function validateTeamGameCount(teamRecord, teamTable, seasonGameTable, relevantSeasonGames)
{
	const teamBinary = getBinaryReferenceData(teamTable.header.tableId, teamRecord.index);
	let gameCount = 0;

	for(const seasonGameIndex of relevantSeasonGames)
	{
		const seasonGameRecord = seasonGameTable.records[seasonGameIndex];

		if(seasonGameRecord.AwayTeam === teamBinary || seasonGameRecord.HomeTeam === teamBinary)
		{
			gameCount++;
		}
	}

	if(gameCount !== 16)
	{
		console.log(`Warning: Team ${teamRecord.DisplayName} has ${gameCount} games scheduled instead of 16.`);
	}
}


franchise.on('ready', async function () {
	// Get required tables
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);

	const tablesList = [teamTable, seasonGameTable];

	// Read required tables
	await FranchiseUtils.readTableRecords(tablesList);

	const teamCount = teamTable.header.recordCapacity;

	const relevantSeasonGames = [];
	const gamesToAdjust = [];
	const divisionVsDivisionMap = {};
	
	await enumerateSeasonGames(seasonGameTable, relevantSeasonGames);

	// Process each team
	for(let i = 0; i < teamCount; i++)
	{
		const teamRecord = teamTable.records[i];
		
		// If team is not valid, skip
		if(teamRecord.isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(teamRecord.DisplayName) || !teamRecord.TEAM_VISIBLE)
		{
			continue;
		}

		await processTeamSchedule(teamRecord, seasonGameTable, teamTable, relevantSeasonGames, divisionVsDivisionMap);

		
	}

	for(const gameIndex of relevantSeasonGames)
	{
		const gameToAdjust = seasonGameTable.records[gameIndex];
		const homeTeamRow = await FranchiseUtils.getRowFromRef(gameToAdjust.HomeTeam);
		const awayTeamRow = await FranchiseUtils.getRowFromRef(gameToAdjust.AwayTeam);

		const homeTeamDivision = teamDivisionLookup[homeTeamRow];
		const awayTeamDivision = teamDivisionLookup[awayTeamRow];

		const homeTeamRecord = teamTable.records[homeTeamRow];
		const awayTeamRecord = teamTable.records[awayTeamRow];

		if(homeTeamDivision === awayTeamDivision)
		{
			continue; // Skip intra-division games
		}

		if(divisionVsDivisionMap.hasOwnProperty(homeTeamDivision) && divisionVsDivisionMap[homeTeamDivision].includes(awayTeamDivision))
		{
			// Adjust the game based on standings
			await adjustGameByStanding(gameToAdjust, homeTeamRecord, awayTeamRecord, teamTable, true);
		}
	}

	for(let i = 0; i < teamCount; i++)
	{
		const teamRecord = teamTable.records[i];
		
		// If team is not valid, skip
		if(teamRecord.isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(teamRecord.DisplayName) || !teamRecord.TEAM_VISIBLE)
		{
			continue;
		}

		await validateTeamGameCount(teamRecord, teamTable, seasonGameTable, relevantSeasonGames);
	}

	// Program complete, so print success message and exit
	console.log(`\nSchedule updated successfully.\n`);
	await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  