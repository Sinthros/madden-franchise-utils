const Franchise = require('madden-franchise');
const path = require('path');
const os = require('os');
const fs = require('fs');
const prompt = require('prompt-sync')();
const zeroRef = '00000000000000000000000000000000';

function selectFranchiseFile(gameYear,isAutoUnemptyEnabled = false, isFtcFile = false) {
  const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
  const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
  let default_path = documentsDir; // Set to default dir first
  let franchise;
  let filePrefix;
  if (isFtcFile) {
    filePrefix = 'franchise-';
  }
  else {
    filePrefix = 'CAREER-'
  }
  
  if (fs.existsSync(documentsDir)) {
      default_path = documentsDir;
  } else if (fs.existsSync(oneDriveDir)) {
      default_path = oneDriveDir;
  } else {
      console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
  }

  while (true) {
      try {
          console.log("Please enter the name of your franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder.");
          let fileName = prompt();
          fileName = fileName.trim(); // Remove leading/trailing spaces
          
          if (fileName.startsWith(filePrefix)) {
              franchise = new Franchise(path.join(default_path, fileName), {'autoUnempty': isAutoUnemptyEnabled});
          } else {
              franchise = new Franchise(fileName.replace(new RegExp('/', 'g'), '\\'), {'autoUnempty': isAutoUnemptyEnabled});
          }

          return franchise;
      } catch (e) {
          console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
          continue;
      }
  }
};

async function selectFranchiseFileAsync(gameYear,isAutoUnemptyEnabled = false, isFtcFile = false) {
    const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
    const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
    let default_path = documentsDir; // Set to default dir first
    let franchise;
    let filePrefix;

    if (isFtcFile) {
        filePrefix = 'franchise-';
    }
    else {
        filePrefix = 'CAREER-'
    }
    
    if (fs.existsSync(documentsDir)) {
        default_path = documentsDir;
    } else if (fs.existsSync(oneDriveDir)) {
        default_path = oneDriveDir;
    } else {
        console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
    }
  
    while (true) {
        try {
            console.log("Please enter the name of your franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder.");
            let fileName = prompt();
            fileName = fileName.trim(); // Remove leading/trailing spaces
            
            if (fileName.startsWith(filePrefix)) {
                franchise = await Franchise.create(path.join(default_path, fileName), {'autoUnempty': isAutoUnemptyEnabled});
            } else {
                franchise = await Franchise.create(fileName.replace(new RegExp('/', 'g'), '\\'), {'autoUnempty': isAutoUnemptyEnabled});
            }
  
            return franchise;
        } catch (e) {
            console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
            continue;
        }
    }
};

async function saveFranchiseFile(franchise) {
    while (true) {
        console.log("Would you like to save your changes? Enter yes to save your changes, or no to quit without saving.");
        const finalPrompt = prompt().trim();
    
        if (finalPrompt.toUpperCase() === 'YES') {
            await franchise.save();
            console.log("Franchise file successfully saved!");
            break;
        } else if (finalPrompt.toUpperCase() === 'NO') {
            console.log("Your Franchise File has not been saved.");
            break;
        } else {
            console.log("Invalid input. Please enter 'yes' to save or 'no' to not save.");
        }
    }
};

async function readTableRecords(tablesList) {
    for (const table of tablesList) {
        await table.readRecords();
    }
}

function getGameYear(validGameYears) {
    let gameYear;

    while (true) {
        console.log(`Select the version of Madden your franchise file uses. Valid inputs are ${validGameYears.join(', ')}`);
        gameYear = prompt();

        if (validGameYears.includes(gameYear)) {
            break;
        } else {
            console.log("Invalid option. Please try again.");
        }
    }

    return gameYear;
};

// Function to calculate the Best Overall and Best Archetype for a player
// This takes in a player record object; For example, if you're iterating through the player table and are working
// with row i, pass through playerTable.records[i]
// Call it exactly like this:
// const player = playerTable.records[i];
// const {newOverall, newArchetype} = FranchiseUtils.calculateBestOverall(player);

// Afterwards, you can set the overall/archetype like this:
// playerTable.records[i]['OverallRating;] = newOverall;
// playerTable.records[i]['PlayerType'] = newArchetype;

// If you use this function, you HAVE to include ovrweights/ovrweightsPosMap in your included files when compiling to an exe
function calculateBestOverall(player) {

    const ovrWeights = JSON.parse(fs.readFileSync(path.join(__dirname, 'JsonLookups/ovrweights.json'), 'utf8'));
    const ovrWeightsPosMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'JsonLookups/ovrweightsPosMap.json'), 'utf8'));
    
    let newOverall = 0;
    let newArchetype = "";

    const position = ovrWeightsPosMap[player.Position]; //Get position
    for (const archetype of ovrWeights) { // Iterate to find the highest archetype
        if (archetype.Pos === position) {
            const ovrObj = ovrWeights.find(weight => weight.Archetype == archetype.Archetype);
            let sum = 0;
            const properties = archetype ? Object.keys(archetype).slice(4,55) : null;

            if (properties.length > 0) {
                if (player.fields != null) {
                    for (const attr in player.fields) {
                        if (properties.includes(attr)) {
                            const attrValue = ((player[attr] - ovrObj.DesiredLow) / (ovrObj.DesiredHigh - ovrObj.DesiredLow)) * (ovrObj[attr] / ovrObj.Sum);
                            sum += attrValue;
                        }
                    }
                } else {
                    for (const attr in player) {
                        if (properties.includes(attr)) {
                            const attrValue = ((player[attr] - ovrObj.DesiredLow) / (ovrObj.DesiredHigh - ovrObj.DesiredLow)) * (ovrObj[attr] / ovrObj.Sum);
                            sum += attrValue;
                        }
                    }
                }
            }

            const overall = Math.round(Math.min(sum * 99, 99));

            if (overall > newOverall) {
                newOverall = overall;
                newArchetype = archetype.Archetype;
            }
        }
    }

    // Return the highest overall/archetype
    return { newOverall, newArchetype };
};

