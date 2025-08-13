// Required modules
const fs = require('fs');
const path = require('path');
const FranchiseUtils = require('../Utils/FranchiseUtils');

// Required lookups
const commentaryIdLookup = JSON.parse(fs.readFileSync(path.join(__dirname, '../Utils/JsonLookups/commentary_lookup.json')));

// Normalize keys to lowercase
for (const key in commentaryIdLookup)
{
	const lowerKey = key.toLowerCase();
	if (lowerKey !== key)
	{
		commentaryIdLookup[lowerKey] = commentaryIdLookup[key];
		delete commentaryIdLookup[key];
	}
}

// Valid years
const validGames = [
	FranchiseUtils.YEARS.M22,
	FranchiseUtils.YEARS.M23,
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25,
	FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log(`This program will update commentary IDs for players based on their last name to fix commentary lines. Madden ${FranchiseUtils.formatListString(validGames)} franchise files are supported.\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = parseInt(franchise.schema.meta.gameYear);

franchise.on('ready', async function () {
    // Get required tables	
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	// Read required tables
	await playerTable.readRecords();
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity; 

	// Ask if user would like to update draft class players
	const updateDcPlayers = FranchiseUtils.getYesOrNo("Would you like to update draft class players? (yes/no):");

	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (!FranchiseUtils.isValidPlayer(playerTable.records[i], {includeDraftPlayers: updateDcPlayers}))
		{
			continue;
        }

		// Get the player's last name
		const lastName = playerTable.records[i].LastName.toLowerCase().trim();

		// Get the player's sanitized last name
		const sanitizedLastName = FranchiseUtils.removeSuffixes(playerTable.records[i].LastName).toLowerCase().trim();

		// Get the player's commentary ID
		const currCommentaryId = playerTable.records[i].PLYR_COMMENT;

		if(commentaryIdLookup[lastName] === currCommentaryId || commentaryIdLookup[currCommentaryId] === currCommentaryId)
		{
			continue;
		}

		// New commentary ID should be either the last name or the sanitized last name. If neither are found, set to 0
		const newCommentaryId = commentaryIdLookup[lastName] || commentaryIdLookup[sanitizedLastName] || 0;

		playerTable.records[i].PLYR_COMMENT = newCommentaryId;

    }

	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nCommentary IDs updated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  