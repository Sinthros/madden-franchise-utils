const FranchiseUtils = require('../Utils/FranchiseUtils');
const POSITIONS = ['RE','LE','ROLB','LOLB'];
const MIN_ZONE_CVG_VAL = 31;
const MAX_WEIGHT = 285

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program fixes an issue in the Start Today franchise file where some players like George Karlaftis aren't properly set to RRE/RLE on the depth chart.");
console.log("For some reason, this is because his Zone Coverage is < 31. This program will set all RE/LE/ROLB/LOLB players to 31 Zone Coverage if they're below that amount currently and under 285 pounds.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await FranchiseUtils.readTableRecords([playerTable]);

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    const record = playerTable.records[i];

    if (FranchiseUtils.isValidPlayer(record) && POSITIONS.includes(record.Position) && record.ZoneCoverageRating < MIN_ZONE_CVG_VAL && record.Weight + 160 < MAX_WEIGHT) {
      record.ZoneCoverageRating = MIN_ZONE_CVG_VAL;
    }
  }

  console.log("Successfully set zone coverage values for valid players.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



