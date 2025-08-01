const FranchiseUtils = require('../Utils/FranchiseUtils');
const FINAL_COLUMNS_AWARD = ["Row", "teamIdentity", "lastName", "firstName", "Position"];

const gameYear = FranchiseUtils.YEARS.M26;
const ftcFranchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

ftcFranchise.on('ready', async function () {
    const awardTable = ftcFranchise.getTableByUniqueId(2234062019);
    const yearSummaryTable = ftcFranchise.getTableByUniqueId(2508954027);
    await FranchiseUtils.readTableRecords([awardTable, yearSummaryTable]);

    const options = { includeRow: true, includeAssetId: false, includeBinary: false };
    const awardArray = await FranchiseUtils.getTableDataAsArray(ftcFranchise, awardTable, options);

    for (const award of awardArray) {
        const teamIdentity = award.teamIdentity;
        award.teamIdentity = (teamIdentity === FranchiseUtils.ZERO_REF)
            ? -1
            : FranchiseUtils.getRowFromRef(teamIdentity);
    }

    const filteredArray = awardArray.map(obj => {
        const newObj = {};
        for (const key of FINAL_COLUMNS_AWARD) {
            if (key in obj) newObj[key] = obj[key];
        }
        return newObj;
    });

    const yearSummaryRecords = yearSummaryTable.records.map(record => ({
        SB_MVP: FranchiseUtils.getRowFromRef(record.SB_MVP),
        OffensiveROTY: FranchiseUtils.getRowFromRef(record.OffensiveROTY),
        OffensivePOTY: FranchiseUtils.getRowFromRef(record.OffensivePOTY),
        NFL_MVP: FranchiseUtils.getRowFromRef(record.NFL_MVP),
        NFCTeamIdentity: FranchiseUtils.getRowFromRef(record.NFCTeamIdentity),
        DefensiveROTY: FranchiseUtils.getRowFromRef(record.DefensiveROTY),
        DefensivePOTY: FranchiseUtils.getRowFromRef(record.DefensivePOTY),
        CoachOfTheYear: FranchiseUtils.getRowFromRef(record.CoachOfTheYear),
        AFCTeamIdentity: FranchiseUtils.getRowFromRef(record.AFCTeamIdentity),
        NFC_CityName: record.NFC_CityName,
        AFC_CityName: record.AFC_CityName,
        NFC_SB_Score: record.NFC_SB_Score,
        AFC_TeamLogo: record.AFC_TeamLogo,
        NFC_TeamLogo: record.NFC_TeamLogo,
        AFC_SB_Wins: record.AFC_SB_Wins,
        NFC_ConfChamp_Wins: record.NFC_ConfChamp_Wins,
        NFC_SB_Wins: record.NFC_SB_Wins,
        PeriodIndex: record.PeriodIndex,
        AFC_ConfChamp_Wins: record.AFC_ConfChamp_Wins,
        AFC_SB_Score: record.AFC_SB_Score
    }));

    FranchiseUtils.convertArrayToJSONFile(filteredArray, 'LeaguePastAwards.json');
    FranchiseUtils.convertArrayToJSONFile(yearSummaryRecords, 'LeaguePastHistory.json');
});
