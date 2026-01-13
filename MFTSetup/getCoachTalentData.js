



const FranchiseUtils = require('../Utils/FranchiseUtils');

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-tuning-binary.FTC file 
const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);

function filterNonZeroRefEntries(dataArray, prefix, minimumCount = 4) {
  const filtered = [];

  for (const entry of dataArray) {
    const filteredEntry = { Binary: entry.Binary };
    let hasNonZero = false;

    for (const key in entry) {
      if (key.startsWith(prefix) && key !== 'Binary') {
        const val = entry[key];
        if (val !== FranchiseUtils.ZERO_REF) {
          filteredEntry[key] = val;
          hasNonZero = true;
        }
      }
    }

    if (hasNonZero) {
      filtered.push(filteredEntry);
    }
  }

  //console.log(filtered)
  // If nothing made it through, add 1 fallback entry with 4 zeroRef fields
  if (filtered.length === 0) {
    const fallback = { Binary: FranchiseUtils.ZERO_REF };
    for (let i = 0; i < minimumCount; i++) {
      fallback[`${prefix}${i}`] = FranchiseUtils.ZERO_REF;
    }
    filtered.push(fallback);
  }

  return filtered;
}


franchise.on('ready', async function () {
    const staffArchetypeFtcTable = franchise.getTableByUniqueId(tables.staffArchetypeFtcTable);
    const talentInfoArrayFtcTable = franchise.getTableByUniqueId(tables.talentInfoArrayFtcTable);
    const gamedayTalentInfoFtcTable = franchise.getTableByUniqueId(tables.gamedayTalentInfoFtcTable);
    const seasonTalentInfoFtcTable = franchise.getTableByUniqueId(tables.seasonTalentInfoFtcTable);
    const wearAndTearTalentInfoFtcTable = franchise.getTableByUniqueId(tables.wearAndTearTalentInfoFtcTable);
    const playsheetTalentInfoFtcTable = franchise.getTableByUniqueId(tables.playsheetTalentInfoFtcTable);
    const talentTierInfoArrayFtcTable = franchise.getTableByUniqueId(tables.talentTierInfoArrayFtcTable);
    const playsheetTalentTierInfoFtcTable = franchise.getTableByUniqueId(tables.playsheetTalentTierInfoFtcTable);
    const talentTierInfoFtcTable = franchise.getTableByUniqueId(tables.talentTierInfoFtcTable);
    const wearAndTearTalentTierInfoFtcTable = franchise.getTableByUniqueId(tables.wearAndTearTalentTierInfoFtcTable);
    const talentDisplayStatFtcTable = franchise.getTableByUniqueId(tables.talentDisplayStatFtcTable);
    const staffStatGoalFtcTable = franchise.getTableByUniqueId(tables.staffStatGoalFtcTable);
    const staffStatGameBasedCumulativeGoalFtcTable = franchise.getTableByUniqueId(tables.staffStatGameBasedCumulativeGoalFtcTable);
    const staffDynamicGoalFtcTable = franchise.getTableByUniqueId(tables.staffDynamicGoalFtcTable);

    await FranchiseUtils.readTableRecords([staffArchetypeFtcTable, talentInfoArrayFtcTable, gamedayTalentInfoFtcTable, seasonTalentInfoFtcTable, wearAndTearTalentInfoFtcTable,
        talentTierInfoArrayFtcTable, playsheetTalentTierInfoFtcTable, talentTierInfoFtcTable,
        wearAndTearTalentTierInfoFtcTable, talentDisplayStatFtcTable, staffStatGoalFtcTable, staffStatGameBasedCumulativeGoalFtcTable, staffDynamicGoalFtcTable
    ]);

    const options = { includeRow: false, includeAssetId: false, loadReferenceCols: true };

    const staffArchetype = await FranchiseUtils.getTableDataAsArray(franchise, staffArchetypeFtcTable, options);
    const talentInfoArray = await FranchiseUtils.getTableDataAsArray(franchise, talentInfoArrayFtcTable, options);
    const gamedayTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, gamedayTalentInfoFtcTable, options);
    const seasonTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, seasonTalentInfoFtcTable, options);
    const wearAndTearTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, wearAndTearTalentInfoFtcTable, options);
    const playsheetTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, playsheetTalentInfoFtcTable, options);
    const talentTierInfoArray = await FranchiseUtils.getTableDataAsArray(franchise, talentTierInfoArrayFtcTable, options);
    const talentTierInfo = await FranchiseUtils.getTableDataAsArray(franchise, talentTierInfoFtcTable, options);
    const playsheetTalentTierInfo = await FranchiseUtils.getTableDataAsArray(franchise, playsheetTalentTierInfoFtcTable, options);
    const wearAndTearTalentTierInfo = await FranchiseUtils.getTableDataAsArray(franchise, wearAndTearTalentTierInfoFtcTable, options);
    const talentDisplayStat = await FranchiseUtils.getTableDataAsArray(franchise, talentDisplayStatFtcTable, options);
    const staffStatGoal = await FranchiseUtils.getTableDataAsArray(franchise, staffStatGoalFtcTable, options);
    const staffStatGameBasedCumulativeGoal = await FranchiseUtils.getTableDataAsArray(franchise, staffStatGameBasedCumulativeGoalFtcTable, options);
    const staffDynamicGoal = await FranchiseUtils.getTableDataAsArray(franchise, staffDynamicGoalFtcTable, options);

    const filteredTalentTierInfoArray = filterNonZeroRefEntries(talentTierInfoArray, 'TalentTierInfo');
    const filteredTalentInfoArray = filterNonZeroRefEntries(talentInfoArray, 'TalentInfo');

    const talents = {
        GamedayTalentInfo: gamedayTalentInfo,
        PlaysheetTalentInfo: playsheetTalentInfo,
        SeasonTalentInfo: seasonTalentInfo,
        WearAndTearTalentInfo: wearAndTearTalentInfo,
        TalentInfoArray: filteredTalentInfoArray
    };
    const talentTiers = {
        TalentTierInfo: talentTierInfo,
        PlaysheetTalentTierInfo: playsheetTalentTierInfo,
        WearAndTearTalentTierInfo: wearAndTearTalentTierInfo,
        TalentTierInfoArray: filteredTalentTierInfoArray,
    };
    const staffGoals = {
        StaffStatGoal: staffStatGoal,
        StaffStatGameBasedCumulativeGoal: staffStatGameBasedCumulativeGoal,
        StaffDynamicGoal: staffDynamicGoal
    };
    FranchiseUtils.convertArrayToJSONFile(staffArchetype, 'StaffArchetype.json');
    FranchiseUtils.convertArrayToJSONFile(talentDisplayStat, 'TalentDisplayStat.json');
    FranchiseUtils.convertArrayToJSONFile(talents, 'Talents.json');
    FranchiseUtils.convertArrayToJSONFile(talentTiers, 'TalentTiers.json');
    FranchiseUtils.convertArrayToJSONFile(staffGoals, 'StaffGoals.json');
});