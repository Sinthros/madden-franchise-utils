const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
  FranchiseUtils.YEARS.M26,
];

console.log("This program allows you to search all text fields across all tables for values containing the text you supply to search.");

const isFtc = FranchiseUtils.getYesOrNo("Is your file an FTC file? Enter yes or no. If you don't know what this means, enter no.", true);
const includeEmptyRows = FranchiseUtils.getYesOrNo("Should empty rows be included in the search? Enter yes or no. If you don't know what this means, enter yes.", true);

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: false, isFtcFile: isFtc});

franchise.on("ready", async function () {
  // Preload records for all tables
  const tableData = [];
  for (const table of franchise.tables) {
    await table.readRecords();
    const columns = FranchiseUtils.getColumnNames(table);
    tableData.push({ table, columns });
  }

  let searchValue;

  do {
    // Prompt the user for a search value
    searchValue = FranchiseUtils.getSearchValue(
      "Enter a string to search across any text fields. The table IDs and names where it is contained will be returned."
    ).toLowerCase();

    for (const { table, columns } of tableData) {
      for (const record of table.records) {
        if (!includeEmptyRows && record.isEmpty) continue
        for (const column of columns) {
          // Get field types
          const fieldOffset = record._fields[column].offset;
          const { enum: enumField, isReference, type, minValue, maxValue, maxLength } = fieldOffset;
          const isEnum = enumField !== undefined;
          
          if (fieldOffset.type === "string" || fieldOffset.type === "int" || isEnum) {
            const cellValue = String(record[column]).toLowerCase();
            if (cellValue.includes(searchValue)) {
              console.log(
                `Table ID: ${table.header.tableId}, Table Name: ${table.header.name}, Row: ${record.index},  Column Name: ${column}, Value: ${record[column]}`
              );
            }
          }
        }
      }
    }
  } while (
    FranchiseUtils.getYesOrNo("Would you like to search for another term? Enter yes or no.", true)
  );

  FranchiseUtils.EXIT_PROGRAM();
});




