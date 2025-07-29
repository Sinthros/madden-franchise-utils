



const FranchiseUtils = require('../Utils/FranchiseUtils');

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

franchise.on('ready', async function () {
    const uiFormTable = franchise.getTableByUniqueId(3972321860);
    await FranchiseUtils.readTableRecords([uiFormTable]);
    const uiArray = await FranchiseUtils.getTableDataAsArray(franchise, uiFormTable);
    FranchiseUtils.convertArrayToJSONFile(uiArray, 'uiSelectForm.json');    
});