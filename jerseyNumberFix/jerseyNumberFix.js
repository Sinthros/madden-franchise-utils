// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const fs = require('fs');
const prompt = require('prompt-sync')();

// Print tool header message
console.log("This program will update player jersey numbers in a franchise file to follow a given year's rules. Only Madden 25 is supported.\n");

// Required lookups
const posMap = JSON.parse(fs.readFileSync('lookupFiles/posMap.json'), 'utf-8');
const retiredNumbers = JSON.parse(fs.readFileSync('lookupFiles/retiredNumbers.json'), 'utf-8');
const rules2020pre = JSON.parse(fs.readFileSync('lookupFiles/rules_2020pre.json'), 'utf-8');
const rules2021 = JSON.parse(fs.readFileSync('lookupFiles/rules_2021.json'), 'utf-8');
const rules2023 = JSON.parse(fs.readFileSync('lookupFiles/rules_2023.json'), 'utf-8');

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

/**
 * Gets a valid jersey number for a player based on the given set of rules and available numbers on the player's team (if applicable)
 * 
 * @param {Object} playerRecord The player record to update
 * @param {Object} availableAndUnavailableNums A mapping of available and unavailable jersey numbers for the player's team, or pass in null if the player is a free agent
 * @param {Object} rules The set of rules to follow for jersey numbers by position
 * @returns {number} A valid jersey number for the player
 */
async function getValidJerseyNum(playerRecord, availableAndUnavailableNums, rules)
{
	const pos = posMap[playerRecord['Position']];
	const ranges = rules[pos];

	let usableNums = [];

	for(let i = 0; i < ranges.length; i++)
	{
		for(let j = ranges[i][0]; j <= ranges[i][1]; j++)
		{
			if(!availableAndUnavailableNums)
			{
				usableNums.push(j);
				continue;
			}

			if(availableAndUnavailableNums[1].includes(j))
			{
				continue;
			}

			if(availableAndUnavailableNums[0].includes(j))
			{
				usableNums.push(j);
			}
		}
	}

	if(usableNums.length === 0)
	{
		throw new Error(`No available jersey numbers for player ${playerRecord['FirstName']} ${playerRecord['LastName']} of team ${playerRecord['TeamIndex']}.`);
	}

	// Sort array in ascending order
	usableNums = usableNums.sort((a, b) => a - b);

	await FranchiseUtils.shuffleArray(usableNums);

	return usableNums[FranchiseUtils.getRandomNumber(0, usableNums.length - 1)];
}

/**
 * Given a jersey number, team index, and year, determines if the jersey number is retired by that year for the given team
 * 
 * @param {number} jerseyNum The jersey number to check
 * @param {number} teamIndex The team index to check
 * @param {number} year The year to check
 * @returns {boolean} True if the jersey number is retired for the given team and year, false otherwise
 */
function isRetiredJerseyNum(jerseyNum, teamIndex, year)
{
	if(!retiredNumbers.hasOwnProperty(teamIndex))
	{
		return false;
	}

	const teamRetiredNumbers = retiredNumbers[teamIndex];

	for(let i = 0; i < teamRetiredNumbers.length; i++)
	{
		if(teamRetiredNumbers[i][0] === jerseyNum && year >= teamRetiredNumbers[i][1])
		{
			return true;
		}
	}

	return false;
}

/**
 * Given a player record, checks if the player's jersey number is valid based on the given rules and is not retired
 * 
 * @param {*} playerRecord The player record to check
 * @param {*} rules The set of rules to follow for jersey numbers by position
 * @param {*} year The year (for checking retired numbers)
 * @returns {boolean} True if the player's jersey number is valid based on the given rules and is not retired, false otherwise 
 */
function isValidJerseyNum(playerRecord, rules, year)
{
	const pos = playerRecord['Position'];
	const jerseyNum = playerRecord['JerseyNum'];

	if(playerRecord['ContractStatus'] !== FranchiseUtils.CONTRACT_STATUSES.FREE_AGENT && isRetiredJerseyNum(jerseyNum, playerRecord['TeamIndex'], year))
	{
		return false;
	}

	if(!posMap.hasOwnProperty(pos))
	{
		return false;
	}

	const posRules = rules[posMap[pos]];

	for(let i = 0; i < posRules.length; i++)
	{
		if(posRules[i][0] <= jerseyNum && jerseyNum <= posRules[i][1])
		{
			return true;
		}
	}

	return false;

}

