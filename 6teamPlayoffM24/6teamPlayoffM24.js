const fs = require('fs');
const prompt = require('prompt-sync')();
const Franchise = require('madden-franchise');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');

console.log("This program will update your Madden 24 franchise file to use the 6 team playoff format. This tool must be run during wildcard week.\n")
const gameYear = '24';

const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

franchise.on('ready', async function () {
    const teamTable = franchise.getTableByUniqueId(502886486);
	const seasonInfoTable = franchise.getTableByUniqueId(3123991521);
	await seasonInfoTable.readRecords();
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	
	var twoSeedTeamRows = [];
	
	if (currentWeek !== 18) // Check if file is in wildcard round, exit if not
	{
		console.log("Selected file is not in the Wildcard Round. Only Franchise Files in the Wildcard Round are supported by this tool. Enter anything to exit.")
		prompt();
		process.exit(0);
	}

    await teamTable.readRecords();
    const numRowsTeam = teamTable.header.recordCapacity //Number of rows in the team table
    for (i=0; i < numRowsTeam; i++) { //Iterate through the team table
        if (teamTable.records[i].isEmpty == true) { // If an empty row, continue
          continue
        }

        var teamSeed = parseInt(teamTable.records[i]['CurSeasonConfStanding']);
		if(teamSeed === 1) // If this team is the 2 seed
		{
			twoSeedTeamRows.push(i);
		}
    }
	
	const seasonGameTable = franchise.getTableByUniqueId(1607878349);
	await seasonGameTable.readRecords();
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity;
	for (j=0; j < numRowsSeasonGame; j++) { //Iterate through the schedule table
        if (seasonGameTable.records[j].isEmpty == true) { // If an empty row, continue
          continue
        }

        if(seasonGameTable.records[j]['SeasonWeekType'] === 'WildcardPlayoff')
		{
			let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
			var teamRowBinVal = homeTeamBinVal.slice(15);
			var homeTeamRowNum = await FranchiseUtils.bin2Dec(teamRowBinVal);
			
			if(homeTeamRowNum === twoSeedTeamRows[0] || homeTeamRowNum === twoSeedTeamRows[1])
			{
				seasonGameTable.records[j]['SeasonWeekType'] = 'OffSeason';
			}
		}
    }
	
	console.log("\nPlayoff format updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    prompt();
  
});
  