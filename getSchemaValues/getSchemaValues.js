const fs = require("fs");
const path = require("path");
const FranchiseUtils = require("../Utils/FranchiseUtils");
const prompt = require("prompt-sync")();
const UNDEFINED_TABLE_MSG = "Unable to load any table matching the name/ID provided.";
const EXIT_KWD = "EXIT";
const PRINT_KWD = "PRINT";
const PRINTALL_KWD = "PRINTALL";
const PRINTALLENUM_KWD = "PRINTALLENUM";
const PRINTALLCOLENUMS_KWD = "PRINTALLCOLENUM";
const PRINTALLMINMAX_KWD = "PRINTALLMINMAX";
const GENERATESCHEMA_KWD = "GENERATESCHEMA";
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
      tsType = "any";
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
      `Select a column from ${table.header.name} to get data for. 
    Enter 'print' to print column names. 
    Enter 'printall' to print all column names and types. 
    Enter 'printallenum' to print all enums. 
    Enter 'printallcolenum' to print ColumnNames enum. 
    Enter 'printallminmax' to print MinFieldValues / MaxFieldValues.
    Enter 'generateschema' to generate a full .enums.ts schema file.
    Enter 'exit' to stop searching for columns in this table.`,
    );

    const columnName = prompt().trim();

    if (columnName.toUpperCase() === EXIT_KWD) break;

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

    if (columnName.toUpperCase() === PRINTALLMINMAX_KWD) {
      printAllMinMaxValues(table);
      continue;
    }

    if (columnName.toUpperCase() === GENERATESCHEMA_KWD) {
      generateSchemaFile(table);
      continue;
    }

    const lowerCaseColumnName = columnName.toLowerCase();
    const columnIndex = lowerCaseColumnNames.indexOf(lowerCaseColumnName);

    if (columnIndex !== -1) {
      const actualColumnName = columnNames[columnIndex];
      const fieldOffset = record._fields[actualColumnName].offset;
      const { enum: enumField, type, minValue, maxValue, maxLength } = fieldOffset;

      const isEnum = enumField !== undefined;
      const isInt = type === "int" || type === "s_int";
      const isString = type === "string";
      const isBool = type === "bool";

      if (isEnum) {
        const enumName = actualColumnName;
        const enumValues = enumField._members.map((member) => member._name);

        console.log(`The field ${actualColumnName} has an enum of valid values. These values are as follows:`);
        const csvString = '"' + enumValues.join('","') + '"';
        console.log(csvString);

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

function buildTypesFileContent(table) {
  const record = table.records[0];
  const columnNames = Object.keys(record._fields);
  const lines = [];

  lines.push(`export interface ${table.header.name} extends BaseRecord {`);

  columnNames.forEach((column) => {
    const fieldOffset = record._fields[column].offset;
    const enumField = fieldOffset.enum;
    const isReference = fieldOffset.isReference;
    const type = fieldOffset.type;

    let tsType;

    if (enumField) {
      tsType = toPascalCase(column);
    } else if (isReference) {
      tsType = "ReferenceField";
    } else if (type === "int" || type === "s_int" || type === "uint" || type === "float") {
      tsType = "number";
    } else if (type === "bool") {
      tsType = "boolean";
    } else if (type === "string") {
      tsType = "string";
    } else {
      tsType = "any";
    }

    lines.push(`  ${column}: ${tsType};`);
  });

  lines.push(`}`);

  return lines;
}

function generateSchemaFile(table) {
  const tableName = table.header.name;
  const baseName = tableName.charAt(0).toLowerCase() + tableName.slice(1);

  const enumFileName = baseName + ".enums.ts";
  const typesFileName = baseName + ".types.ts";

  const enumOutputPath = path.join(__dirname, enumFileName);
  const typesOutputPath = path.join(__dirname, typesFileName);

  const record = table.records[0];
  const columns = Object.keys(record._fields);
  const lines = [];

  lines.push(`// Auto-generated schema for table: ${tableName}`);
  lines.push(``);

  lines.push(`export enum ColumnNames {`);
  columns.forEach((col) => {
    const safeKey = col.replace(/[^a-zA-Z0-9_]/g, "_");
    const finalKey = /^\d/.test(safeKey) ? `_${safeKey}` : safeKey;
    lines.push(`  ${finalKey} = '${col}',`);
  });
  lines.push(`}`);
  lines.push(``);

  const minEntries = [];
  const maxEntries = [];

  for (const col of columns) {
    const field = record._fields[col].offset;
    const { type, minValue, maxValue } = field;

    const isNumeric = type === "int" || type === "s_int" || type === "uint" || type === "float";
    if (!isNumeric) continue;

    if (typeof minValue === "number") minEntries.push(`  ${col} = ${minValue},`);
    if (typeof maxValue === "number") maxEntries.push(`  ${col} = ${maxValue},`);
  }

  lines.push(`export enum MinFieldValues {`);
  minEntries.forEach((l) => lines.push(l));
  lines.push(`}`);
  lines.push(``);

  lines.push(`export enum MaxFieldValues {`);
  maxEntries.forEach((l) => lines.push(l));
  lines.push(`}`);
  lines.push(``);

  for (const column of columns) {
    const field = record._fields[column].offset;
    const { enum: enumField } = field;
    if (!enumField) continue;

    const enumName = toPascalCase(column);
    const enumValues = enumField._members.map((m) => m._name);

    lines.push(`export enum ${enumName} {`);
    enumValues.forEach((value) => {
      if (value.endsWith("_") && value !== "Invalid_") return;
      const safeKey = value.replace(/[^a-zA-Z0-9_]/g, "_");
      const finalKey = /^\d/.test(safeKey) ? `_${safeKey}` : safeKey;
      lines.push(`  ${finalKey} = '${value}',`);
    });
    lines.push(`}`);
    lines.push(``);
  }

  fs.writeFileSync(enumOutputPath, lines.join("\n"), "utf8");

  const typeLines = buildTypesFileContent(table);
  fs.writeFileSync(typesOutputPath, typeLines.join("\n"), "utf8");

  console.log(`\nSchema file written to: ${enumOutputPath}`);
  console.log(`Types file written to: ${typesOutputPath}\n`); // 🔥 NEW
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
