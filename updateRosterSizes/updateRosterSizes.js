const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');

const invalidTeams = ['AFC','NFC'];
const invalidStatuses = ['Draft','Retired','Deleted','None','Created','PracticeSquad'];
const validGameYears = ['22','23','24'];

console.log("This program will calculate all roster sizes for all teams.")
const gameYear = FranchiseUtils.getGameYear(validGameYears);
const autoUnempty = false;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);

async function setRosterSizes(playerTable,teamTable) {

  for (let i = 0;i<teamTable.header.recordCapacity;i++) {
    let activeRosterSize = 0; // Current active players
    let salCapRosterSize = 0; // Total rostered players (does NOT include Practice Squad guys)
    let salCapNextYearRosterSize = 0; // Guys slated to be rostered next season

    if (teamTable.records[i].isEmpty || invalidTeams.includes(teamTable.records[i]['DisplayName'])) { // If an empty row, continue
      continue;
    }
    const currentTeamIndex = teamTable.records[i]['TeamIndex']
    for (let j = 0;j<playerTable.header.recordCapacity;j++) {
      if (playerTable.records[j].isEmpty || invalidStatuses.includes(playerTable.records[j]['ContractStatus']) || playerTable.records[j]['TeamIndex'] === '32') { // If an empty row/invalid, continue
        continue;
      }
      const playerTeamIndex = playerTable.records[j]['TeamIndex'];
      const isOnIR = playerTable.records[j]['IsInjuredReserve'];
      const contractLength = playerTable.records[j]['ContractLength'];
      if (playerTeamIndex === currentTeamIndex) { // If we have a match, always increment salCapRosterSize
        salCapRosterSize++;
        if (!isOnIR) { // If not on IR, increment activeRosterSize
          activeRosterSize++;
        }

        if (contractLength > 1) { // If contract greater than 1 year, increment salCapNextYearRosterSize
          salCapNextYearRosterSize++;
        }
      }
    }

    //Finally, set the roster sizes for the current team
    teamTable.records[i]['ActiveRosterSize'] = activeRosterSize;
    teamTable.records[i]['SalCapRosterSize'] = salCapRosterSize;
    teamTable.records[i]['SalCapNextYearRosterSize'] = salCapNextYearRosterSize;
  }
}


franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(1612938518);
  const teamTable = franchise.getTableByUniqueId(502886486);
  await teamTable.readRecords();
  await playerTable.readRecords();

  await setRosterSizes(playerTable,teamTable)
  
  console.log("Roster sizes have been set successfully.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit.")
  prompt();
});



