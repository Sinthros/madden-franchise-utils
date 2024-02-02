const fs = require('fs');
const xlsx = require('xlsx');

let externalDataService = {};

externalDataService.getAvailableFormats = function () {
  return [{
    'format': 'csv',
    'text': 'CSV'
  }, {
    'format': 'xlsx',
    'text': 'XLSX'
  }];
};



externalDataService.importTableData = function (options) {
  return new Promise((resolve, reject) => {
    const wb = xlsx.readFile(options.inputFilePath);
    
    resolve(xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      'raw': false
    }));
  });
};



externalDataService.exportTableData = function (options, table,firstGame = null, secondGame = null ) {
  return new Promise((resolve, reject) => {
    if (!options) { reject('Invalid arguments. Please call .exportTableData with (options, FranchiseFileTable)'); }
    let headers = table.offsetTable.map((offset) => {
      return offset.name;
    });

    let tableName = table.header.name // Get current table name
    let tableUniqueId = table.header.tablePad1;


    


    if (tableName === 'YearSummary') {
      // Suppose you want to rename the "AFC_Team" header to "AFC_Team_Identity"
      // Find the index of the header to rename
      const afcHeader = headers.indexOf("AFC_Team");

      // Check if the header exists in the array
      if (afcHeader !== -1) {
        // Rename the header by updating the value at the index
        headers[afcHeader] = "AFC_Team_Identity";
      } else {
        console.log("Header not found");
      }

      const nfcHeader = headers.indexOf("NFC_Team");

      // Check if the header exists in the array
      if (nfcHeader !== -1) {
        // Rename the header by updating the value at the index
        headers[nfcHeader] = "NFC_Team_Identity";
      } else {
        console.log("Header not found");
      }
    }

    // If it's the team table AND we're moving from M22 to M24
    if (tableName === 'Team' && firstGame === 22 && secondGame === 24) {
      const targetIndices = [ // M22 has 67 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
        0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
        31, 32, 33, 34, 35, 36
      ];

      const reorderedRows = []; // Initiate our reordered rows
      let i = 0;
      for (const index of targetIndices) {  //Iterate through targetIndices
        if (index !== -1) { // If it's a row to keep, utilize the splice function
          reorderedRows.splice(index,0,table.records[i]) // I lowkey forget exactly how this works, but basically put the current index in the right place in reorderedRows, so that it's... Reordered.
          
        }
        i = i+1; // Move to the next index
    
      }
      var data = reorderedRows.map((record) => {
        return record.fieldsArray.map((field) => {
          return field.value;
        });
      });



    }

    else if ((tableUniqueId === 3584052617 || tableUniqueId === 434873538) && firstGame === 22 && secondGame === 24) {
      const targetIndices = [ // M22 has 67 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
      0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32, 33, 34, 35, 36
    ];

      const reorderedRows = []; // Initiate our reordered rows
      let i = 0;
      for (const index of targetIndices) {  //Iterate through targetIndices
        if (index !== -1) { // If it's a row to keep, utilize the splice function
          reorderedRows.splice(index,0,table.records[i]) // I lowkey forget exactly how this works, but basically put the current index in the right place in reorderedRows, so that it's... Reordered.
          
        }
        i = i+1; // Move to the next index
    
      }
      var data = reorderedRows.map((record) => {
        return record.fieldsArray.map((field) => {
          return field.value;
        });
    });

    }

    else if ((tableUniqueId === 3545956611 || tableUniqueId === 3512815678) && firstGame === 22 && secondGame === 24) {
        const targetIndices = [ // M22 has 67 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1, -1, 16, 17,18, 19,
        -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        20, 21, 22, 23, 24, 
        25, 28, 29, 30, 31, 32, 33, 34, 35, 26, 27, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 
        46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 
        64, 65, 66, 67, 68, 69, 70, 71, 72, 73

      ];

      const reorderedRows = []; // Initiate our reordered rows
      let i = 0;
      for (const index of targetIndices) {  //Iterate through targetIndices
        if (index !== -1) { // If it's a row to keep, utilize the splice function
          reorderedRows.splice(index,0,table.records[i]) // I lowkey forget exactly how this works, but basically put the current index in the right place in reorderedRows, so that it's... Reordered.
          
        }
        i = i+1; // Move to the next index
    
      }
      var data = reorderedRows.map((record) => {
        return record.fieldsArray.map((field) => {
          return field.value;
        });
      });

    }

    else if (tableUniqueId === 3638782800 && firstGame === 22 && secondGame === 24) {
      const targetIndices = [ // M22 has 67 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
      0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
      31, 32, 33, 34, 35, 36
     ];

     const reorderedRows = []; // Initiate our reordered rows
     let i = 0;
     for (const index of targetIndices) {  //Iterate through targetIndices
       if (index !== -1) { // If it's a row to keep, utilize the splice function
         reorderedRows.splice(index,0,table.records[i]) // I lowkey forget exactly how this works, but basically put the current index in the right place in reorderedRows, so that it's... Reordered.
         
       }
       i = i+1; // Move to the next index
   
     }
     var data = reorderedRows.map((record) => {
       return record.fieldsArray.map((field) => {
         return field.value;
       });
     });


    }

    
     else {
      var data = table.records.map((record) => {
        return record.fieldsArray.map((field) => { return field.value; });
      });

    }


    let rowEmptyArray = [] // Initiate empty row array
    if (tableName === 'Team' && firstGame === 22 && secondGame === 24) { // If it's the team table AND we're moving from M22 to M24... (TODO: IMPLEMENT THAT ARGUMENT)
      rowEmptyArray = [20,24] // These are the rows in M24's Team table that are always to be emptied
    }
    else if ((tableUniqueId === 3545956611 || tableUniqueId === 3512815678) && firstGame === 22 && secondGame === 24) {
      rowEmptyArray = [40,41,48,49];
      
    }
    else if ((tableUniqueId === 3584052617 || tableUniqueId === 434873538) && firstGame === 22 && secondGame === 24) {
      rowEmptyArray = [20,24]
    }
    else if (tableUniqueId === 3638782800 && firstGame === 22 && secondGame === 24) {
      rowEmptyArray = [20,24]
    }
    else { // Else, get the empty records dynamically
      table.records.filter(record => record.isEmpty).forEach(record => rowEmptyArray.push(record.index));

    }
    

    if (tableName === 'Player') {
      // Load the JSON data from player_columns_lookup.json
      const jsonContent = fs.readFileSync('lookupFiles/player_columns_lookup.json', 'utf8');
      const playerColumnsLookup = JSON.parse(jsonContent);
      
      // Extract the outer keys into an array
      const outerKeysArray = Object.keys(playerColumnsLookup);
      for (let currentColIndex = 0;currentColIndex < outerKeysArray.length;currentColIndex++){
        let currentCol = outerKeysArray[currentColIndex]
        data.forEach((obj,i) => { // For each row, if it's an empty row push TRUE, else push FALSE
          let currentValue = table.records[i][currentCol]
          let updatedValue = playerColumnsLookup[currentCol][currentValue]

          if (typeof updatedValue !== 'undefined') {
            obj.push(updatedValue);
          }
          else {
            obj.push(table.records[i][currentCol]);
          }
          i++;
          });
        const contractStatusIndex = headers.indexOf(currentCol); // Find the index of "ContractStatus" in headers array
        if (contractStatusIndex !== -1) {
          headers[contractStatusIndex] = `${currentCol}_OLD`; // Rename the header
        
  
        headers.push(currentCol)
        
        } 
     }
     if (firstGame === 22 && secondGame === 24) {
        // Define new columns and their respective default values
        const newColumnsDefaults = {
          Tag1: "NoRole",       // Default value for Tag1
          Tag2: "NoRole",      // Default value for Tag2
          Motivation1: "None",
          Motivation2: "None",
          Motivation3: "None"
        };

        Object.entries(newColumnsDefaults).forEach(([newCol, defaultValue]) => {
          data.forEach((obj) => {
            obj.push(defaultValue);
          });
          headers.push(newCol);
        });

     }


      
      table.records.filter(record => record.ContractStatus === 'Draft').forEach(record => {
        rowEmptyArray.push(record.index); // Push the index to rowEmptyArray
      });
    }
    if (tableName === 'Coach' && firstGame === 22 && secondGame === 24) { // If it's the team table AND we're moving from M22 to M24... (TODO: IMPLEMENT THAT ARGUMENT)
        data.forEach((obj,i) => { // For each row, if it's an empty row push TRUE, else push FALSE

          if (rowEmptyArray.includes(i)) {
            obj.push('00000000000000000000000000000000');
          }
          else {
            obj.push(table.records[i]['DefaultTeamPhilosophy']);
          }
          i++;
        });
        const contractStatusIndex = headers.indexOf("DefaultTeamPhilosophy"); // Find the index of "ContractStatus" in headers array
        if (contractStatusIndex !== -1) {
          headers[contractStatusIndex] = "DefaultTeamPhilosophy_OLD"; // Rename the header
      

          headers.push("DefaultTeamPhilosophy")
        }
    }

    



    let nextRecordToUse = table.header.nextRecordToUse // nextRecordToUse for the table
    data.forEach((obj,i) => { // For each row, if it's an empty row push TRUE, else push FALSE
      if (rowEmptyArray.includes(i)) {
        obj.push(true);
      }
      else {
        obj.push(false);
      }
      i++;
    });

    i = 0
    data.forEach((obj) => { // For each row, if it's the next record to use push TRUE, else push FALSE
      if (i == nextRecordToUse) { // Only 1 row should have this as true
        obj.push(true);
      }
      else {
        obj.push(false);
      }
      i++;
    });
    headers.push("isRowEmpty")
    headers.push("nextRecordToUse")


    let wb = xlsx.utils.book_new();


    const ws = xlsx.utils.json_to_sheet([headers].concat(data), {
      'skipHeader': true
    });

    xlsx.utils.book_append_sheet(wb, ws);

    try {
      xlsx.writeFile(wb, options.outputFilePath);
    }
    catch (err) {
      reject(err);
    }

    resolve();
  });
};

externalDataService.exportRawTableData = async (options, table) => {
  if (!options) { reject('Invalid arguments. Please call .exportTableData with (options, FranchiseFileTable)'); }
  fs.writeFileSync(options.outputFilePath, table.data);
};

externalDataService.exportFrt = async (options, file) => {
  if (!options) { reject('Invalid arguments. Please call .exportTableData with (options, FranchiseFile)'); }
  fs.writeFileSync(options.outputFilePath, file.unpackedFileContents);
};

externalDataService.importRawTable = async (options, table) => {
  if (!options) { reject('Invalid arguments. Please call .exportTableData with (options, FranchiseFileTable)'); }
  const tableData = await fs.readFileSync(options.filePath);
  await table.replaceRawData(tableData, true);
};

module.exports = externalDataService;