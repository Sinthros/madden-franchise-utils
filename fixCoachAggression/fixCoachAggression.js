const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const COLUMNS_TO_ITERATE = [
  'COACH_DL', 'COACH_LB', 'COACH_WR', 'COACH_K', 'COACH_OFFENSE', 'COACH_DEFTENDENCYRUNPASS',
  'COACH_S', 'COACH_DB', 'COACH_DEFTENDENCYAGGRESSCONSERV', 'COACH_QB', 'COACH_RB', 'COACH_RBTENDENCY',
  'COACH_P', 'COACH_DEFENSE', 'COACH_DEFENSETYPE', 'COACH_OFFTENDENCYAGGRESSCONSERV', 'COACH_OFFTENDENCYRUNPASS',
  'COACH_OL'
];

const DEFAULT_VALUE = 50;


console.log("This program will set playcalling/aggressiveness columns for coaches to 50 if they're currently set to 0.");
const gameYear = 24;
const autoUnempty = false;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);


franchise.on('ready', async function () {

  const coachTable = franchise.getTableByUniqueId(tables.coachTable);
  await coachTable.readRecords();

  for (let i = 0; i < coachTable.header.recordCapacity; i++) {
    const record = coachTable.records[i];

    if (record.isEmpty) {
      continue;
    }

    for (const column of COLUMNS_TO_ITERATE) {
      if (record[column] === 0) { // If 0, set to 50
        record[column] = DEFAULT_VALUE;
      }
    }
  }
  
  console.log("Successfully updated coach values.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



