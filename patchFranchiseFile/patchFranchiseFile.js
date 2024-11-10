const FranchiseUtils = require('../Utils/FranchiseUtils');
const { importTableData } = require('./externalDataService');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');

  
console.log("This program will update your Madden 25 Franchise File to work with Sabo's new Franchise Mod");
console.log("If your franchise file was already started using Sabo's Franchise Mod, this is not necessary unless he's updated the Franchise Mod.");

const gameYear = FranchiseUtils.YEARS.M25;

const franchise = FranchiseUtils.init(gameYear);
const tables = FranchiseUtils.getTablesObject(franchise);

async function importTables(tableToEdit, filePath) {
    // Import data from the specified file path
    const table = await importTableData({ inputFilePath: filePath });

    // Trim table to match the length of `tableToEdit` records
    const trimmedTable = table.slice(0, tableToEdit.records.length);

    // Update records only if values are different
    for (const [index, record] of trimmedTable.entries()) {
    const franchiseRecord = tableToEdit.records[index];
    for (const key in record) {
        if (record[key] !== franchiseRecord[key]) {
            franchiseRecord[key] = record[key];
            }
        }
    }
    return;
}



franchise.on('ready', async function () {
 
    console.log("Now working on patching your file...");

    const tableKeys = {
        salaryInfoTable: 'salaryInfoTable',
        playerSigningEval: 'playerSigningEvalTable',
        teamRoadmapEval: 'teamRoadmapEval',
        practiceEval: 'practiceEvalTable',
        injuryEval: 'injuryEvalTable',
        retirementEval: 'playerRetirementEvalTable',
        teamManagerTable: 'teamManagerTable',
        weeksToUpdateContentionPhaseTable: 'weeksToUpdateContentionPhaseTable',
        tradeEval: 'tradeEval',
        positionCountTable: 'positionCountTable',
        salaryMetricsSplineArray: 'salaryMetricsSplineArray',
        coachRetirementEvalInfoTable: 'coachRetirementEvalInfoTable',
        developmentSpline: 'developmentSpline',
        rosterInfoTable: 'rosterInfoTable',
        progressionXPSlider: 'progressionXPSlider',
        salCapIncreasePerYearTable: 'salCapIncreaseTable',
        autoSubSliderTable: 'autoSubSliderTable',
        schedulerAppointmentTable: 'schedulerAppointmentTable',
        schedulerRelativeApptTable: 'schedulerRelativeApptTable'
      };
      
      // Use destructuring to assign each table variable
      const tablestoRead = Object.fromEntries(
        Object.entries(tableKeys).map(([key, value]) => [key, franchise.getTableByUniqueId(tables[value])])
      );
      
    const {
    salaryInfoTable,
    playerSigningEval,
    teamRoadmapEval,
    practiceEval,
    injuryEval,
    retirementEval,
    teamManagerTable,
    weeksToUpdateContentionPhaseTable,
    tradeEval,
    positionCountTable,
    salaryMetricsSplineArray,
    coachRetirementEvalInfoTable,
    developmentSpline,
    rosterInfoTable,
    progressionXPSlider,
    salCapIncreasePerYearTable,
    autoSubSliderTable,
    schedulerAppointmentTable,
    schedulerRelativeApptTable
    } = tablestoRead;
    
    // Pass the tables to `readTableRecords`
    await FranchiseUtils.readTableRecords(Object.values(tablestoRead));

    const injuryEvalRecord = injuryEval.records[0];
    injuryEvalRecord.EnableReturnNotifications = true;
    injuryEvalRecord.EarlyReturnOvrDifference = 2;

    const retirementEvalRecord = retirementEval.records[0];
    retirementEvalRecord.MaxYearsPro = 20;
    retirementEvalRecord.HighRetirementChanceThreshold = 65;

    const signingEvalRecord = playerSigningEval.records[0];
    signingEvalRecord.UnpredictablePlayerHoldoutChance = 0;
    signingEvalRecord.MaxPlayerNegotiationsPerWeek = 8;
    signingEvalRecord.FranchiseTagTopGradeThreshold = 16;
    signingEvalRecord.NeedSeverityThreshold = 25;

    const practiceEvalRecord = practiceEval.records[0];
    practiceEvalRecord.MaxUnlockableFocusPlayers = 0;
    practiceEvalRecord.MaxFocusTrainingXpAward = 0;
    practiceEvalRecord.BaseMaxFocusPlayers = 0;
    practiceEvalRecord.MinFocusTrainingXpAward = 0;

    salaryInfoTable.records[0].RosterReserveSalary = 0;

    teamManagerTable.records[0].MaxIRRemovalsPerSeason = 3;

    const contentionRecord = weeksToUpdateContentionPhaseTable.records[0];
    contentionRecord.int0 = 5;
    contentionRecord.int1 = 13;


    teamRoadmapEval.records[0].MinimumPlayerGrade = 60;

    const tradeEvalRecord = tradeEval.records[0];
    tradeEvalRecord.MakeOfferAddedValueThreshold = 1;
    tradeEvalRecord.TradeAwayMaxPercentTradeValueThreshold = 94;
    tradeEvalRecord.TradeAwayMinPercentTradeValueThreshold = 89;
    tradeEvalRecord.MaxOfferPackageValuePercent = 110;
    tradeEvalRecord.MinOfferPackageValuePercent = 95;

    coachRetirementEvalInfoTable.records[0].FreeAgentMod = 0;

    const devSplineRecord = developmentSpline.records[0];
    devSplineRecord.int0 = 0;
    devSplineRecord.int1 = 0;
    devSplineRecord.int2 = 0;
    devSplineRecord.int3 = 0;

    const rosterInfoRecord = rosterInfoTable.records[0];
    rosterInfoRecord.MaxFreeAgentsSize = 850;
    rosterInfoRecord.PlayerMaxPracticeSquadYears = 3;

    await importTables(salaryMetricsSplineArray,`SalaryMetricsSplineArray.xlsx`);
    await importTables(autoSubSliderTable,`AutoSubSlider.xlsx`);
    await importTables(progressionXPSlider,'ProgressionXPSlider.xlsx');
    await importTables(positionCountTable,"PositionCountTable.xlsx");

    const endOfSeasonRecord = schedulerAppointmentTable.records.find(record => !record.isEmpty && record.Name === 'End of Season ReSigning');

    if (endOfSeasonRecord) {
        const binary = getBinaryReferenceData(schedulerAppointmentTable.header.tableId, endOfSeasonRecord.index);
        for (let i = 76; i <= 80; i++) {
            const record = schedulerRelativeApptTable.records[i];
            if (!record.isEmpty) record.Appointment = binary;
        }
    }

    const transferSalCapIncrease = FranchiseUtils.getYesOrNo("Would you like to add Sabo's year-by-year Salary Cap increases? Enter yes or no. This is optional but is recommended unless using a retro franchise file where you've been instructed not to.");
    if (transferSalCapIncrease) {
        await importTables(salCapIncreasePerYearTable,`SalaryCapIncreases.xlsx`);
    }

    console.log("Successfully updated your file.");

    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
    
});



