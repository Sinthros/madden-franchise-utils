const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

// List of allowed game years
const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24
];

// Print tool header message
console.log("This program will randomly generate the yearly salary cap increases.");

// Get the file's game year from the user
const gameYear = FranchiseUtils.getGameYear(validGameYears);

// Ensure auto-unempty is set to false, as this is an advanced option that we don't need for this program
const autoUnempty = false;

// Get the desired franchise file for the selected game year from the user, and pass in our auto-unempty option defined above
const franchise = FranchiseUtils.selectFranchiseFile(gameYear, autoUnempty);

franchise.on('ready', async function () {
  // Ensure the selected file is from a valid game year
  FranchiseUtils.validateGameYears(franchise, validGameYears);

  // Prompt user for the type of salary cap increase
  const increaseType = await FranchiseUtils.promptUser(
    "Do you want a traditional or authentic salary cap increase? (Type 'T' for traditional or 'A' for authentic): "
  );

  // Set the random number range based on user input
  let minRange, maxRange;
  if (increaseType.toUpperCase() === 'A') {
    minRange = 0;
    maxRange = 30000;
    console.log("Warning: Authentic salary cap increase option can potentially exceed $30 million per season.");
  } else {
    minRange = 0;
    maxRange = 2500;
  }

  // Get required tables
  const salCapIncreaseTable = franchise.getTableByUniqueId(tables.salCapIncreaseTable);

  // Read required tables
  await FranchiseUtils.readTableRecords([salCapIncreaseTable]);

  // Iterate through each row of the salary cap increase array table
  for (let i = 0; i < salCapIncreaseTable.header.numMembers; i++) {
    // Generate a random integer between the specified range
    const randomInt = FranchiseUtils.getRandomNumber(minRange, maxRange);

    // Update the current salary cap increase column (0th row and i-th column) with the random integer
    salCapIncreaseTable.records[0][`int${i}`] = randomInt;
  }

  // Program complete, so print success message, save the franchise file, and exit the program
  console.log("Successfully generated random salary cap increases.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
