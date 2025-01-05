(async() => {
	// Required modules
	const FranchiseUtils = require('../Utils/FranchiseUtils');
	const fs = require('fs');
	const prompt = require('prompt-sync')();

	let fileData;
	let offset = 0;

	// Function to read a specified number of bytes from the buffer
	function readBytes(length) 
	{
		const bytes = fileData.subarray(offset, offset + length);
		offset += length;
		return bytes;
	}

	// Print tool header message
	console.log("This program will allow you to read a franchise string intern BIN file and parse it into a JSON, or convert the parsed JSON back into a BIN file.\n")

	const read = FranchiseUtils.getUserInput("Would you like to convert a BIN file to a JSON (1) or a JSON file to a BIN (2)? Enter 1 or 2.", "1", "2") === "1";

	if(read)
	{
		// Set up data buffer
		console.log("\nEnter the path to the string intern BIN file: ");
		const filePath = prompt().trim().replace(/['"]/g, '');
		fileData = fs.readFileSync(filePath);

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
	}
	else
	{
		// Set up data buffer
		console.log("\nEnter the path to the JSON file: ");
		const filePath = prompt().trim().replace(/['"]/g, '');
		const fileData = fs.readFileSync(filePath, 'utf8');

		const obj = JSON.parse(fileData);

		const stringCount = Object.keys(obj).length;

		console.log(`\nString count: ${stringCount}`);

		let buffer = new Buffer.alloc(2);
		buffer.writeUInt16LE(stringCount, 0);

		const keys = Object.keys(obj);

		for(let i = 0; i < stringCount; i++)
		{
			const key = keys[i];
			const stringData = obj[key];

			// Make sure the key can fit in a ushort
			if(key > 65535)
			{
				console.log(`String ${stringData} has a key of ${key} which is too large to fit. Skipping.`);
				continue;
			}

			const stringLength = Buffer.byteLength(stringData, 'utf8');

			let stringLengthBuffer = new Buffer.alloc(4);
			stringLengthBuffer.writeUInt32LE(stringLength, 0);

			// Write string without null terminator
			let stringBuffer = new Buffer.alloc(stringLength);
			stringBuffer.write(stringData);

			const keyBuffer = new Buffer.alloc(2);
			keyBuffer.writeUInt16LE(key, 0);

			buffer = Buffer.concat([buffer, stringLengthBuffer, stringBuffer, keyBuffer]);
		}

		// Prompt user for output file path
		console.log("\nEnter the path to the output BIN file: ");
		const outputPath = prompt().trim().replace(/['"]/g, '');

		fs.writeFileSync(outputPath, buffer);

		console.log(`\nSuccessfully wrote BIN to ${outputPath}.`);
	}

	FranchiseUtils.EXIT_PROGRAM();

})();