// Required modules
const FranchiseUtils = require('../../Utils/FranchiseUtils');
const fs = require('fs');
const zlib = require('zlib');

// Print tool header message
console.log("This program will repair broken visuals records in a Madden 26 franchise file.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	const tablesList = [characterVisualsTable, playerTable];

	await FranchiseUtils.readTableRecords(tablesList);

	const maxRows = characterVisualsTable.header.recordCapacity;
	const maxPlayerRows = playerTable.header.recordCapacity;

	let fixedCount = 0;

	for(let i = 0; i < maxPlayerRows; i++) {
		const record = playerTable.records[i];
		if(!FranchiseUtils.isValidPlayer(record, {includeFreeAgents: false, includePracticeSquad: false, includeSignedPlayers: false, includeExpiringPlayers: false, includeDeletedPlayers: true}))
		{
			continue;
		}

		if(record.CharacterVisuals === FranchiseUtils.ZERO_REF)
		{
			continue;
		}

		const visualsRow = FranchiseUtils.getRowFromRef(record.CharacterVisuals);
		if(visualsRow === -1)
		{
			continue;
		}

		const visualsRecord = characterVisualsTable.records[visualsRow];

		const visualsBlankRecord = characterVisualsTable.records.find(r => r.isEmpty && r.RawData === '{}');

		if(visualsBlankRecord)
		{
			const table3Field = visualsRecord.getFieldByKey('RawData').thirdTableField;
			const emptyTable3Field = visualsBlankRecord.getFieldByKey('RawData').thirdTableField;

			table3Field.unformattedValue = emptyTable3Field.unformattedValue;

			console.log(`Fixed visuals for player in row ${i} by copying blank visuals from row ${characterVisualsTable.records.indexOf(visualsBlankRecord)} into row ${visualsRow}.`);
			fixedCount++;
		}
	}

	
	// Program complete, so print success message, save the franchise file, and exit
	console.log(`\nPlayer visuals fixed successfully. Total fixed: ${fixedCount}`);
	await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  