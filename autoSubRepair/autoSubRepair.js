// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGames = [
	FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log(`This program will repair the table ID for the AutoSubSlider table in a franchise file if you imported one with the wrong ID and can no longer access it. Madden ${FranchiseUtils.formatListString(validGames)} are supported\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGames);
const gameYear = franchise.schema.meta.gameYear;
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const autoSubSliderTable = franchise.getTableByUniqueId(tables.autoSubSliderTable);
	const checkTable = franchise.getTableById(autoSubSliderTable.header.tableId);
	const availableTable = franchise.getTableById(4177);

	const tablesList = [autoSubSliderTable];

	await FranchiseUtils.readTableRecords(tablesList);

	if(checkTable && checkTable.header.name === autoSubSliderTable.header.name)
	{
		console.log("AutoSubSlider table seems to already have the correct ID. No changes are necessary.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	if(availableTable)
	{
		console.log(`Another table (${availableTable.header.name}) is already using the correct ID (4177) for the AutoSubSlider table. Cannot continue.`);
		FranchiseUtils.EXIT_PROGRAM();
	}
	
	// Update table ID in the raw data
	const rawTable = autoSubSliderTable.hexData;
	const oldId = rawTable.readUInt32BE(0x80);

	if(oldId !== autoSubSliderTable.header.tableId)
	{
		console.log("Failed to read the raw table data. Cannot continue.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	rawTable.writeUInt32BE(4177, 0x80); // Write new ID to raw data

	await autoSubSliderTable.replaceRawData(rawTable); // Replace the table's raw data with the updated data
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nAutosub table repaired successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  