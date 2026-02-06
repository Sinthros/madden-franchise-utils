// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const prompt = require('prompt-sync')();

const validGames = [
	FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log(`This program will clear all abilities/playsheets for the HC, OC, and DC of the team you choose in a franchise file. Madden ${FranchiseUtils.formatListString(validGames)} files are supported\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGames);
const gameYear = franchise.schema.meta.gameYear;
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const coachTable = franchise.getTableByUniqueId(tables.coachTable);
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);

	const tablesList = [coachTable, teamTable];

	await FranchiseUtils.readTableRecords(tablesList);

	// Number of records
	const coachCount = coachTable.header.recordCapacity;
	const teamCount = teamTable.header.recordCapacity;

	const teamList = [];

	for(let i = 0; i < teamCount; i++)
	{
		const teamRecord = teamTable.records[i];
		
		if (teamRecord.isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(teamRecord.DisplayName) || !teamRecord.TEAM_VISIBLE)
		{
			continue;
		}

		let teamEntry = {
			rowNum: i,
			teamRecord: teamRecord
		};

		teamList.push(teamEntry);
	}

	let userSelection;
	do
	{
		console.log("Available teams:");
		for(let i = 0; i < teamList.length; i++)
		{
			console.log(`${teamList[i].rowNum} - ${teamList[i].teamRecord.DisplayName}`);
		}
		console.log(`999 - ALL TEAMS (Use with caution)`);

		console.log("\nPlease enter the number of the team you want to clear abilities for:");
		userSelection = parseInt(prompt());

		if(isNaN(userSelection) || userSelection < 0 || (!teamList.find(team => team.rowNum === userSelection) && userSelection !== 999))
		{
			console.log("Invalid selection. Please try again.\n");
		}

		if(userSelection === 999)
		{
			const confirm = FranchiseUtils.getYesOrNo("Are you sure you want to clear abilities for ALL TEAMS? This action cannot be undone. (yes/no): ");

			if(!confirm)
			{
				userSelection = NaN; // Force re-prompt
			}
		}
	}
	while(isNaN(userSelection) || userSelection < 0 || (!teamList.find(team => team.rowNum === userSelection) && userSelection !== 999));

	const selectedTeam = teamTable.records[userSelection];

	console.log("\nClearing coach abilities...");

	const headCoachRow = FranchiseUtils.getRowFromRef(selectedTeam.HeadCoach);
	const offensiveCoachRow = FranchiseUtils.getRowFromRef(selectedTeam.OffensiveCoordinator);
	const defensiveCoachRow = FranchiseUtils.getRowFromRef(selectedTeam.DefensiveCoordinator);

	const coachesToUpdate = [headCoachRow, offensiveCoachRow, defensiveCoachRow];

	if(userSelection === 999)
	{
		for(const teamEntry of teamList)
		{
			const teamRecord = teamEntry.teamRecord;

			const headCoachRow = FranchiseUtils.getRowFromRef(teamRecord.HeadCoach);
			const offensiveCoachRow = FranchiseUtils.getRowFromRef(teamRecord.OffensiveCoordinator);
			const defensiveCoachRow = FranchiseUtils.getRowFromRef(teamRecord.DefensiveCoordinator);

			if(!coachesToUpdate.includes(headCoachRow))
			{
				coachesToUpdate.push(headCoachRow);
			}

			if(!coachesToUpdate.includes(offensiveCoachRow))
			{
				coachesToUpdate.push(offensiveCoachRow);
			}

			if(!coachesToUpdate.includes(defensiveCoachRow))
			{
				coachesToUpdate.push(defensiveCoachRow);
			}
		}
	}

	for(const coachRow of coachesToUpdate)
	{
		const coach = coachTable.records[coachRow];

		const playsheetTalents = FranchiseUtils.getRowAndTableIdFromRef(coach.PlaysheetTalents);
		const gamedayTalents = FranchiseUtils.getRowAndTableIdFromRef(coach.GamedayTalents);
		const wearAndTearTalents = FranchiseUtils.getRowAndTableIdFromRef(coach.WearAndTearTalents);

		const talentRefs = [playsheetTalents, gamedayTalents, wearAndTearTalents];

		for(const talentRef of talentRefs)
		{
			if(talentRef.tableId === 0)
			{
				continue;
			}
			
			const talentArrayTable = franchise.getTableById(talentRef.tableId);
			await FranchiseUtils.readTableRecords([talentArrayTable]);

			const talentArrayRecord = talentArrayTable.records[talentRef.row];

			for(const field of talentArrayRecord.fieldsArray)
			{
				talentArrayRecord[field.key] = FranchiseUtils.ZERO_REF;
			}
		}

	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nCoach abilities cleared successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  