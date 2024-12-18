(async() => {
	// Required modules
	const FranchiseUtils = require('../Utils/FranchiseUtils');
	const fs = require('fs');
	const prompt = require('prompt-sync')();

	// Print tool header message
	console.log("This program will read a franchise string intern BIN file and parse it into a JSON with the ushorts as the keys and the strings as the value.\n")

	// Set up data buffer
	console.log("\nEnter the path to the string intern BIN file: ");
	const filePath = prompt().trim().replace(/['"]/g, '');
	const fileData = fs.readFileSync(filePath);

	let offset = 0;

	// Function to read a specified number of bytes from the buffer
	function readBytes(length) 
	{
		const bytes = fileData.subarray(offset, offset + length);
		offset += length;
		return bytes;
	}

	// The first ushort is the string count in the file
	const stringCount = readBytes(2).readUInt16LE(0);
	console.log(`\nString count: ${stringCount}`);

	const obj = {};

	// Read for each string in the file
	for(let i = 0; i < stringCount; i++)
	{
		// Read string length
		const stringLength = readBytes(4).readUInt32LE(0);

		// Read string data
		const stringData = readBytes(stringLength).toString('utf8');

		// Read string key
		const stringKey = readBytes(2).readUInt16LE(0);

		if(obj.hasOwnProperty(stringKey))
		{
			console.log(`Duplicate key ${stringKey} found for string ${stringData}. Existing value: ${obj[stringKey]}`);
		}

		obj[stringKey] = stringData;
	}

	// Write the object to a JSON file
	const json = JSON.stringify(obj, null, 4);
	// Remove the file extension from the path
	let newFilePath = filePath.split(".")[0];
	fs.writeFileSync(newFilePath + '.json', json);

	console.log(`\nSuccessfully wrote JSON to ${newFilePath}.json.`);

	FranchiseUtils.EXIT_PROGRAM();

})();