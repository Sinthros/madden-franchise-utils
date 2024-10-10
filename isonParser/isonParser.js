(async () => {
	// Required modules
	const FranchiseUtils = require('../Utils/FranchiseUtils');
	const fs = require('fs');
	const zlib = require('zlib');
	const prompt = require('prompt-sync')();

	// Required lookup files
	const stringLookup = JSON.parse(fs.readFileSync('lookupFiles/internedStringLookup.json'), 'utf8');
	const reverseStringLookup = {}; // Create a reverse lookup for JSON -> ISON
	for (let key in stringLookup) {
		reverseStringLookup[stringLookup[key].toLowerCase()] = parseInt(key); // Create reverse lookup
	}

	// ISON constants
	const ISON_HEADER = 0x0D;
	const ISON_OBJECT_START = 0x0F;
	const ISON_OBJECT_END = 0x13;
	const ISON_ARRAY_START = 0x0E;
	const ISON_ARRAY_END = 0x12;
	const ISON_INTERNED_STRING = 0x0A;
	const ISON_STRING = 0x0B;
	const ISON_KEYVALUEPAIR = 0x10;
	const ISON_DOUBLE = 0x09;
	const ISON_BYTE = 0x03;
	const ISON_END = 0x11;

	// Print tool header message
	console.log("This program will read raw ISON entries (typically used for CharacterVisuals data) and convert between ISON and JSON.\n");
	// Set up franchise file
	const validGames = [
		FranchiseUtils.YEARS.M25
	];
	const franchise = await FranchiseUtils.selectFranchiseFileAsync(FranchiseUtils.YEARS.M25);
	const tables = FranchiseUtils.getTablesObject(franchise);
	const characterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
	await characterVisualsTable.readRecords();


	console.log("Would you like to convert ISON to JSON (1) or JSON to ISON (2)?");

	const conversionType = parseInt(prompt().trim());

	if (conversionType !== 1 && conversionType !== 2) {
		console.log("Invalid conversion type. Exiting program.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	let filePath;
	let fileData;
	let isonOffset = 0;

	if (conversionType === 1) 
	{
		// Set up data buffer
		console.log("\nEnter the CharacterVisuals row number to convert to JSON: ");
		const rowNumber = parseInt(prompt().trim());
		fileData = getTable3IsonData(rowNumber);
	}
	else if (conversionType === 2)
	{
		console.log("\nEnter the CharacterVisuals row number to update: ");
		const rowNumber = parseInt(prompt().trim());
		
		console.log("\nEnter the path to the JSON file: ");
		
		filePath = prompt().trim().replace(/['"]/g, '');
		fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

		const isonBuffer = writeIsonFromJson(fileData);

		writeTable3IsonData(isonBuffer, rowNumber);

		console.log(`\nSuccessfully wrote ISON to row ${rowNumber}.`);

		await FranchiseUtils.saveFranchiseFile(franchise);

		FranchiseUtils.EXIT_PROGRAM();
	}

	// Function to read the ISON data from the CharacterVisuals table
	function getTable3IsonData(rowNumber) 
	{
		const table3Field = characterVisualsTable.records[rowNumber].getFieldByKey('RawData').thirdTableField;
		const table3Buffer = table3Field.unformattedValue;
		const compressedLength = table3Buffer.readUInt16LE(0);

		const compressedData = table3Buffer.subarray(2, 2 + compressedLength);

		return zlib.gunzipSync(compressedData);
	}

	// Function to write the ISON data to the CharacterVisuals table
	function writeTable3IsonData(isonBuffer, rowNumber)
	{
		const table3Field = characterVisualsTable.records[rowNumber].getFieldByKey('RawData').thirdTableField;
		const compressedData = zlib.gzipSync(isonBuffer);

		const newBuffer = Buffer.alloc(503);

		newBuffer.writeUInt16LE(compressedData.length, 0);
		compressedData.copy(newBuffer, 2);
		newBuffer.fill(0, compressedData.length + 2);

		table3Field.unformattedValue = newBuffer;
	}

	// Helper to write ISON file
	function writeBytes(buffer, offset, data) {
		data.copy(buffer, offset);
		return offset + data.length;
	}

	// Helper to write a single byte
	function writeByte(buffer, offset, byte) {
		buffer.writeUInt8(byte, offset);
		return offset + 1;
	}

	// Helper to write a double
	function writeDouble(buffer, offset, value) {
		buffer.writeDoubleLE(value, offset);
		return offset + 8;
	}

	// Helper to write a string
	function writeString(buffer, offset, value) {
		if(reverseStringLookup.hasOwnProperty(value.toLowerCase()))
		{
			offset = writeByte(buffer, offset, ISON_INTERNED_STRING); // Write interned string type
			const stringKey = reverseStringLookup[value.toLowerCase()];
			buffer.writeUInt16LE(stringKey, offset); // Write the string key (2 bytes)
			offset += 2;
			return offset;
		}

		offset = writeByte(buffer, offset, ISON_STRING); // Write string type		
		const strBuffer = Buffer.from(value, 'utf8');
		buffer.WriteUInt32LE(strBuffer.length, offset); // Write the string length (4 bytes)
		offset += 4;
		return writeBytes(buffer, offset, strBuffer);
	}

	// Convert JSON back to ISON
	function jsonToIson(json, buffer, offset = 0) 
	{	
		if (typeof json === 'object' && !Array.isArray(json)) {
			offset = writeByte(buffer, offset, ISON_OBJECT_START); // Write object start byte
			for (const key in json) {
				offset = writeByte(buffer, offset, ISON_KEYVALUEPAIR); // Write key-value pair marker
				offset = writeString(buffer, offset, key); // Write the key (assume all keys are strings)
				offset = jsonToIson(json[key], buffer, offset); // Write the value recursively
			}
			offset = writeByte(buffer, offset, ISON_OBJECT_END); // Write object end byte
		} else if (Array.isArray(json)) {
			offset = writeByte(buffer, offset, ISON_ARRAY_START); // Write array start byte
			for (const item of json) {
				offset = jsonToIson(item, buffer, offset); // Write each array item recursively
			}
			offset = writeByte(buffer, offset, ISON_ARRAY_END); // Write array end byte
		} else if (typeof json === 'string') {
			if (reverseStringLookup.hasOwnProperty(json.toLowerCase())) {
				offset = writeByte(buffer, offset, ISON_INTERNED_STRING); // Write interned string type
				const stringKey = reverseStringLookup[json.toLowerCase()];
				buffer.writeUInt16LE(stringKey, offset); // Write the string key (2 bytes)
				offset += 2;
			} else {
				offset = writeByte(buffer, offset, ISON_STRING); // Write string type
				offset = writeString(buffer, offset, json); // Write the string value
			}
		} else if (typeof json === 'number' && !Number.isInteger(json)) {
			offset = writeByte(buffer, offset, ISON_DOUBLE); // Write double type
			offset = writeDouble(buffer, offset, json); // Write the double value
		} else if (typeof json === 'boolean' || typeof json === 'number') {
			offset = writeByte(buffer, offset, ISON_BYTE); // Write byte type for boolean or byte
			offset = writeByte(buffer, offset, json); // Write the byte value
		}
		return offset;
	}

	// Function to convert JSON to ISON and write it to a file
	function writeIsonFromJson(jsonObj) {
		// Estimate the buffer size; this can be optimized based on specific requirements.
		let buffer = Buffer.alloc(1024 * 1024); // 1MB buffer for now
		let offset = 0;

		// Write the ISON header
		offset = writeByte(buffer, offset, ISON_HEADER);

		// Convert the JSON to ISON
		offset = jsonToIson(jsonObj, buffer, offset);

		// Write the ISON terminator
		offset = writeByte(buffer, offset, ISON_END);

		// Write the buffer to the file
		//fs.writeFileSync(filePath, buffer.subarray(0, offset));

		return buffer.subarray(0, offset);
	}

	// Function to read a specified number of bytes from the buffer
	function readBytes(length) {
		const bytes = fileData.subarray(isonOffset, isonOffset + length);
		isonOffset += length;
		return bytes;
	}

	// Decrement the offset
	function decrementOffset(length = 1) {
		isonOffset -= length;
	}

	// Function to read the value depending on its type
	function readValue() {
		const valueType = readBytes(1).readUInt8(0);

		if (valueType === ISON_INTERNED_STRING) {
			const stringKey = readBytes(2).readUInt16LE(0);
			return stringLookup[stringKey]; // Return the interned string from the lookup
		} else if (valueType === ISON_STRING) {
			const stringLength = readBytes(4).readUInt32LE(0);
			return readBytes(stringLength).toString('utf8'); // Read and return the full string
		} else if (valueType === ISON_DOUBLE) {
			return readBytes(8).readDoubleLE(0); // Read and return a double value
		} else if (valueType === ISON_BYTE) {
			return readBytes(1).readUInt8(0); // Read and return a byte value
		} else if (valueType === ISON_OBJECT_START) {
			return readObject(); // Recursively read an object
		} else if (valueType === ISON_ARRAY_START) {
			return readArray(); // Recursively read an array
		}

		return null;
	}

	// Function to read an array
	function readArray() {
		let arr = [];
		let byte;

		do {
			byte = readBytes(1).readUInt8(0);
			if (byte !== ISON_ARRAY_END) {
				decrementOffset(1); // Decrement offset to re-read this byte for the next value type
				arr.push(readValue()); // Read the value and push it to the array
			}
		} while (byte !== ISON_ARRAY_END);

		return arr; // Return the constructed array
	}

	// Function to read an object
	function readObject() {
		let obj = {};
		let byte;

		do {
			byte = readBytes(1).readUInt8(0);
			if (byte === ISON_KEYVALUEPAIR) {
				const key = readValue(); // Read the key
				const value = readValue(); // Read the corresponding value
				obj[key] = value; // Assign key-value pair to the object
			} else if (byte !== ISON_OBJECT_END) {
				// If we haven't reached the object end, put the byte back and continue reading
				decrementOffset(1);
				readValue(); // Continue reading values (this might be nested structures)
			}
		} while (byte !== ISON_OBJECT_END);

		return obj; // Return the constructed object
	}

	// Initial object to store the data
	let obj = {};

	// Read the first byte
	const firstByte = readBytes(1).readUInt8(0);

	// Check if the first byte is 0x0D (ISON_HEADER)
	if (firstByte !== ISON_HEADER) {
		console.log("This is not an ISON file. Exiting program.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	// Start reading the value into the object
	obj = readValue();

	const lastByte = readBytes(1).readUInt8(0);

	// Verify the proper ISON_END byte
	if (lastByte !== ISON_END) {
		console.log("Didn't find proper ISON terminator. Exiting program.");
		FranchiseUtils.EXIT_PROGRAM();
	}

	// Write the object to a JSON file
	const json = JSON.stringify(obj, null, 4);

	// Get the target file path from the user
	console.log("\nEnter the path to write the JSON file: ");
	const newFilePath = prompt().trim().replace(/['"]/g, '');

	fs.writeFileSync(newFilePath, json);

	console.log(`\nSuccessfully wrote JSON to ${newFilePath}.`);

	FranchiseUtils.EXIT_PROGRAM();
})();
