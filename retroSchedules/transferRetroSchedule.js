



// Requirements
const path = require('path');
const prompt = require('prompt-sync')();
const fs = require('fs');
const directoryPath = path.join(__dirname, 'schedules');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const TRANSFER_SCHEDULE_FUNCTIONS = require('./transferScheduleFromJson');
const autoUnempty = true;

console.log("In this program, you can insert any previous year's NFL schedule into your Franchise File.");
console.log("This only works with Madden 24 and 25 Franchise Files, and if your Franchise file is in the PreSeason.");


// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M24,
	FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames, {isAutoUnemptyEnabled: autoUnempty});
const tables = FranchiseUtils.getTablesObject(franchise);

let minYear = 1970;
let maxYear = 2023;
// Dynamically determine min and max year from folder
const files = fs.readdirSync(directoryPath);
const years = files.map(file => {
  try
  {
    return parseInt(file.split('.')[0]);
  }
  catch (error)
  {
    return 0;
  }
});
minYear = Math.min(...years);
maxYear = Math.max(...years);

async function promptUser() {
  let selectedYear;

  while (true) {
    // Ask the user for input
    const inputYear = prompt(`Enter the year of the schedule you would like to use (between ${minYear} and ${maxYear}): `);

    // Parse the input as an integer
    selectedYear = parseInt(inputYear, 10);
    if (selectedYear === 0)
    {
        // Move to special custom JSON case
        break;
    }
    // Check if the input is a valid year
    if (!Number.isNaN(selectedYear) && selectedYear >= minYear && selectedYear <= maxYear) 
    {
        break; // Exit the loop if the input is valid
    }

    console.log(`Invalid input. Please enter a year between ${minYear} and ${maxYear}.`);
  }

  if (selectedYear === 0)
  {
    // Custom JSON file case
    const customJsonPath = prompt('Enter the full path of the custom JSON file: ');
    try
    {
      const customJson = JSON.parse(fs.readFileSync(customJsonPath, 'utf8'));
      return customJson;
    }
    catch (error)
    {
      console.log(`Error reading or parsing custom JSON file: ${error}`);
      FranchiseUtils.EXIT_PROGRAM();
    }
  }
  else
  {
    const sourceScheduleJson = await processSelectedYear(selectedYear);
    return sourceScheduleJson;
  }
  // Valid input, process the selected year
}

// Function to process the selected year
async function processSelectedYear(year) {
  const fileName = `${year}.json`;
  const filePath = path.join(directoryPath, fileName);

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const sourceScheduleJson = JSON.parse(data);

    return sourceScheduleJson;

  } catch (error) {
    console.error(`Error reading or parsing JSON file ${fileName}:`, error);
    FranchiseUtils.EXIT_PROGRAM();
  }
}



franchise.on('ready', async function () {
  
  // Start the user prompt
  const sourceScheduleJson = await promptUser();
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
  await seasonInfoTable.readRecords();
  const currentStage = seasonInfoTable.records[0]['CurrentStage'];


  if (currentStage !== 'PreSeason') {
    console.log("Selected file is not in the PreSeason. Only Franchise Files in the PreSeason can have schedules inserted.")
    FranchiseUtils.EXIT_PROGRAM();

  }

  TRANSFER_SCHEDULE_FUNCTIONS.setFranchise(franchise);
  let transferStatus = await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(sourceScheduleJson);
  if(!transferStatus)
  {
    console.log("Unable to transfer schedule.");
  }
  else
  {
    console.log("Successfully inserted schedule into your franchise file.");
    await FranchiseUtils.saveFranchiseFile(franchise);
  }
  FranchiseUtils.EXIT_PROGRAM();
  
});

