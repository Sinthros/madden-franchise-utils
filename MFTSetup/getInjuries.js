



const FranchiseUtils = require('../Utils/FranchiseUtils');
const COLS_TO_KEEP = ["ShortName", "LongName", "Value"];

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

franchise.on('ready', async function () {
    const injuryTable = franchise.getTableByUniqueId(2893390316);
    await FranchiseUtils.readTableRecords([injuryTable]);
    const options = {includeRow: true, includeAssetId: false, includeBinary: false, columnsToReturn: COLS_TO_KEEP};
    const injuryArray = await FranchiseUtils.getTableDataAsArray(franchise, injuryTable, options);
    FranchiseUtils.convertArrayToJSONFile(injuryArray, 'injuries.json');    
});