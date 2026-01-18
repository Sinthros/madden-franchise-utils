// Required modules
const FranchiseUtils = require('../../Utils/FranchiseUtils');

// Print tool header message
console.log("This program will fix team rosters containing duplicate player references in a Madden 25 or 26 franchise file.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M25,
	FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const rosterTable = franchise.getTableByUniqueId(tables.rosterTable);

	const tablesList = [rosterTable];

	await FranchiseUtils.readTableRecords(tablesList);

	const recordCount = rosterTable.header.recordCapacity;

	// Iterate through each record in the roster table
	for(let i = 0; i < recordCount; i++)
	{
		let foundRows = [];

		const currRecord = rosterTable.records[i];

		if(currRecord.isEmpty)
		{
			continue;
		}

		const numElements = currRecord.arraySize;

		// Iterate through each element in the current record
		for(let j = 0; j < numElements; j++)
		{
			const currElement = currRecord[`Player${j}`];

			const currPlayerRow = FranchiseUtils.bin2Dec(currElement.slice(15));

			if(!foundRows.includes(currPlayerRow))
			{
				foundRows.push(currPlayerRow);
				continue;
			}

			// Duplicate player found, so clear the current element by taking the last player in the roster and moving them to the current element, then clear the last player
			const lastElement = currRecord[`Player${numElements - 1}`];
			currRecord[`Player${j}`] = lastElement;
			currRecord[`Player${numElements - 1}`] = FranchiseUtils.ZERO_REF;
		}
	}
	
	
	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nAll duplicate players successfully cleared.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  