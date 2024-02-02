const Franchise = require('madden-franchise');
const path = require('path');
const os = require('os');
const fs = require('fs');
const prompt = require('prompt-sync')();

function selectFranchiseFile(gameYear) {
  const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
  const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
  let default_path = documentsDir; // Set to default dir first
  let franchise;
  
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
          
          if (fileName.startsWith("CAREER-")) {
              franchise = new Franchise(path.join(default_path, fileName));
          } else {
              franchise = new Franchise(fileName.replace(new RegExp('/', 'g'), '\\'));
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
            console.log("Franchise file successfully saved! Enter anything to exit.");
            break;
        } else if (finalPrompt.toUpperCase() === 'NO') {
            console.log("Exiting program without saving your changes. Enter anything to exit.");
            break;
        } else {
            console.log("Invalid input. Please enter 'yes' to save or 'no' to quit without saving.");
        }
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
}

async function bin2Dec(binary) {
    return parseInt(binary, 2);
  };

function dec2bin(dec) {
    return (dec >>> 0).toString(2);
};
  


module.exports = {
    selectFranchiseFile,
    saveFranchiseFile,
    getGameYear,
    bin2Dec,
    dec2bin
  };