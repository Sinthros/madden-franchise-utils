const FranchiseUtils = require('../Utils/FranchiseUtils');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');

  
console.log("This program will update your Madden 26 Franchise File to work with Sabo's new Franchise Mod or Sinthros's new Start Today mod");
console.log("If your franchise file was already started using one of these mods, this program is not necessary unless directed otherwise.");

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
        schedulerRelativeApptTable: 'schedulerRelativeApptTable',
        cutDayStartEventTable: 'cutDayStartEventTable',
        cutDayStartReactionTable: 'cutDayStartReactionTable',
        seasonInfoTable: 'seasonInfoTable'
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
    schedulerRelativeApptTable,
    cutDayStartEventTable,
    cutDayStartReactionTable,
    seasonInfoTable
    } = tablestoRead;
    const cutDayTable = franchise.getTableByName("CutDay_CutListRequest");
    await cutDayTable.readRecords();
    
    // Pass the tables to `readTableRecords`
    await FranchiseUtils.readTableRecords(Object.values(tablestoRead));

    // Current stage of the file (preseason, nfl season, or offseason)
    const currentStage = seasonInfoTable.records[0].CurrentStage;

    // Always set these to 0 to be safe. This makes sure that in the next
    // preseason, it goes back to 53 man rosters at the end
    cutDayStartEventTable.records[0].MaxRosterSize = 0;
    cutDayStartReactionTable.records[0].MaxRosterSize = 0;

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

    // Fix an issue with some ST files
    if (currentStage === FranchiseUtils.SEASON_STAGES.NFL_SEASON) {
        rosterInfoRecord.EndOfWeekMaxRosterSize = 0;
        rosterInfoRecord.MaxRosterSize = 0;
    }

    await importTables(salaryMetricsSplineArray,`SalaryMetricsSplineArray.xlsx`);
    await importTables(autoSubSliderTable,`AutoSubSlider.xlsx`);
    await importTables(progressionXPSlider,'ProgressionXPSlider.xlsx');
    await importTables(positionCountTable,"PositionCountTable.xlsx");

    const staffHiringOffersRecord = schedulerAppointmentTable.records.find(record => !record.isEmpty && record.Name === 'Staff Hiring Offers');

    const staffWeekRecord = schedulerAppointmentTable.records.find(record => !record.isEmpty && record.Name === 'Staff Week');

    if (staffHiringOffersRecord && staffWeekRecord) {
        staffHiringOffersRecord.Start = staffWeekRecord.Start;
        staffHiringOffersRecord.StartOccurrenceTime = staffWeekRecord.StartOccurrenceTime;

        staffWeekRecord.End = staffWeekRecord.Start;
    }
    else {
        console.log("Unable to update Staff Hiring Offer period. This should not happen. Send your file to Sinthros.");
    }

    const endOfSeasonRecord = schedulerAppointmentTable.records.find(record => !record.isEmpty && record.Name === 'End of Season ReSigning');

    if (endOfSeasonRecord) {
        const binary = getBinaryReferenceData(schedulerAppointmentTable.header.tableId, endOfSeasonRecord.index);
        for (let i = 76; i <= 80; i++) {
            const record = schedulerRelativeApptTable.records[i];
            if (!record.isEmpty) record.Appointment = binary;
        }
    }

    const transferSalCapIncrease = FranchiseUtils.getYesOrNo("Would you like to add Sabo's year-by-year Salary Cap increases? Enter yes or no. You should enter yes unless specifically instructed otherwise.");
    if (transferSalCapIncrease) {
        await importTables(salCapIncreasePerYearTable,`SalaryCapIncreases.xlsx`);
    }

    for (const record of cutDayTable.records) {
        if (!record.isEmpty) continue;
        record.DefaultResponse = FranchiseUtils.ZERO_REF;
        record.TeamRoster = FranchiseUtils.ZERO_REF;
        record.TeamRef = FranchiseUtils.ZERO_REF;
        record.DelegateResponse = FranchiseUtils.ZERO_REF;
        record.CutPlayerResponse = FranchiseUtils.ZERO_REF;
        record.CutDayEvalRef = FranchiseUtils.ZERO_REF;
        record.TargetUser = FranchiseUtils.ZERO_REF;
        record.Commands = FranchiseUtils.ZERO_REF;
        record.Priority = 0;
        record.ResolveTime = 0;
        record.DesiredRosterSize = 0;
        record.SeenByUser = false;
        record.IsSubmittable = false;
        record.CanSubmitResponse = false;


    }

    console.log("Successfully updated your file.");

    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
    
});



