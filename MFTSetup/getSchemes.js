



const FranchiseUtils = require('../Utils/FranchiseUtils');
const FINAL_COLUMNS = ['AssetId', 'ShortName', 'LongName', 'Description', 'Value', 'Base']; // keys to keep in order

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

franchise.on('ready', async function () {
    const schemeTable = franchise.getTableByUniqueId(518361666);
    const schemeEnum = franchise.getTableByUniqueId(263074302);
    await FranchiseUtils.readTableRecords([schemeTable, schemeEnum]);
    const options = { includeRow: false, includeBinary: false };
    const schemeArray = await FranchiseUtils.getTableDataAsArray(franchise, schemeTable, options);

    for (const scheme of schemeArray) {
        const schemeValue = scheme.Value;
        const enumRecord = schemeEnum.records.find(rec => schemeValue === rec.Value);
        if (enumRecord) {
            scheme.ShortName = enumRecord.ShortName;
            scheme.LongName = enumRecord.LongName;

            if (scheme.DepthChartDefensivePhilosophy !== FranchiseUtils.ZERO_REF) {
                scheme.Base = schemeValue.includes("3_4") ? "3-4" : "4-3";
            }
        }
    }

    const filteredArray = schemeArray.map(obj => {
        const newObj = {};
        for (const key of FINAL_COLUMNS) {
            if (key in obj) {
                newObj[key] = obj[key];
            }
        }
        return newObj;
    });

    // Split into offensive and defensive
    const defensiveSchemes = filteredArray.filter(obj => 'Base' in obj);
    const offensiveSchemes = filteredArray.filter(obj => !('Base' in obj));

    FranchiseUtils.convertArrayToJSONFile(defensiveSchemes, 'defensiveSchemes.json');
    FranchiseUtils.convertArrayToJSONFile(offensiveSchemes, 'offensiveSchemes.json');

});
