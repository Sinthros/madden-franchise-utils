



const FranchiseUtils = require('../Utils/FranchiseUtils');

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    for (const [name, tableId] of Object.entries(tables)) {
        const table = franchise.getTableByUniqueId(tableId);
        if (table === undefined) {
           console.log(name) 
        }
    }
});