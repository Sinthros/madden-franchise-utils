// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const ISON_FUNCTIONS = require('../isonParser/isonFunctions');

// Print tool header message
console.log("This program will update player body types in a Madden 25 franchise file based on EA's body type formula.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

// Function to approximate the body type based on the visuals JSON
function approximateBodyType(visualsObject)
{
	let morphLoadout;
	
	// Find the morph loadout
	for(let i = 0; i < visualsObject['loadouts'].length; ++i)
	{
		if(visualsObject['loadouts'][i].hasOwnProperty('loadoutCategory') && visualsObject['loadouts'][i]['loadoutCategory'] === 'Base')
		{
			morphLoadout = visualsObject['loadouts'][i];
			break;
		}
	}

	if(!morphLoadout || !morphLoadout.hasOwnProperty('loadoutElements'))
	{
		return 'Thin';
	}

	// Try to find the gut morph value
	let gutMorph;

	for(let i = 0; i < morphLoadout['loadoutElements'].length; ++i)
	{
		if(morphLoadout['loadoutElements'][i]["slotType"] === "Gut")
		{
			gutMorph = morphLoadout['loadoutElements'][i];
			break;
		}
	}

	if(!gutMorph || !gutMorph.hasOwnProperty('blends'))
	{
		return 'Thin';
	}

	// Get the blends array
	const blends = gutMorph['blends'];

	if(blends.length === 0)
	{
		return 'Thin';
	}

	// Get the two blend values
	let gutBase;
	let gutBarycentric;

	if(blends[0].hasOwnProperty('baseBlend'))
	{
		gutBase = blends[0]['baseBlend'];
		if(gutBase < 0.5)
		{
			console.log(`gutBase: ${gutBase}`);
		}
	}

	if(blends[0].hasOwnProperty('barycentricBlend'))
	{
		gutBarycentric = blends[0]['barycentricBlend'];
	}


	if(gutBase <= 0.5)
	{
		return 'Standard';
	}

	if(gutBarycentric < 0.5)
	{
		return 'Thin';
	}

	if(gutBarycentric >= 0.5 && gutBarycentric < 1.35)
	{
		return 'Muscular';
	}

	if(gutBarycentric >= 1.35 && gutBarycentric < 2.70)
	{
		return 'Heavy';
	}

	if(gutBarycentric >= 2.70 && gutBarycentric < 2.90)
	{
		return 'Muscular';
	}

	return 'Thin';
}

franchise.on('ready', async function () {
    // Get required tables	
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	const tablesList = [characterVisualsTable, playerTable];

	await FranchiseUtils.readTableRecords(tablesList);

	// Number of records
	const playerCount = playerTable.header.recordCapacity;

	for (let i = 0; i < playerCount; i++) 
	{
		if(!FranchiseUtils.isValidPlayer(playerTable.records[i]))
		{
			continue;
		}		
		
		const visualsRow = FranchiseUtils.bin2Dec(playerTable.records[i]['CharacterVisuals'].slice(15));

		// Get the player's JSON value from the visuals ISON
		const visualsJson = ISON_FUNCTIONS.isonVisualsToJson(characterVisualsTable, visualsRow);

		if(!visualsJson.hasOwnProperty("loadouts"))
		{
			continue;
		}

		// Get the body type based on the visuals
		const bodyType = approximateBodyType(visualsJson);

		// Update the player's body type
		playerTable.records[i]['CharacterBodyType'] = bodyType;
	}
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nBody types updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  