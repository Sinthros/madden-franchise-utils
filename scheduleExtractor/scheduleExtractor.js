// Required modules
const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const ScheduleFunctions = require('../Utils/ScheduleFunctions');

// Print tool header message
console.log("This program will allow you to extract the schedule in your Madden 24 or 25 franchise file to JSON.\n")

// Set up franchise file
const validGames = [ 
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames);

franchise.on('ready', async function () {
	// Convert schedule to object
	const scheduleObject = await ScheduleFunctions.convertScheduleToJson(franchise);
	
	// Convert object to string
	const jsonString = JSON.stringify(scheduleObject, null, 2);

	// Write to file named year.json
	const fileName = `${scheduleObject.year}.json`;
	fs.writeFileSync(fileName, jsonString, 'utf-8');

	// Program complete, so print success message and exit
	console.log(`\nSchedule extracted successfully. JSON saved to ${fileName}. Your franchise file has not been modified.\n`);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  