franchise.on('ready', async function () {
    // Get required tables	
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	const tablesList = [seasonInfoTable, teamTable, playerTable];

	await FranchiseUtils.readTableRecords(tablesList);

	// Current year
	const currYear = seasonInfoTable.records[0]['CurrentSeasonYear'];

	// Rules for current year
	let currRules = currYear >= 2023 ? rules2023 : (currYear >= 2021 ? rules2021 : rules2020pre);

	const useYearRules = FranchiseUtils.getYesOrNo(`Would you like to use the NFL rules for the year ${currYear}? Enter yes to confirm or no to choose a different year's rules.`);

	if(!useYearRules)
	{
		const options = ["2020 and older", "2021-2022", "2023+"];
		let rulesChoice;

		do
		{
			console.log("Available rules:");
			for(let i = 0; i < options.length; i++)
			{
				console.log(`${i}: ${options[i]}`);
			}

			console.log("\nPlease select the rules you would like to use by entering the corresponding number.");

			rulesChoice = parseInt(prompt("Rules choice: "));
			if(isNaN(rulesChoice) || rulesChoice < 0 || rulesChoice >= options.length)
			{
				console.log("Invalid choice. Please try again.");
			}
		}
		while(isNaN(rulesChoice) || rulesChoice < 0 || rulesChoice >= options.length);

		if(rulesChoice === 0)
		{
			currRules = rules2020pre;
		}
		else if(rulesChoice === 1)
		{
			currRules = rules2021;
		}
		else
		{
			currRules = rules2023;
		}
	}

	// Number of records
	const playerCount = playerTable.header.recordCapacity;
	const teamCount = teamTable.header.recordCapacity;

	// Team to players map
	const teamPlayersMap = {};
	const freeAgentsList = [];

	// Team to available numbers list
	const teamAvailableAndUnavailableNums = {};

	// Get all team indices
	const teamIndices = [];
	for(let i = 0; i < teamCount; i++)
	{
		const teamRecord = teamTable.records[i];

		if (teamRecord.isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(teamRecord.DisplayName) || !teamRecord.TEAM_VISIBLE)
		{
			continue;
		}

		teamIndices.push(teamRecord['TeamIndex']);
		teamPlayersMap[teamRecord['TeamIndex']] = [];
		teamAvailableAndUnavailableNums[teamRecord['TeamIndex']] = [[], []];
	}

	// Count of players found to be wearing retired numbers
	let retiredNumCount = 0;

	for (let i = 0; i < playerCount; i++) 
	{
		if(!FranchiseUtils.isValidPlayer(playerTable.records[i], {includePracticeSquad: true, includeFreeAgents: true}))
		{
			continue;
		}

		if(isValidJerseyNum(playerTable.records[i], currRules, currYear) && playerTable.records[i]['ContractStatus'] !== FranchiseUtils.CONTRACT_STATUSES.FREE_AGENT)
		{
			teamAvailableAndUnavailableNums[playerTable.records[i]['TeamIndex']][1].push(playerTable.records[i]['JerseyNum']);
			continue;
		}

		if(playerTable.records[i]['ContractStatus'] === FranchiseUtils.CONTRACT_STATUSES.FREE_AGENT && !isValidJerseyNum(playerTable.records[i], currRules, currYear))
		{
			freeAgentsList.push(i);
		}

		const teamIndex = playerTable.records[i]['TeamIndex'];

		if(teamIndices.includes(teamIndex))
		{
			teamPlayersMap[teamIndex].push(i);
			if(!isRetiredJerseyNum(playerTable.records[i]['JerseyNum'], teamIndex, currYear))
			{
				teamAvailableAndUnavailableNums[teamIndex][0].push(playerTable.records[i]['JerseyNum']);
			}
			else
			{
				retiredNumCount++;

				teamAvailableAndUnavailableNums[teamIndex][1].push(playerTable.records[i]['JerseyNum']);
			}
		}
	}

	// Add all remaining retired numbers to the unavailable list
	for(let i = 0; i < teamIndices.length; i++)
	{
		let teamIndex = teamIndices[i];
		let teamRetiredNumbers = retiredNumbers[teamIndex];

		for(let j = 0; j < teamRetiredNumbers.length; j++)
		{
			if(currYear >= teamRetiredNumbers[j][1])
			{
				if(!teamAvailableAndUnavailableNums[teamIndex][1].includes(teamRetiredNumbers[j][0]))
				{
					teamAvailableAndUnavailableNums[teamIndex][1].push(teamRetiredNumbers[j][0]);
				}
			}
		}
	}


	// Add all remaining available numbers to the available list
	for(let i = 0; i < teamIndices.length; i++)
	{
		let teamIndex = teamIndices[i];

		for(let j = (currYear >= 2023 ? 0 : 1); j <= 99; j++)
		{
			if(!teamAvailableAndUnavailableNums[teamIndex][0].includes(j) && !teamAvailableAndUnavailableNums[teamIndex][1].includes(j))
			{
				teamAvailableAndUnavailableNums[teamIndex][0].push(j);
			}
		}
	}

	// Count of non-FAs updated
	let playerUpdateCount = 0;

	// Update jersey numbers for every needed player
	for(let i = 0; i < teamIndices.length; i++)
	{
		let teamIndex = teamIndices[i];
		let teamPlayers = teamPlayersMap[teamIndex];

		for(let j = 0; j < teamPlayers.length; j++)
		{
			playerUpdateCount++;

			let playerIndex = teamPlayers[j];
			let playerRecord = playerTable.records[playerIndex];

			playerRecord['JerseyNum'] = getValidJerseyNum(playerRecord, teamAvailableAndUnavailableNums[teamIndex], currRules);

			teamAvailableAndUnavailableNums[teamIndex][1].push(playerRecord['JerseyNum']);

			// Remove the jersey number from the available list
			teamAvailableAndUnavailableNums[teamIndex][0] = teamAvailableAndUnavailableNums[teamIndex][0].filter(num => num !== playerRecord['JerseyNum']);
		}
	}

	// Update jersey numbers for free agents
	for(let i = 0; i < freeAgentsList.length; i++)
	{
		let playerIndex = freeAgentsList[i];
		let playerRecord = playerTable.records[playerIndex];

		playerRecord['JerseyNum'] = await getValidJerseyNum(playerRecord, null, currRules);
	}

	if(FranchiseUtils.DEBUG_MODE)
	{
		console.log(`${playerUpdateCount + freeAgentsList.length} players updated successfully.`);
		console.log(`${retiredNumCount} retired jersey numbers updated.`);
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nJersey numbers updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  