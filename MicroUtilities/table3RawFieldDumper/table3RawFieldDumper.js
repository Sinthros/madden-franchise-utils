// Required modules
const FranchiseUtils = require('../../Utils/FranchiseUtils');
const fs = require('fs');
const zlib = require('zlib');

// Print tool header message
console.log("This program will dump the raw table3 field data from a Madden 24 or 25 franchise file.\n");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    // Get required tables	
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);

	const tablesList = [characterVisualsTable];

	await FranchiseUtils.readTableRecords(tablesList);

	const dumpCompressed = FranchiseUtils.getYesOrNo("Would you like to dump the data in compressed format? (yes/no):");

	const maxRows = characterVisualsTable.header.recordCapacity;

	const rowNumber = FranchiseUtils.getUserInputNumber("Please enter a row number to dump: ", 0, maxRows - 1);

	const table3Field = characterVisualsTable.records[rowNumber].getFieldByKey('RawData').thirdTableField;
	const table3Buffer = table3Field.unformattedValue;
	const compressedLength = table3Buffer.readUInt16LE(0);

	const startPos = dumpCompressed ? 0 : table3Buffer[2] === 7 ? 3 : 2;
	const headSize = table3Buffer[2] === 7 ? 3 : 2;

	let dumpedData = table3Buffer.subarray(startPos, headSize + compressedLength);

	if(!dumpCompressed)
	{
		console.log(dumpedData[0]);
		dumpedData = zlib.gunzipSync(dumpedData);
	}

	const dumpFileName = `row${rowNumber}_dumpedData.dat`;

	fs.writeFileSync(dumpFileName, dumpedData);

	
	// Program complete, so print success message, save the franchise file, and exit
	console.log(`\nData dumped successfully and saved to ${dumpFileName}.\n`);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  