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
    zeroRef
  };