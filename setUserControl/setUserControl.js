const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');

const gameYear = FranchiseUtils.YEARS.M24;
const autoUnempty = true;

console.log("This program will set all teams to be user controlled, or all teams except for the owner of the league to be CPU controlled.");

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);

franchise.on('ready', async function () {
  
  const takeControl = FranchiseUtils.getYesOrNo(`Would you like to take control of all teams? Enter ${FranchiseUtils.YES_KWD} to set all teams to USER, or ${FranchiseUtils.NO_KWD} to set all teams to CPU.`);

  FranchiseUtils.validateGameYears(franchise,gameYear);
  
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const franchiseUserTable = franchise.getTableByUniqueId(tables.franchiseUserTable);
  await FranchiseUtils.readTableRecords([teamTable,franchiseUserTable]);

  for (const teamRecord of teamTable.records) {
    if (teamRecord.isEmpty || !teamRecord.TEAM_VISIBLE || teamRecord.TeamIndex === 32) {
      continue;
    }
  
    if (takeControl) {
      await FranchiseUtils.takeControl(teamRecord.index, franchise, 'None', FranchiseUtils.USER_CONTROL_SETTINGS, false);
    } else {
      const teamBinary = getBinaryReferenceData(teamTable.header.tableId, teamRecord.index);
      const currTeamRecord = franchiseUserTable.records.find(record => record.Team === teamBinary);
  
      if (currTeamRecord && currTeamRecord.AdminLevel === 'Owner') {
        continue;
      }
  
      await FranchiseUtils.removeControl(teamRecord.TeamIndex, franchise);
    }
  }

  const userCPUString = takeControl ? "user" : "CPU";
  console.log(`Successfully set all teams to be ${userCPUString} controlled.`)
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



