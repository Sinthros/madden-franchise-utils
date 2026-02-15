const FranchiseUtils = require("../Utils/FranchiseUtils");
const prompt = require("prompt-sync")();
const UNDEFINED_TABLE_MSG = "Unable to load any table matching the name/ID provided.";
const EXIT_KWD = "EXIT";
const PRINT_KWD = "PRINT";
const PRINTALL_KWD = "PRINTALL";
const PRINTALLENUM_KWD = "PRINTALLENUM";
const PRINTALLCOLENUMS_KWD = "PRINTALLCOLENUM";

const validGameYears = [
  FranchiseUtils.YEARS.M20,
  FranchiseUtils.YEARS.M21,
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
  FranchiseUtils.YEARS.M26,
];

console.log(
  "This program will allow you to select any table by name or ID, and then will let you select a column to get valid schema values for.",
);

const franchise = FranchiseUtils.init(validGameYears, {
  promptForBackup: false,
});

async function getTable(franchise) {
  while (true) {
    console.log(
      "Please enter a table name or table ID to check (For example, Player or 4220). Table name is case sensitive.",
    );
    let tableId = prompt().trim();
    let table;

    if (!isNaN(parseInt(tableId, 10))) {
      tableId = parseInt(tableId, 10);
      // Check for either the ID or the unique ID
      table = franchise.getTableById(tableId) || franchise.getTableByUniqueId(tableId);
    } else {
      table = franchise.getTableByName(tableId);
    }

    if (typeof table !== "undefined") {
      await table.readRecords();
      return table;
    } else {
      console.log(UNDEFINED_TABLE_MSG);
    }
  }
}

function printColumnTypes(table) {
  const record = table.records[0];
  const columnNames = Object.keys(record._fields);

  console.log(`TypeScript field types for table: ${table.header.name}`);
  console.log(`----------------------------------------------------`);

  columnNames.forEach((column) => {
    const fieldOffset = record._fields[column].offset;
    const enumField = fieldOffset.enum;
    const isReference = fieldOffset.isReference;
    const type = fieldOffset.type;

    let tsType;

    if (enumField) {
      const enumName = toPascalCase(column);
      tsType = enumName;
    } else if (isReference) {
      tsType = "ReferenceField";
    } else if (type === "int" || type === "s_int" || type === "uint" || type === "float") {
      tsType = "number";
    } else if (type === "bool") {
      tsType = "boolean";
    } else if (type === "string") {
      tsType = "string";
    } else {
      tsType = "any"; // fallback for unknown/custom types
    }

    console.log(`${column}: ${tsType},`);
  });
}

