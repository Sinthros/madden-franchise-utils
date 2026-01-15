const FranchiseUtils = require("../Utils/FranchiseUtils");

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-tuning-binary.FTC file
const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });
const tables = FranchiseUtils.getTablesObject(franchise);

/**
 * Flattens grouped lookup tables (Talents, TalentTiers, StaffGoals)
 */
function flattenArray(sections) {
  const flattened = new Map();

  for (const [section, records] of Object.entries(sections)) {
    if (!Array.isArray(records)) continue;

    for (const record of records) {
      if (!record?.Binary) continue;

      flattened.set(record.Binary, {
        ...record,
        Source: section,
      });
    }
  }

  return flattened;
}

/**
 * Converts TalentInfoArray / TalentTierInfoArray into minimal regeneration JSON:
 * {
 *   Binary,
 *   TalentInfo | TalentTiers: [binary, binary, ...]
 * }
 */
function getMinimalBinaryArray(dataArray, prefix, outputKey) {
  return dataArray.map((entry) => {
    const binaries = Object.entries(entry)
      .filter(([key, val]) => key.startsWith(prefix) && val !== FranchiseUtils.ZERO_REF)
      .sort((a, b) => {
        const ai = parseInt(a[0].slice(prefix.length), 10);
        const bi = parseInt(b[0].slice(prefix.length), 10);
        return ai - bi;
      })
      .map(([, val]) => val);

    return {
      Binary: entry.Binary,
      [outputKey]: binaries,
    };
  });
}

franchise.on("ready", async function () {
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
  const staffStatGameBasedCumulativeGoalFtcTable = franchise.getTableByUniqueId(
    tables.staffStatGameBasedCumulativeGoalFtcTable
  );
  const staffDynamicGoalFtcTable = franchise.getTableByUniqueId(tables.staffDynamicGoalFtcTable);

  await FranchiseUtils.readTableRecords([
    staffArchetypeFtcTable,
    talentInfoArrayFtcTable,
    gamedayTalentInfoFtcTable,
    seasonTalentInfoFtcTable,
    wearAndTearTalentInfoFtcTable,
    talentTierInfoArrayFtcTable,
    playsheetTalentTierInfoFtcTable,
    talentTierInfoFtcTable,
    wearAndTearTalentTierInfoFtcTable,
    talentDisplayStatFtcTable,
    staffStatGoalFtcTable,
    staffStatGameBasedCumulativeGoalFtcTable,
    staffDynamicGoalFtcTable,
  ]);

  const options = { includeRow: false, includeAssetId: false, loadReferenceCols: true };

  const staffArchetype = await FranchiseUtils.getTableDataAsArray(franchise, staffArchetypeFtcTable, options);
  const talentInfoArray = await FranchiseUtils.getTableDataAsArray(franchise, talentInfoArrayFtcTable, options);
  const talentTierInfoArray = await FranchiseUtils.getTableDataAsArray(franchise, talentTierInfoArrayFtcTable, options);

  const gamedayTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, gamedayTalentInfoFtcTable, options);
  const seasonTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, seasonTalentInfoFtcTable, options);
  const wearAndTearTalentInfo = await FranchiseUtils.getTableDataAsArray(
    franchise,
    wearAndTearTalentInfoFtcTable,
    options
  );
  const playsheetTalentInfo = await FranchiseUtils.getTableDataAsArray(franchise, playsheetTalentInfoFtcTable, options);

  const talentTierInfo = await FranchiseUtils.getTableDataAsArray(franchise, talentTierInfoFtcTable, options);
  const playsheetTalentTierInfo = await FranchiseUtils.getTableDataAsArray(
    franchise,
    playsheetTalentTierInfoFtcTable,
    options
  );
  const wearAndTearTalentTierInfo = await FranchiseUtils.getTableDataAsArray(
    franchise,
    wearAndTearTalentTierInfoFtcTable,
    options
  );

  const talentDisplayStat = await FranchiseUtils.getTableDataAsArray(franchise, talentDisplayStatFtcTable, options);

  const staffStatGoal = await FranchiseUtils.getTableDataAsArray(franchise, staffStatGoalFtcTable, options);
  const staffStatGameBasedCumulativeGoal = await FranchiseUtils.getTableDataAsArray(
    franchise,
    staffStatGameBasedCumulativeGoalFtcTable,
    options
  );
  const staffDynamicGoal = await FranchiseUtils.getTableDataAsArray(franchise, staffDynamicGoalFtcTable, options);

  // 🔹 Minimal regeneration arrays
  const minimalTalentInfoArray = getMinimalBinaryArray(talentInfoArray, "TalentInfo", "TalentInfo");

  const minimalTalentTiersArray = getMinimalBinaryArray(talentTierInfoArray, "TalentTierInfo", "TalentTiers");

  // 🔹 Flattened lookups
  const flattenedTalents = flattenArray({
    GamedayTalentInfo: gamedayTalentInfo,
    PlaysheetTalentInfo: playsheetTalentInfo,
    SeasonTalentInfo: seasonTalentInfo,
    WearAndTearTalentInfo: wearAndTearTalentInfo,
  });

  const flattenedTalentTiers = flattenArray({
    TalentTierInfo: talentTierInfo,
    PlaysheetTalentTierInfo: playsheetTalentTierInfo,
    WearAndTearTalentTierInfo: wearAndTearTalentTierInfo,
  });

  const flattenedStaffGoals = flattenArray({
    StaffStatGoal: staffStatGoal,
    StaffStatGameBasedCumulativeGoal: staffStatGameBasedCumulativeGoal,
    StaffDynamicGoal: staffDynamicGoal,
  });

  // 🔹 Write JSONs
  FranchiseUtils.convertArrayToJSONFile(staffArchetype, "StaffArchetype.json");
  FranchiseUtils.convertArrayToJSONFile(talentDisplayStat, "TalentDisplayStat.json");
  FranchiseUtils.convertArrayToJSONFile(Array.from(flattenedTalents.values()), "Talents.json");
  FranchiseUtils.convertArrayToJSONFile(Array.from(flattenedTalentTiers.values()), "TalentTiers.json");
  FranchiseUtils.convertArrayToJSONFile(Array.from(flattenedStaffGoals.values()), "StaffGoals.json");
  FranchiseUtils.convertArrayToJSONFile(minimalTalentTiersArray, "TalentTiersArray.json");
  FranchiseUtils.convertArrayToJSONFile(minimalTalentInfoArray, "TalentInfoArray.json");
});
