// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Print tool header message
console.log("This program will copy appearance from players in a source franchise file to the same players in a target franchise file.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M25
];
const sourceFranchise = FranchiseUtils.init(validGames, {promptForBackup: false, customFranchiseMessage: "Please enter the name of your source franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder. Or, enter 0 to exit."});
const targetFranchise = FranchiseUtils.init(validGames, {promptForBackup: false, customFranchiseMessage: "Please enter the name of your target franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder. Or, enter 0 to exit."});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

let visualsLookup = {};
let includeDraftPlayers = FranchiseUtils.getYesOrNo("\nDo you want to include the Draft Class - requires players in both classes to have the same asset name? (yes/no)");

sourceFranchise.on('ready', async function () {
	targetFranchise.on('ready', async function () {

		const sourcePlayerTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
		const targetPlayerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
		await FranchiseUtils.readTableRecords([sourcePlayerTable, targetPlayerTable]);

		const sourceCharacterVisualsTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.characterVisualsTable);
		const targetCharacterVisualsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.characterVisualsTable);
		await FranchiseUtils.readTableRecords([sourceCharacterVisualsTable, targetCharacterVisualsTable]);

		// Number of rows in the player table
		const sourceNumRows = sourcePlayerTable.header.recordCapacity; 
		const targetNumRows = targetPlayerTable.header.recordCapacity;
		
		for(let i = 0; i < sourceNumRows; i++)
		{
			if (!FranchiseUtils.isValidPlayer(sourcePlayerTable.records[i], {includeDraftPlayers: includeDraftPlayers}))
			{
				continue;
			}

			let sourcePlayerVisualsRow = FranchiseUtils.bin2Dec(sourcePlayerTable.records[i]['CharacterVisuals'].slice(15));
			let sourcePlayerAssetName = sourcePlayerTable.records[i]['PLYR_ASSETNAME'].trim().toLowerCase();

			if(sourcePlayerVisualsRow === -1 || sourcePlayerAssetName === "" || visualsLookup.hasOwnProperty(sourcePlayerAssetName))
			{
				continue;
			}

			visualsLookup[sourcePlayerAssetName] = JSON.parse(sourceCharacterVisualsTable.records[sourcePlayerVisualsRow]['RawData']);
		}

		// Iterate through the target player table
		for (let i = 0; i < targetNumRows; i++) 
		{ 
			// If it's an empty row or invalid player, skip this row
			if (!FranchiseUtils.isValidPlayer(targetPlayerTable.records[i], {includeDraftPlayers: includeDraftPlayers}))
			{
				continue;
			}
			
			// Figure out which row in the character visuals table corresponds to this player
			let targetPlayerVisualsRow = FranchiseUtils.bin2Dec(targetPlayerTable.records[i]['CharacterVisuals'].slice(15));
			let targetPlayerAssetName = targetPlayerTable.records[i]['PLYR_ASSETNAME'].trim().toLowerCase();

			if(targetPlayerVisualsRow === -1 || !visualsLookup.hasOwnProperty(targetPlayerAssetName))
			{
				continue;
			}

			targetCharacterVisualsTable.records[targetPlayerVisualsRow]['RawData'] = JSON.stringify(visualsLookup[targetPlayerAssetName]);
		}

		console.log("Player appearance has been transferred successfully.\n");
		await FranchiseUtils.saveFranchiseFile(targetFranchise);

		FranchiseUtils.EXIT_PROGRAM();

	});
});