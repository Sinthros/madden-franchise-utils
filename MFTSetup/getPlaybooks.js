const FranchiseUtils = require('../Utils/FranchiseUtils');
const COLS_TO_KEEP = ["Value"];

const gameYear = FranchiseUtils.YEARS.M26;

const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

franchise.on('ready', async function () {
    const offPlaybookEnum = franchise.getTableByUniqueId(4101039502);
    const defPlaybookEnum = franchise.getTableByUniqueId(724650794);

    await FranchiseUtils.readTableRecords([offPlaybookEnum, defPlaybookEnum]);
    const options = { columnsToReturn: COLS_TO_KEEP, includeRow: false, includeBinary: true };

    const offJsonArray = await FranchiseUtils.getTableDataAsArray(franchise, offPlaybookEnum, options);
    const defJsonArray = await FranchiseUtils.getTableDataAsArray(franchise, defPlaybookEnum, options);

    // Add ShortName before Value
    const addShortNames = (arr) => {
        return arr.map(item => {
            const value = item.Value || "";
            const shortName = value
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // handle acronyms
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .trim();

            // build object with explicit order: AssetID → ShortName → Value
            const result = {};
            if (item.AssetId !== undefined) result.AssetId = item.AssetId;
            result.ShortName = shortName;
            result.Value = value;
            //result.Binary = item.Binary;
            return result;
        });
    };

    const offWithShortNames = addShortNames(offJsonArray);
    const defWithShortNames = addShortNames(defJsonArray);

    FranchiseUtils.convertArrayToJSONFile(offWithShortNames, 'offensive_playbooks.json');
    FranchiseUtils.convertArrayToJSONFile(defWithShortNames, 'defensive_playbooks.json');
});
