



const Franchise = require('madden-franchise');
// Requirements
const path = require('path');
const prompt = require('prompt-sync')();
const fs = require('fs');
const directoryPath = path.join(__dirname, 'schedules');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const TRANSFER_SCHEDULE_FUNCTIONS = require('./transferScheduleFromJson');
const gameYear = '24';
const autoUnempty = true;

console.log("In this program, you can insert any previous year's NFL schedule into your Franchise File.");
console.log("This only works with Madden 24 Franchise Files, and if your Franchise file is in the PreSeason.");


const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);

async function promptUser() {
  let selectedYear;

  while (true) {
    // Ask the user for input
    const inputYear = prompt('Enter the year of the schedule you would like to use (between 1970 and 2023): ');

    // Parse the input as an integer
    selectedYear = parseInt(inputYear, 10);

    // Check if the input is a valid year
    if (!Number.isNaN(selectedYear) && selectedYear >= 1970 && selectedYear <= 2023) {
      break; // Exit the loop if the input is valid
    }

    console.log('Invalid input. Please enter a year between 1970 and 2023.');
  }

  // Valid input, process the selected year
  const sourceScheduleJson = await processSelectedYear(selectedYear);
  return sourceScheduleJson;
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
  }
}



franchise.on('ready', async function () {
  // Start the user prompt
  const sourceScheduleJson = await promptUser();
  const seasonInfoTable = franchise.getTableByUniqueId(3123991521);
  await seasonInfoTable.readRecords();
  const currentStage = seasonInfoTable.records[0]['CurrentStage'];

  const gameYear = franchise.schema.meta.gameYear // Get the game year of the source file
  if (gameYear !== 24) {
    console.log("Selected file is not a Madden 24 Franchise File. Enter anything to exit.")
    prompt();
    process.exit(0);
  }
  if (currentStage !== 'PreSeason') {
    console.log("Selected file is not in the PreSeason. Only Franchise Files in the PreSeason can have schedules inserted. Enter anything to exit.")
    prompt();
    process.exit(0);

  }

  await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(sourceScheduleJson,franchise);

  console.log("Successfully inserted schedule into your franchise file.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit the program.");
  prompt();
  
});

