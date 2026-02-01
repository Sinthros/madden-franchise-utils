// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');

// List of allowed game years
const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
  FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log("This program will randomly generate the yearly salary cap increases over a 30 season period.");

// Get the desired franchise file for the selected game year from the user, and pass in our auto-unempty option defined above
const franchise = FranchiseUtils.init(validGameYears);

const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
  // Get required tables
  const salCapIncreaseTable = franchise.getTableByUniqueId(tables.salCapIncreaseTable);

  // Read required tables
  await FranchiseUtils.readTableRecords([salCapIncreaseTable]);

  // Iterate through each row of the salary cap increase array table
  for (let i = 0; i < salCapIncreaseTable.header.numMembers; i++) {
    // Generate a random integer between 0 and 2500
    const randomInt = FranchiseUtils.getRandomNumber(0, 2500);

    // Update the current salary cap increase column (0th row and i-th column) with the random integer
    salCapIncreaseTable.records[0][`int${i}`] = randomInt;
  }

  // Program complete, so print success message, save the franchise file, and exit the program
  console.log("Successfully generated random salary cap increases.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
