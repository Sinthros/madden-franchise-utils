



const FranchiseUtils = require('../Utils/FranchiseUtils');

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

franchise.on('ready', async function () {
    const collegeTable = franchise.getTableByUniqueId(131382980);
    await FranchiseUtils.readTableRecords([collegeTable]);
    const options = {includeRow: false, includeBinary: false};
    const collegeArray = await FranchiseUtils.getTableDataAsArray(franchise, collegeTable, options);
    FranchiseUtils.convertArrayToJSONFile(collegeArray, 'colleges.json');    
});