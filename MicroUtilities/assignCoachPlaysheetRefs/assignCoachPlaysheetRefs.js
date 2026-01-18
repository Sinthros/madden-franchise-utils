// Required modules
const FranchiseUtils = require('../../Utils/FranchiseUtils');
const { getBinaryReferenceData } = require("madden-franchise").utilService;

// Print tool header message
console.log("This program will assign PlaysheetTalent refs to all coaches in a Madden 25 26 franchise file. This ensures all coaches are visible in MyFranchise.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames, { isAutoUnEmptyEnabled: true });
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const coachTable = franchise.getTableByUniqueId(tables.coachTable);
	const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);

	const tablesList = [coachTable, talentArrayTable];

	await FranchiseUtils.readTableRecords(tablesList);

	const recordCount = coachTable.header.recordCapacity;

	if(talentArrayTable.emptyRecords.size === 0)
	{
		console.log("There are no available PlaysheetTalent records to assign to coaches. Exiting program.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	// Iterate through each record in the coach table
	for(let i = 0; i < recordCount; i++)
	{
		let foundRows = [];

		const currRecord = coachTable.records[i];

		if(currRecord.isEmpty || currRecord.OffensivePlaybook === FranchiseUtils.ZERO_REF || currRecord.PlaysheetTalents !== FranchiseUtils.ZERO_REF)
		{
			continue;
		}

		const recordToAssign = await FranchiseUtils.getNextZeroedRecord(talentArrayTable);

		const binaryRef = getBinaryReferenceData(talentArrayTable.header.tableId, recordToAssign.index);

		currRecord.PlaysheetTalents = binaryRef;
		
	}
	
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nAll duplicate players successfully cleared.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  