const FranchiseUtils = require('../Utils/FranchiseUtils');

const COLS_TO_KEEP = ["ShortName", "LongName", "Value"];
const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

franchise.on('ready', async function () {
    const attributeTable = franchise.getTableByUniqueId(1612938518);
    await FranchiseUtils.readTableRecords([attributeTable]);
    const cols = FranchiseUtils.getColumnNames(attributeTable);
    for (const col of cols) {
        if (col.startsWith("PT_")) {
            console.log(col);
        }
    }
});