async function emptyHistoryTables(franchise, tables) {
    const historyEntryArray = franchise.getTableByUniqueId(tables.historyEntryArray);
    const historyEntry = franchise.getTableByUniqueId(tables.historyEntry);
    const transactionHistoryArray = franchise.getTableByUniqueId(tables.transactionHistoryArray);
    const transactionHistoryEntry = franchise.getTableByUniqueId(tables.transactionHistoryEntry);
    await readTableRecords([historyEntryArray,historyEntry,transactionHistoryArray,transactionHistoryEntry]);
  
    for (let i = 0; i < historyEntryArray.header.recordCapacity;i++) {
        if (!historyEntryArray.records[i].isEmpty) {
            for (let j = 0; j < historyEntryArray.header.numMembers;j++) {
            historyEntryArray.records[i][`HistoryEntry${j}`] = zeroRef;

            }
        }
     }
  
    for (let i = 0; i < transactionHistoryArray.header.recordCapacity;i++) {
        if (!transactionHistoryArray.records[i].isEmpty) {
            for (let j = 0; j < transactionHistoryArray.header.numMembers;j++) {
            transactionHistoryArray.records[i][`TransactionHistoryEntry${j}`] = zeroRef;

            }
        }
     }
  
    for (let i = 0; i < transactionHistoryEntry.header.recordCapacity;i++) {
        if (!transactionHistoryEntry.records[i].isEmpty) {
        const record = transactionHistoryEntry.records[i];
        record.OldTeam = zeroRef;
        record.NewTeam = zeroRef;
        record.SeasonYear = 0;
        record.TransactionId = 0;
        record.SeasonStage = 'PreSeason';
        record.ContractStatus = 'Drafted';
        record.OldContractStatus = 'Drafted';
        record.SeasonWeek = 0;
        record.FifthYearOptionCapHit = 0;
        record.ContractLength = 0;
        record.ContractTotalSalary = 0;
        record.CapSavingsThisYear = 0;
        record.ContractBonus = 0;
        record.ContractSalary = 0;
        await record.empty();
        }
     }
    // I wouldn't recommend using this part - It shouldn't be necessary and has over 65k rows
    /*for (let i = 0; i < historyEntry.header.recordCapacity;i++) {
        if (!historyEntry.records[i].isEmpty) {
            const record = historyEntry.records[i];
            record.Person = zeroRef;
            record.IsSchemeFit = false;
            record.CurrentStage = 'NFLSeason';
            record.LegacyValue = 0;
            record.ExperienceValue = 0;
            record.CurrentYear = 0;
            record.BaseExperience = 0;
            record.BonusExperience = 0;
            record.DynamicDevValue = 0;
            record.ProgressionValue = 0;
            record.MiscValue = 0;
            record.ConfidenceValue = 0;
            record.CurrentWeek = 0;
            record.DynamicDevValue = 0;
            await record.empty();
        }
    }*/
};

// This function will remove a binary value from an array table
// It will iterate through each row and look for the binary. If multiple rows/columns
// contain the target binary, they will all be removed.
// table: The table passed through to remove the binary from
// binaryToRemove: The binary we're removing from the table
async function removeFromTable(table, binaryToRemove) {
    const numMembers = table.header.numMembers;
    const recordCapacity = table.header.recordCapacity;
  
    for (let i = 0; i < recordCapacity; i++) { // Iterate through the table
      let allBinary = []; // This will become all of our binary for the row EXCEPT the binaryToRemove
  
      const currentRecord = table.records[i];
      if (currentRecord.isEmpty) {
        continue; // This almost never gets triggered for array tables
      }
      
      currentRecord.fieldsArray.forEach(field => {
        allBinary.push(field.value)
      })
  
      // Filter out the binaryToRemove from allBinary
      allBinary = allBinary.filter((bin) => bin !== binaryToRemove);
  
      while (allBinary.length < numMembers) {
        allBinary.push(zeroRef);
      }
  
      // Set the new binary for the row
      allBinary.forEach((val, index) => {
        table.records[i].fieldsArray[index].value = val;
      });
    }
  }

async function bin2Dec(binary) {
    return parseInt(binary, 2);
};

function dec2bin(dec) {
    return (dec >>> 0).toString(2);
};

async function hasNumber(myString) {
    return /\d/.test(myString);
};
  


module.exports = {
    selectFranchiseFile,
    selectFranchiseFileAsync,
    saveFranchiseFile,
    getGameYear,
    bin2Dec,
    dec2bin,
    hasNumber,
    readTableRecords,
    calculateBestOverall,
    emptyHistoryTables,
    removeFromTable,
    zeroRef
  };