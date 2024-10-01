// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const validGameYears = [
    FranchiseUtils.YEARS.M24,
    FranchiseUtils.YEARS.M25
];

console.log("This program will check for any empty records that are referenced elsewhere.");

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {

    // Iterate through each table in the tables object
    for (const table of franchise.tables) 
    {
        if(!table)
        {
            continue;
        }

        await table.readRecords();

        // Iterate through each record in the table
        for(let i = 0; i < table.header.recordCapacity; i++)
        {
            if(!table.records[i].isEmpty)
            {
                continue;
            }

            // If the record is empty, check for references
            let refList = franchise.getReferencesToRecord(table.header.tableId, i);

            // If the reflist is empty or null, then continue
            if(!refList || refList.length === 0)
            {
                continue;
            }

            // If we're still here, we have a problem
            console.log(`Record ${i} in table ${table.header.tableId} is empty but has references.`);

            let refData = getBinaryReferenceData(table.header.tableId, i);

            for(const table of refList)
            {
                const currentRelatedTable = franchise.getTableById(table.tableId);
                const currentRelatedHeaders = FranchiseUtils.getColumnNames(currentRelatedTable);

                try {
                    for (let n = 0; n < currentRelatedHeaders.length;n++) {
                      for (let row = 0; row < currentRelatedTable.header.recordCapacity; row++) { // Iterate through the table rows
                          let currentCol = currentRelatedHeaders[n];
                          if (currentRelatedTable.records[row].fields[currentCol]["isReference"]) {
                            if (currentRelatedTable.records[row][currentCol] === refData) {
                                console.log("The reference is at row " + row + " in table " + currentRelatedTable.header.tableId + " in column " + currentCol); 
                            }
                          }
                      }
                   }
                  } catch (e) { // If there's an error, it's okay to just continue
                    continue;
                  }
            }
        }
    }

});

  