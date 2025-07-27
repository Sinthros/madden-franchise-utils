const FranchiseUtils = require('../Utils/FranchiseUtils');

const COLS_TO_KEEP = ["ShortName", "LongName", "Value"];
const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

franchise.on('ready', async function () {
    const attributeTable = franchise.getTableByUniqueId(337885249);
    await FranchiseUtils.readTableRecords([attributeTable]);

    const options = {
        includeRow: false,
        includeBinary: false,
        includeAssetId: false,
        columnsToReturn: COLS_TO_KEEP
    };

    let attributeArray = await FranchiseUtils.getTableDataAsArray(franchise, attributeTable, options);

    // Add DefaultValue before Value
    attributeArray = attributeArray.map(row => ({
        ShortName: row.ShortName,
        LongName: row.LongName,
        DefaultValue: row.Value,
        Value: `${row.Value}Rating`
    }));

    FranchiseUtils.convertArrayToJSONFile(attributeArray, 'attributes.json');
});
