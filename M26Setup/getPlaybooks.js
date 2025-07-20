



const FranchiseUtils = require('../Utils/FranchiseUtils');
const fs = require('fs');
const COLS_TO_KEEP = ["ShortName", "Value"]

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

async function convertArrayToJSONFile(dataArray, filePath) {
    const jsonData = JSON.stringify(dataArray, null, 2); // Convert array to JSON string with indentation
  
    fs.writeFileSync(filePath, jsonData, (error) => {
      if (error) {
        console.error('Error writing JSON file:', error);
      } else {
        console.log('JSON file created successfully!');
      }
    });
  };

franchise.on('ready', async function () {
    const offPlaybookEnum = franchise.getTableByUniqueId(3087327350);
    const defPlaybookEnum = franchise.getTableByUniqueId(159369245);
    await FranchiseUtils.readTableRecords([offPlaybookEnum, defPlaybookEnum]);
    const options = {columnsToReturn: COLS_TO_KEEP, includeRow: false, includeBinary: false};
    const offJsonArray = await FranchiseUtils.getTableDataAsArray(franchise, offPlaybookEnum, options);
    const defJsonArray = await FranchiseUtils.getTableDataAsArray(franchise, defPlaybookEnum, options);
    await convertArrayToJSONFile(offJsonArray,'offensive_playbooks.json');
    await convertArrayToJSONFile(defJsonArray,'defensive_playbooks.json');
    
    
});