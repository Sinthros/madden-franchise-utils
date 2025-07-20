



const FranchiseUtils = require('../Utils/FranchiseUtils');
const COLS_TO_KEEP = ["ShortName", "Value"]

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

franchise.on('ready', async function () {
    const offPlaybookEnum = franchise.getTableByUniqueId(3087327350);
    const defPlaybookEnum = franchise.getTableByUniqueId(159369245);
    await FranchiseUtils.readTableRecords([offPlaybookEnum, defPlaybookEnum]);
    const options = {columnsToReturn: COLS_TO_KEEP, includeRow: false, includeBinary: false};
    const offJsonArray = await FranchiseUtils.getTableDataAsArray(franchise, offPlaybookEnum, options);
    const defJsonArray = await FranchiseUtils.getTableDataAsArray(franchise, defPlaybookEnum, options);
    FranchiseUtils.convertArrayToJSONFile(offJsonArray,'offensive_playbooks.json');
    FranchiseUtils.convertArrayToJSONFile(defJsonArray,'defensive_playbooks.json');
    
    
});