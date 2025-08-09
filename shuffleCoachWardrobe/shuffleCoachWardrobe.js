// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const path = require('path');
const ISON_FUNCTIONS = require('../isonParser/isonFunctions');

// Valid game years
const validYears = [
	FranchiseUtils.YEARS.M25,
	FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log(`This program will update wardrobe for all head coaches. It is recommended to run this tool every week during the season. Only Madden ${FranchiseUtils.formatListString(validYears)} franchise files are supported.\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validYears, {isAutoUnemptyEnabled: true});
const gameYear = franchise.schema.meta.gameYear;
const tables = FranchiseUtils.getTablesObject(franchise);

// Required lookups
const topLookup = JSON.parse(fs.readFileSync(path.resolve(__dirname, `lookupFiles/coachTopLookup_${gameYear}.json`), 'utf8'));
const femaleTopLookup = JSON.parse(fs.readFileSync(path.resolve(__dirname, `lookupFiles/coachTopLookup_${gameYear}F.json`), 'utf8'));
const overrideLookup = JSON.parse(fs.readFileSync(path.resolve(__dirname, `lookupFiles/overrideTopLookup_${gameYear}.json`), 'utf8'));

/**
 * Copies all data in the equipment columns of the source row in the player table to the target row in the player table
 * 
 * @param {number} targetRow The row number of the target coach to update
 * @param {number} item The itemassetname to assign
 * @param {Object} slotType The item's slot type
 * @param {Object} coachTable The coach table object
 * @param {Object} visualsTable The character visuals table object
*/
async function assignCoachGear(targetRow, item, slotType, coachTable, visualsTable)
{
	const targetVisualsRow = FranchiseUtils.bin2Dec(coachTable.records[targetRow]['CharacterVisuals'].slice(15));

	let targetVisualsData = ISON_FUNCTIONS.isonVisualsToJson(visualsTable, targetVisualsRow, gameYear);//JSON.parse(visualsTable.records[targetVisualsRow]['RawData']);

	const targetVisualsLoadouts = targetVisualsData['loadouts'];

	let targetEquipmentLoadouts;

	let loadoutNumber;

	for(let i = 0; i < targetVisualsLoadouts.length; i++)
	{
		if(targetVisualsLoadouts[i]['loadoutCategory'] === 'CoachApparel')
		{
			targetEquipmentLoadouts = targetVisualsLoadouts[i];
			loadoutNumber = i;
			break;
		}
	}

	if(!targetEquipmentLoadouts)
	{
		if(FranchiseUtils.DEBUG_MODE)
		{
			console.log(`Coach ${targetRow} does not have equipment loadouts. Skipping assignment.`);
		}
		return;
	}

	const targetEquipmentSlots = targetEquipmentLoadouts['loadoutElements'];

	let foundSlot = false;

	for(let i = 0; i < targetEquipmentSlots.length; i++)
	{
		if(targetEquipmentSlots[i]['slotType'] === slotType)
		{
			targetEquipmentSlots[i]['itemAssetName'] = item;
			foundSlot = true;
			break;
		}
	}

	if(!foundSlot)
	{
		let newItem = {
			"itemAssetName": item,
			"slotType": slotType
		};

		targetEquipmentSlots.push(newItem);
	}

	targetEquipmentLoadouts['loadoutElements'] = targetEquipmentSlots;
	targetVisualsLoadouts[loadoutNumber] = targetEquipmentLoadouts;

	targetVisualsData['loadouts'] = targetVisualsLoadouts;

	//visualsTable.records[targetVisualsRow]['RawData'] = JSON.stringify(targetVisualsData);
	ISON_FUNCTIONS.jsonVisualsToIson(visualsTable, targetVisualsRow, targetVisualsData, gameYear);

};

/**
 * Enumerates all coaches in the coach table and sorts them into head coaches only
 * 
 * @param {Object} coachTable The coach table object
 * @param {Array<number>} headCoachRows A list to store row numbers of head coaches
 */
async function enumerateHeadCoaches(coachTable, headCoachRows)
{
	// Number of rows in the coach table
    const numRows = coachTable.header.recordCapacity; 
	
	// Iterate through the coach table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid coach, skip this row
		if(coachTable.records[i].isEmpty || coachTable.records[i]['CharacterVisuals'] === FranchiseUtils.ZERO_REF || coachTable.records[i]['Position'] !== "HeadCoach" || (coachTable.records[i].OffensivePlaybook === FranchiseUtils.ZERO_REF && coachTable.records[i].DefensivePlaybook === FranchiseUtils.ZERO_REF))
		{
			continue;
		}
		
		// Add the row number to the head coach rows array
		headCoachRows.push(i);
    }
}

async function isWarmWeatherCoach(teamIndex)
{
	// Required tables
	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);

	// When we can use this check
	const validWeekTypes = ['PreSeason', 'RegularSeason', 'WildcardPlayoff', 'DivisionalPlayoff', 'ConferencePlayoff', 'SuperBowl'];

	// Read required tables
	await FranchiseUtils.readTableRecords([teamTable, seasonGameTable, seasonInfoTable]);

	// If we can't check this week, return false
	if(!validWeekTypes.includes(seasonInfoTable.records[0]['CurrentWeekType']))
	{
		return false;
	}

	// Max rows in each table
	const teamRows = teamTable.header.recordCapacity;
	const scheduleRows = seasonGameTable.header.recordCapacity;
	
	// Search teamTable records object for team with matching teamIndex
	let teamRowNum;
	for(let i = 0; i < teamRows; i++)
	{
		if(teamTable.records[i]['TeamIndex'] === teamIndex)
		{
			teamRowNum = i;
			break;
		}
	}

	// If we can't find the team, return false
	if(!teamRowNum)
	{
		return false;
	}

	// Iterate through the season schedule
	for(let i = 0; i < scheduleRows; i++)
	{
		// If it's an empty row or not this week, skip this row
		if(seasonGameTable.records[i].isEmpty || seasonGameTable.records[i]['AwayPlayerStatCache'] === FranchiseUtils.ZERO_REF)
		{
			continue;
		}

		// Home and away team row numbers
		let homeTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['HomeTeam'].slice(15));
		let awayTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['AwayTeam'].slice(15));

		// If the team we want is not playing in this game, skip this row
		if(homeTeamRow !== teamRowNum && awayTeamRow !== teamRowNum)
		{
			continue;
		}

		// Get game weather and temperature
		let gameWeather = seasonGameTable.records[i]['Weather'];
		let gameTemp = seasonGameTable.records[i]['Temperature'];

		// If it's > 80 degrees and not in a dome, return true
		if(gameTemp > 80 && gameWeather !== 'Invalid_')
		{
			return true;
		}
		
		// If we reach this point, we already found the team's game and it doesn't meet the true condition, so we can break
		break;
	}

	// Return false if we reach this point
	return false;
}


franchise.on('ready', async function () {
    // Get required tables
	const coachTable = franchise.getTableByUniqueId(tables.coachTable);
	const visualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	// Read required tables
	await FranchiseUtils.readTableRecords([coachTable, visualsTable]);
    
	// Arrays to represent the head coach rows
	let coachRows = [];
	
	// Enumerate all head coaches in the coach table
	await enumerateHeadCoaches(coachTable, coachRows);
	
	// If there are no coaches, we can't continue, so inform the user and exit
	if (coachRows.length === 0)
	{
		console.log("\nThere are no coaches in your franchise file.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	const slotType = gameYear >= FranchiseUtils.YEARS.M26 ? "OuterShirt" : "JerseyStyle";
	
	// Iterate through all head coaches
	for (let j = 0; j < coachRows.length; j++)
	{
		
		const coachRow = coachRows[j];
		let coachRecord = coachTable.records[coachRow];

		// If female coach, use the female top lookup, otherwise use the regular top lookup
		let currLookup = FranchiseUtils.FEMALE_BODY_TYPES.includes(coachRecord.characterBodyType) ? femaleTopLookup : topLookup;

		// If the coach's assetname is in the override lookup, just assign that item
		if(overrideLookup.hasOwnProperty(coachRecord['AssetName']))
		{
			let item = overrideLookup[coachRecord['AssetName']];
			await assignCoachGear(coachRow, item, slotType, coachTable, visualsTable);
			continue;
		}
		else if(overrideLookup.hasOwnProperty(coachRecord['AssetName'].replace("_C_PRO", "")))
		{
			let item = overrideLookup[coachRecord['AssetName'].replace("_C_PRO", "")];
			await assignCoachGear(coachRow, item, slotType, coachTable, visualsTable);
			continue;
		}
		else if(overrideLookup.hasOwnProperty(coachRecord['AssetName'] + "_C_PRO"))
		{
			let item = overrideLookup[coachRecord['AssetName'] + "_C_PRO"];
			await assignCoachGear(coachRow, item, slotType, coachTable, visualsTable);
			continue;
		}

		// If the coach is a free agent, just randomly choose a gear option
		if(coachRecord['ContractStatus'] === 'FreeAgent')
		{
			let keys = Object.keys(currLookup);

			let item = currLookup[keys[FranchiseUtils.getRandomNumber(0, keys.length - 1)]];
			await assignCoachGear(coachRow, item, slotType, coachTable, visualsTable);
			continue;
		}

		// Otherwise, we should assign coach gear randomly but with branching logic based on game weather if applicable
		let isWarmOutdoorCoach = await isWarmWeatherCoach(coachRecord['TeamIndex']);

		// If it's a warm game and outdoors, randomly select a gear option with polo as an option (but rarer than the others)
		if(isWarmOutdoorCoach)
		{
			let keys = Object.keys(currLookup);

			let randomNumber;
			let itemKey;
			do
			{
				randomNumber = FranchiseUtils.getRandomNumber(0, 2);

				itemKey = keys[FranchiseUtils.getRandomNumber(0, keys.length - 1)];
			}
			while(itemKey === "Polo" && randomNumber !== 2);

			let item = currLookup[itemKey];
			await assignCoachGear(coachRow, item, slotType, coachTable, visualsTable);
			continue;
		}
		else // Otherwise, randomly select a gear option without polo as an option
		{
			let keys = Object.keys(currLookup);

			// Remove polo from keys
			keys = keys.filter(key => key !== "Polo");

			let item = currLookup[keys[FranchiseUtils.getRandomNumber(0, keys.length - 1)]];
			await assignCoachGear(coachRow, item, slotType, coachTable, visualsTable);
			continue;
		}
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nCoach wardrobe updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  