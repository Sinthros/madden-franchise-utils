const FranchiseUtils = require('../Utils/FranchiseUtils');
const prompt = require('prompt-sync')();
const UNDEFINED_TABLE_MSG = "Unable to load any table matching the name/ID provided.";
const EXIT_KWD = 'EXIT';
const PRINT_KWD = 'PRINT';

const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program will allow you to select any table by name or ID, and then will let you select a column to get valid schema values for.");

const franchise = FranchiseUtils.init(validGameYears);

async function getTable(franchise) {
  while (true) {
    console.log("Please enter a table name or table ID to check (For example, Player or 4220). Names are case sensitive.");
    let tableId = prompt().trim();
    let table;

    if (!isNaN(parseInt(tableId, 10))) {
      tableId = parseInt(tableId, 10);
      // Check for either the ID or the unique ID
      table = franchise.getTableById(tableId) || franchise.getTableByUniqueId(tableId);
    } else {
      // Capitalize the first letter and make the rest lowercase
      tableId = tableId.charAt(0).toUpperCase() + tableId.slice(1).toLowerCase();
      table = franchise.getTableByName(tableId);
    }

    if (typeof table !== 'undefined') {
      await table.readRecords();
      return table;
    } else {
      console.log(UNDEFINED_TABLE_MSG);
    }
  }
}

function getTableField(table) {
  const record = table.records[0];
  const columnNames = Object.keys(record._fields);
  const lowerCaseColumnNames = columnNames.map(name => name.toLowerCase());

  while (true) {
    console.log(`Select a column from ${table.header.name} to get data for (case sensitive). If you want to print out the column names, enter 'print'. Enter 'exit' to stop searching for columns in this table.`);
    const columnName = prompt().trim();

    if (columnName.toUpperCase() === EXIT_KWD) {
      break;
    }

    if (columnName.toUpperCase() === PRINT_KWD) {
      const chunkSize = 10;
      for (let i = 0; i < columnNames.length; i += chunkSize) {
        console.log(columnNames.slice(i, i + chunkSize).join(', '));
      }
      continue;
    }

    const lowerCaseColumnName = columnName.toLowerCase();
    const columnIndex = lowerCaseColumnNames.indexOf(lowerCaseColumnName);

    if (columnIndex !== -1) {
      const actualColumnName = columnNames[columnIndex];
      const fieldOffset = record._fields[actualColumnName].offset;
      const { enum: enumField, isReference, type, minValue, maxValue, maxLength } = fieldOffset;
      const isEnum = enumField !== undefined;
      const isInt = type === 'int' || type === 's_int';
      const isString = type === 'string';

      if (isEnum) {
        console.log(`The field ${actualColumnName} has an enum of valid values. These values are as follows:`);
        const csvString = '"' + enumField._members.map(member => member._name).join('","') + '"';
        console.log(csvString);

      } else if (isReference) {
        console.log(`The field ${actualColumnName} is a reference of type ${type}`);
        
      } else if (isInt) {
        console.log(`The field ${actualColumnName} is an int.`);
        console.log(`Min value: ${minValue}`);
        console.log(`Max value: ${maxValue}`);

      } else if (isString) {
        console.log(`The field ${actualColumnName} is a string.`);
        console.log(`Max length: ${maxLength}`);
        
      } else {
        console.log(`The field ${actualColumnName} has an unknown type.`);
      }
    } else {
      console.log(`Column '${columnName}' does not exist. Please try again.`);
    }
  }
}


franchise.on('ready', async function () {

  let continueLoop;
  do {
    const table = await getTable(franchise);
    getTableField(table);

    const message = ("Do you want to select another table? Enter yes or no.");
    const response = FranchiseUtils.getYesOrNo(message);
    continueLoop = response;

  } while (continueLoop);

  FranchiseUtils.EXIT_PROGRAM();
});