function getTableField(table) {
  const record = table.records[0];
  const columnNames = Object.keys(record._fields);
  const lowerCaseColumnNames = columnNames.map((name) => name.toLowerCase());
  console.log("Table Information:");
  console.log(`Table Name: ${table.header.name}`);
  console.log(`Table ID: ${table.header.tableId}`);
  console.log(`Table Unique ID: ${table.header.uniqueId}`);

  while (true) {
    console.log(
      `Select a column from ${table.header.name} to get data for. If you want to print out the column names, enter 'print'. Enter 'printall' to print all column names and types. Enter 'exit' to stop searching for columns in this table.`,
    );
    const columnName = prompt().trim();

    if (columnName.toUpperCase() === EXIT_KWD) {
      break;
    }

    if (columnName.toUpperCase() === PRINT_KWD) {
      const chunkSize = 10;
      for (let i = 0; i < columnNames.length; i += chunkSize) {
        console.log(columnNames.slice(i, i + chunkSize).join(", "));
      }
      continue;
    }

    if (columnName.toUpperCase() === PRINTALL_KWD) {
      printColumnTypes(table);
      continue;
    }

    if (columnName.toUpperCase() === PRINTALLENUM_KWD) {
      printAllEnumValues(table);
      continue;
    }

    if (columnName.toUpperCase() === PRINTALLCOLENUMS_KWD) {
      printAllColumnNamesEnum(table);
      continue;
    }
    const lowerCaseColumnName = columnName.toLowerCase();
    const columnIndex = lowerCaseColumnNames.indexOf(lowerCaseColumnName);

    if (columnIndex !== -1) {
      const actualColumnName = columnNames[columnIndex];
      const fieldOffset = record._fields[actualColumnName].offset;
      const { enum: enumField, isReference, type, minValue, maxValue, maxLength } = fieldOffset;
      const isEnum = enumField !== undefined;
      const isInt = type === "int" || type === "s_int";
      const isString = type === "string";
      const isBool = type === "bool";

      if (isEnum) {
        const enumName = actualColumnName; // or customize this if you want PascalCase

        const enumValues = enumField._members.map((member) => member._name);

        console.log(`The field ${actualColumnName} has an enum of valid values. These values are as follows:`);

        // Existing CSV output
        const csvString = '"' + enumValues.join('","') + '"';
        console.log(csvString);

        // New: TypeScript enum output
        console.log(`\nexport enum ${enumName} {`);
        enumValues.forEach((value) => {
          const safeKey = value.replace(/[^a-zA-Z0-9_]/g, "_");
          console.log(`  ${safeKey} = '${value}',`);
        });
        console.log("}\n");
      } else if (isInt) {
        console.log(`The field ${actualColumnName} is an int.`);
        console.log(`Min value: ${minValue}`);
        console.log(`Max value: ${maxValue}`);
      } else if (isString) {
        console.log(`The field ${actualColumnName} is a string.`);
        console.log(`Max length: ${maxLength}`);
      } else if (isBool) {
        console.log(`The field ${actualColumnName} is a boolean. Valid values are true or false.`);
      } else {
        console.log(`The field ${actualColumnName} has an unknown type.`);
      }
    } else {
      console.log(`Column '${columnName}' does not exist. Please try again.`);
    }
  }
}

function toPascalCase(str) {
  return str.replace(/[_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^(.)/, (c) => c.toUpperCase());
}

function printAllEnumValues(table) {
  const record = table.records[0];
  const columns = Object.keys(record._fields);

  let foundAny = false;

  console.log(`\n===== TypeScript Enums for table: ${table.header.name} =====\n`);

  for (const column of columns) {
    const field = record._fields[column].offset;
    const { enum: enumField } = field;

    if (!enumField) continue;

    foundAny = true;

    const enumName = toPascalCase(column);
    const enumValues = enumField._members.map((m) => m._name);

    //console.log(`// Column: ${column}`);
    console.log(`export enum ${enumName} {`);

    enumValues.forEach((value) => {
      // Exclude anything ending with "_" except "Invalid_"
      if (value.endsWith("_") && value !== "Invalid_") return;

      const safeKey = value.replace(/[^a-zA-Z0-9_]/g, "_");
      const finalKey = /^\d/.test(safeKey) ? `_${safeKey}` : safeKey;

      console.log(`  ${finalKey} = '${value}',`);
    });

    console.log("}\n");
  }

  if (!foundAny) {
    console.log("No enum columns found on this table.\n");
  }
}

function printAllColumnNamesEnum(table) {
  const record = table.records[0];
  const columns = Object.keys(record._fields);

  console.log(`\n===== Column Name Enum for table: ${table.header.name} =====\n`);
  console.log(`export enum ColumnNames {`);

  columns.forEach((col) => {
    const safeKey = col.replace(/[^a-zA-Z0-9_]/g, "_");
    const finalKey = /^\d/.test(safeKey) ? `_${safeKey}` : safeKey;

    console.log(`  ${finalKey} = '${col}',`);
  });

  console.log("}\n");
}

franchise.on("ready", async function () {
  let continueLoop;
  do {
    const table = await getTable(franchise);
    getTableField(table);

    const message = "Do you want to select another table? Enter yes or no.";
    const response = FranchiseUtils.getYesOrNo(message);
    continueLoop = response;
  } while (continueLoop);

  FranchiseUtils.EXIT_PROGRAM();
});
