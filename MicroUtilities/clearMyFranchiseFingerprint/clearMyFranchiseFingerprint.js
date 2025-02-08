// Required modules
const FranchiseUtils = require('../../Utils/FranchiseUtils');

// Print tool header message
console.log("This program will clear the MyFranchise file ID in a Madden 25 franchise file.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const franchiseDebugTable = franchise.getTableByUniqueId(tables.franchiseDebugModuleTable);

	const tablesList = [franchiseDebugTable];

	await FranchiseUtils.readTableRecords(tablesList);

	franchiseDebugTable.records[0]['SideActivityToForce'] = "";
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nMyFranchise file ID successfully cleared.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  