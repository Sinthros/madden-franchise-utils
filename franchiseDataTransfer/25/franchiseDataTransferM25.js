const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');
const zeroPad = (num, places) => String(num).padStart(places, '0')
let is24To25;

const teamIdentityLookup = JSON.parse(fs.readFileSync('lookupFiles/team_identity.json', 'utf8'));
const sigAbilityJson = JSON.parse(fs.readFileSync('lookupFiles/signature_abilities_lookup.json', 'utf-8'));
const ALL_ASSET_NAMES = JSON.parse(fs.readFileSync('lookupFiles/all_asset_names.json', 'utf-8'));
const presentationIdLookup = JSON.parse(fs.readFileSync('lookupFiles/presentation_id_lookup.json', 'utf-8'));
const commentaryLookup = JSON.parse(fs.readFileSync('lookupFiles/commentary_lookup.json', 'utf-8'));
const TRANSFER_SCHEDULE_FUNCTIONS = require('../../retroSchedules/transferScheduleFromJson');
const SCHEDULE_FUNCTIONS = require('../../Utils/ScheduleFunctions');
const FranchiseUtils = require('../../Utils/FranchiseUtils');
const DEFAULT_PLAYER_ROW = 720;

const SOURCE_VALID_YEARS = [FranchiseUtils.YEARS.M24,FranchiseUtils.YEARS.M25]
const TARGET_VALID_YEARS = [FranchiseUtils.YEARS.M25];
  
console.log("In this program, you can convert your Madden 24 Franchise to Madden 25 (Or Madden 25 to another Madden 25 Franchise File)");
console.log("Your SOURCE franchise file will have the data you want to transfer. Your TARGET franchise file is the one you'll be transferring the data to.");
console.log("Please note that your TARGET franchise file MUST be in the PreSeason for this program to work.");

const sourceFranchise = FranchiseUtils.init(SOURCE_VALID_YEARS, {customYearMessage: "Select the Madden version of your SOURCE Franchise file. Valid inputs are 24 and 25.", promptForBackup: false});
const targetFranchise = FranchiseUtils.init(TARGET_VALID_YEARS, {customFranchiseMessage: "Please enter the name of your Madden 25 franchise file (such as CAREER-BEARS).", promptForBackup: true, isAutoUnemptyEnabled: true});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

function emptySignatureTable(signatureTable) {
  const defaultColumns = {
    "Player": FranchiseUtils.ZERO_REF,
    "ActivationEnabled": false,
    "Active": false,
    "DeactivationEnabled": false,
    "StartActivated": false,
    "SlotIndex": 0
  };

  FranchiseUtils.emptyTable(signatureTable, defaultColumns);
};

async function getBinaryReferenceM24(currentSignatureValue) {
  const matchingItem = sigAbilityJson.find(item => item.binaryReferenceM24.includes(currentSignatureValue));
  
  if (matchingItem) {
    return matchingItem.binaryReferenceM24;
  } else {
    return null;
  }
}

async function adjustSignatureTableBinary(currentTable,currentTableNumRows) {
  for (let rows = 0; rows<currentTableNumRows;rows++) {
    if (!currentTable.records[rows].isEmpty) {
      let currentSignatureValue = currentTable.records[rows]['Signature']
      const binaryReferenceM25Value = await getBinaryReferenceM24(currentSignatureValue);
      
      if (binaryReferenceM25Value !== null) {
        //console.log(`binaryReferenceM24 value for binaryReferenceM24 ${currentSignatureValue} is: ${binaryReferenceM25Value}`);
        currentTable.records[rows]['Signature'] = binaryReferenceM25Value
      }
      else {
        console.log(`No matching Madden 24 Signature Ability found for value: ${currentSignatureValue}. This should not happen. Please inform Sinthros of this message.`);
      }
      

    }
  }

}

async function handleTeamTable(teamTable) {
  let coachTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.coachTable);
  await coachTable.readRecords();
  let defaultOffensiveCoordinator = FranchiseUtils.ZERO_REF;
  let defaultDefensiveCoordinator = FranchiseUtils.ZERO_REF;
  let defaultSpecialTeams = FranchiseUtils.ZERO_REF;

  for (let j = 0; j < coachTable.header.recordCapacity;j++) { //Find default offensive/defensive coordinator rows

    if (coachTable.records[j]['Name'] === "" && coachTable.records[j]['TeamIndex'] === 0 && coachTable.records[j]['ActiveTalentTree'] === FranchiseUtils.ZERO_REF) {
      if (coachTable.records[j]['Position'] === 'OffensiveCoordinator') {
        defaultOffensiveCoordinator = getBinaryReferenceData(coachTable.header.tableId,j)
      }
      else if (coachTable.records[j]['Position'] === 'DefensiveCoordinator') {
        defaultDefensiveCoordinator = getBinaryReferenceData(coachTable.header.tableId,j)

      }
      else if (coachTable.records[j]['Position'] === 'SpecialTeams') {
        defaultSpecialTeams = getBinaryReferenceData(coachTable.header.tableId,j)

      }
    }

  }

  for (let i = 0; i < teamTable.header.recordCapacity; i++) { //Iterate through team table
    const record = teamTable.records[i];
    if (record.isEmpty) { //If empty, continue
      continue
    }
    // If the current row is a pro bowl team, zero out their HC column and set their OC/DC to the default row values from before
    if (FranchiseUtils.NFL_CONFERENCES.includes(record['DisplayName'])) {
      record['HeadCoach'] = FranchiseUtils.ZERO_REF;
      record['OffensiveCoordinator'] = defaultOffensiveCoordinator;
      record['DefensiveCoordinator'] = defaultDefensiveCoordinator;
    }
    record['SpecialTeamsCoach'] = defaultSpecialTeams;

  }

  let allTeamTables = targetFranchise.getAllTablesByName('Team');
  for (let teamTableIndex = 0; teamTableIndex < allTeamTables.length; teamTableIndex++) {
    let currentTeamTable = allTeamTables[teamTableIndex]
    await currentTeamTable.readRecords();
    let teamTableRows = currentTeamTable.header.recordCapacity;

    if (teamTableRows > 1) {
      continue
    }

    for (let k = 0; k < teamTableRows; k++) {
      //currentTeamTable.records[k]['HeadCoach'] = FranchiseUtils.ZERO_REF;
      currentTeamTable.records[k]['OffensiveCoordinator'] = defaultOffensiveCoordinator;
      currentTeamTable.records[k]['DefensiveCoordinator'] = defaultDefensiveCoordinator;
      currentTeamTable.records[k]['SpecialTeamsCoach'] = defaultSpecialTeams;

    }

  }
  
};

async function fixPlayerTableRow(targetFranchise) {
  const player = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  await player.readRecords();
  
  if (!player.records[DEFAULT_PLAYER_ROW].isEmpty && player.records[DEFAULT_PLAYER_ROW]['PLYR_ASSETNAME'] !== '_0') {
    const nextPlayerRecord = player.header.nextRecordToUse;
    const referencedRow = targetFranchise.getReferencesToRecord(player.header.tableId,DEFAULT_PLAYER_ROW);

    const originalPlayerBin = getBinaryReferenceData(player.header.tableId,DEFAULT_PLAYER_ROW);
    const newPlayerBin = getBinaryReferenceData(player.header.tableId,nextPlayerRecord);

    const columnHeaders = await FranchiseUtils.getColumnNames(player) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      player.records[nextPlayerRecord][currentCol] = player.records[DEFAULT_PLAYER_ROW][currentCol];
    }

    for (const table of referencedRow) {
      const currentTableId = table.tableId;
      const currentRelatedTable = targetFranchise.getTableById(currentTableId);
      await currentRelatedTable.readRecords();

      const currentRelatedHeaders = await FranchiseUtils.getColumnNames(currentRelatedTable) //Get the headers from the table


      try {
        for (let n = 0; n < currentRelatedHeaders.length;n++) {
          for (let row = 0; row < currentRelatedTable.header.recordCapacity; row++) { // Iterate through the table rows
              let currentCol = currentRelatedHeaders[n];
              if (currentRelatedTable.records[row].fields[currentCol]["isReference"]) {
                if (currentRelatedTable.records[row][currentCol] === originalPlayerBin) {
                  currentRelatedTable.records[row][currentCol] = newPlayerBin;
                  //console.log(`${currentCol} ${currentRelatedTable.header.name} ${currentTableId} ${row}`)
  
                }
  
              }
  
          }
       }

      } catch (e) {
        continue
      }
    }
  }

  player.records[DEFAULT_PLAYER_ROW]['MorphHead'] = FranchiseUtils.ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['FirstName'] = '';
  player.records[DEFAULT_PLAYER_ROW]['LastName'] = '';
  player.records[DEFAULT_PLAYER_ROW]['PLYR_ASSETNAME'] = '_0';
  player.records[DEFAULT_PLAYER_ROW]['ContractStatus'] = 'None';
  player.records[DEFAULT_PLAYER_ROW]['TeamIndex'] = 32;
  player.records[DEFAULT_PLAYER_ROW]['WeeklyGoals'] = FranchiseUtils.ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['CareerStats'] = FranchiseUtils.ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['SeasonStats'] = FranchiseUtils.ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['CharacterVisuals'] = FranchiseUtils.ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['SeasonalGoal'] = FranchiseUtils.ZERO_REF;

};

async function deleteExcessFreeAgents(targetFranchise) {
  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  const freeAgentsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.freeAgentTable);
  const drillCompletedTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.drillCompletedTable);
  await playerTable.readRecords();
  await freeAgentsTable.readRecords();
  await drillCompletedTable.readRecords();


  const freeAgentNumMembers = freeAgentsTable.header.numMembers;
  const filteredRecords = playerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  const numSignedPlayers = filteredRecords.filter(record => record.ContractStatus === 'Signed') // Filter nonempty players for where they're signed
  const numFreeAgents = filteredRecords.filter(record => record.ContractStatus === 'FreeAgent') // Filter nonempty players for where they're free agents
  var allFreeAgentsBinary = [];
  const worstFreeAgentsBinary = [];

  const numTotalPlayersDesired = 3500 //Max amount of free agents (this is relevant for a fantasy draft)
  const totalNumCurrentPlayers = numSignedPlayers.length + numFreeAgents.length; //Get the current number of players

  numFreeAgents.forEach((freeAgentRecord) => {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord);
    currentBin = getBinaryReferenceData(playerTable.header.tableId,rowIndex)
    allFreeAgentsBinary.push(currentBin)
    
  });
  

  if (totalNumCurrentPlayers > numTotalPlayersDesired) { // If we're above 3500 total players...
    const numExtraPlayers = totalNumCurrentPlayers - numTotalPlayersDesired; // Get the excess amount of players 
    const worstFreeAgents = numFreeAgents.sort((a, b) => a.OverallRating - b.OverallRating).slice(0, numExtraPlayers);  // Get the worst free agents up till the amount of extra players

    for (const freeAgentRecord of worstFreeAgents) {
      const rowIndex = playerTable.records.indexOf(freeAgentRecord); 
      const currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);
      worstFreeAgentsBinary.push(currentBin);
      playerTable.records[rowIndex]['ContractStatus'] = 'Deleted'; // Mark as deleted and empty the row
      playerTable.records[rowIndex].CareerStats = FranchiseUtils.ZERO_REF; // If we don't zero these out the game will crash
      playerTable.records[rowIndex].SeasonStats = FranchiseUtils.ZERO_REF;
      playerTable.records[rowIndex].GameStats = FranchiseUtils.ZERO_REF;
      playerTable.records[rowIndex].CharacterVisuals = FranchiseUtils.ZERO_REF;
      playerTable.records[rowIndex].College = FranchiseUtils.ZERO_REF;
      playerTable.records[rowIndex].PLYR_ASSETNAME = ""; // Don't know if this is needed, but doesn't hurt
      playerTable.records[rowIndex].empty();
      await FranchiseUtils.removeFromTable(drillCompletedTable, currentBin);
    }

    //Filter for where we aren't including the worstFreeAgentBin
    allFreeAgentsBinary = allFreeAgentsBinary.filter((bin) => !worstFreeAgentsBinary.includes(bin));
  
    while (allFreeAgentsBinary.length < freeAgentNumMembers) { //Fill up the remainder with zeroed out binary
      allFreeAgentsBinary.push(FranchiseUtils.ZERO_REF)
    }

    //One liner to set the FA table binary = our free agent binary
    allFreeAgentsBinary.forEach((val, index) => { freeAgentsTable.records[0].fieldsArray[index].value = val; })
    //console.log(worstFreeAgents.length)
  }
};

async function getNeededColumns(currentTableName) {

  switch (currentTableName) {
    case "Player":
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = ["GameStats","CharacterVisuals","SeasonalGoal","SeasonStats"];
      return [keepColumns,deleteColumns,zeroColumns];
    case "Team":
      keepColumns = ["Philosophy","HeadCoach","OffensiveCoordinator","DefensiveCoordinator","Roster","PracticeSquad","DepthChart","ActiveRosterSize","SalCapRosterSize","SalCapNextYearRosterSize","TeamIndex"];
      deleteColumns = [];
      zeroColumns = ["UserCharacter"];

      var namePrompt;
      const validOptions = ['YES','NO']
      while (!validOptions.includes(namePrompt)) { 
        console.log("Would you like to transfer over team names from the source file to the target file? (For example: Commanders, Bears, etc)");
        console.log("This will also transfer over Team menu colors.")
        console.log("Enter YES to transfer team names over or NO to leave them as is in the target file.")
        namePrompt = prompt(); // Get user input
        if (namePrompt.toUpperCase() === 'NO') { // If no, break
          break
        }
        else if (namePrompt.toUpperCase() === 'YES') {
          keepColumns.push("DisplayName","ShortName","NickName","LongName",
          "TEAM_BACKGROUNDCOLORR2","TEAM_BACKGROUNDCOLORR","TEAM_BACKGROUNDCOLORB","TEAM_BACKGROUNDCOLORB2",
          "TEAM_BACKGROUNDCOLORG","TEAM_BACKGROUNDCOLORG2")
          break
        }
      }
      return [keepColumns,deleteColumns,zeroColumns];   
    case "Coach":
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = ["SeasonalGoal","WeeklyGoals","CharacterVisuals"];
      if (is24To25) {
        zeroColumns.push("ActiveTalentTree");
      }
      return [keepColumns,deleteColumns,zeroColumns];  
    case "SeasonInfo":
      keepColumns = ["CurrentSeasonYear","CurrentYear"];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];  
    case "SalaryInfo":
      keepColumns = ["TeamSalaryCap"];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];  
    case "PlayerAward":
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns]; 
    case "CoachAward":
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns]; 
    case "TeamRoadmap":
      keepColumns = [];
      deleteColumns = ['Needs'];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns]; 

    default:
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];  
  }
};

async function assignFranchiseUsers(franchise) {
  let franchiseUserTable = franchise.getTableByUniqueId(TARGET_TABLES.franchiseUserTable);
  await franchiseUserTable.readRecords();
  let franchiseUserArray = franchise.getTableByUniqueId(TARGET_TABLES.franchiseUsersArray)
  let teamTable = franchise.getTableByUniqueId(TARGET_TABLES.teamTable);
  let coach = franchise.getTableByUniqueId(TARGET_TABLES.coachTable);
  let owner = franchise.getTableByUniqueId(TARGET_TABLES.ownerTable);
  let franchiseTable = franchise.getTableByUniqueId(TARGET_TABLES.franchiseTable)

  await franchiseUserArray.readRecords();
  await teamTable.readRecords();
  await coach.readRecords();
  await owner.readRecords();
  await franchiseTable.readRecords();

  let franchiseUserNumRows = franchiseUserTable.header.recordCapacity
  let teamTableNumRows = teamTable.header.recordCapacity
  let coachTableNumRows = coach.header.recordCapacity
  let ownerTableNumRows = owner.header.recordCapacity

  for (var i = 0; i < franchiseUserNumRows;i++) {
    if (franchiseUserTable.records[i].isEmpty) {
      continue
    }
    let foundUser = true;
    currentBin = getBinaryReferenceData(franchiseUserTable.header.tableId,i)
    for (let row = 0; row < franchiseUserArray.header.numMembers;row++) {
      if (franchiseUserArray.records[0][`User${row}`] === currentBin) {
        foundUser = true
        break

      }
    }
    if (foundUser) {
      let teamBin = franchiseUserTable.records[i]["Team"]; // Get current team from the FranchiseUser table
      for (let teamRow = 0; teamRow < teamTableNumRows;teamRow++) {
        currentRowBinary = getBinaryReferenceData(teamTable.header.tableId,teamRow);
        if (currentRowBinary === teamBin) {
          headCoach = teamTable.records[teamRow]['HeadCoach'];
          if (headCoach !== FranchiseUtils.ZERO_REF) {
            teamTable.records[teamRow]['UserCharacter'] = headCoach;
            franchiseUserTable.records[i]['UserEntity'] = headCoach;

            if (franchiseUserTable.records[i]['AdminLevel'] === 'Owner') {
              franchiseTable.records[0]['LeagueOwner'] = headCoach;
            }

            for (let coachRow = 0; coachRow < coachTableNumRows; coachRow++) {
              currentCoachRowBinary = getBinaryReferenceData(coach.header.tableId,coachRow);
              if (currentCoachRowBinary === headCoach) {
                coach.records[coachRow]['IsUserControlled'] = true;
              }
            }
            break
          }
          else {
            defaultOwner = teamTable.records[teamRow]["Owner"]
            teamTable.records[teamRow]['UserCharacter'] = defaultOwner;
            franchiseUserTable.records[i]['UserEntity'] = defaultOwner;
            if (franchiseUserTable.records[i]['AdminLevel'] === 'Owner') {
              franchiseTable.records[0]['LeagueOwner'] = defaultOwner;
            }
            for (let ownerRow = 0; ownerRow < ownerTableNumRows; ownerRow++) {
              currentOwnerRowBinary = getBinaryReferenceData(owner.header.tableId,ownerRow);
              if (currentOwnerRowBinary === defaultOwner) {
                owner.records[ownerRow]['IsUserControlled'] = true;
              }
            }
            break

          }
        }
      }

    }
  }
};

function containsNonUTF8(value) {
  if (Buffer.isBuffer(value)) {
    for (const byte of value) {
      if (byte === 0 || (byte >= 0x80 && byte <= 0xbf)) {
        return true; // Value contains non-UTF-8 byte
      }
    }
    return false; // Value is valid UTF-8
  } else {
    return false; // Not a Buffer, so not applicable
  }
}


async function handleLeagueHistoryBin(currentTable,teamIdentityLookup) {
  foundData = teamIdentityLookup.find(item => item.teamName === 'NFL Greats');
  const binaryReference = foundData.binaryReference;

  for (let i = 0;i<currentTable.header.recordCapacity;i++) {
    if (!currentTable.records[i].isEmpty) {
      currentTable.records[i]['teamIdentity'] = binaryReference

    }
  }
};

async function getCoachTables(mergedTableMappings) {
  
  const coach = targetFranchise.getTableByUniqueId(TARGET_TABLES.coachTable);
  const freeAgentCoachTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.freeAgentCoachTable);
  const team = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamTable);
  const activeTalentTree = targetFranchise.getTableByUniqueId(TARGET_TABLES.activeTalentTree);
  const talentNodeStatus = targetFranchise.getTableByUniqueId(TARGET_TABLES.talentNodeStatus);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.talentNodeStatusArray);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(TARGET_TABLES.talentSubTreeStatus);


  const tableArray = [coach,freeAgentCoachTable,team]

  if (!is24To25) {
    tableArray.push(activeTalentTree,talentNodeStatus,talentNodeStatusArray,talentSubTreeStatus)
  }

  const targetIndices = [ // M22 has 68 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
  0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36
  ];

  let teamSource = sourceFranchise.getTableByUniqueId(TARGET_TABLES.teamTable);
  await teamSource.readRecords();

  for (let i = 0;i<team.header.recordCapacity;i++) {
    if (!team.records[i].isEmpty) {
      let currentTrainingList = team.records[i].fields['FocusTrainingList']["referenceData"]["tableId"]
      
      if (currentTrainingList !== 0) {
        const currentTrainingTable = targetFranchise.getTableById(currentTrainingList) // Get current training table
        await currentTrainingTable.readRecords();
        let sourceTeamRow = targetIndices.indexOf(i)

        try {
          var currentTrainingListSource = teamSource.records[sourceTeamRow].fields['FocusTrainingList']["referenceData"]["tableId"]
        } catch (e) {
            continue
        }

        let currentTrainingTableSource = sourceFranchise.getTableById(currentTrainingListSource)
        await currentTrainingTableSource.readRecords();

        

        for (let trainingRow = 0; trainingRow < currentTrainingTable.header.numMembers;trainingRow++) {
          currentSourceBinVal = currentTrainingTableSource.records[0][`Player${trainingRow}`] // Get currentBinVal
          let outputBin = FranchiseUtils.dec2bin(currentTrainingTableSource.records[0].fields[`Player${trainingRow}`]["referenceData"]["tableId"]); //Get our outputBin
          outputBin = zeroPad(outputBin, 15)
          const playerObjects = mergedTableMappings.filter(obj => obj.name === 'Player');

          const currentTableDict = mergedTableMappings.find(table => table.sourceIdBinary === outputBin);

          try {
            replaceBin = currentTableDict.targetIdBinary

          }
          catch (e) {
            
            
          }
          
          if (outputBin !== '000000000000000') {
            // Else, replace the outputBin with the currentDictValue
            var finalBinValue = currentSourceBinVal.replace(outputBin,replaceBin)
          }
          else {
            var finalBinValue = FranchiseUtils.ZERO_REF;
          
          }

          currentTrainingTable.records[0][`Player${trainingRow}`] = finalBinValue
        }
        }
      }
    }
  return tableArray;
};

function handlePlayerTable(playerTable) {
  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    const record = playerTable.records[i];
    const isEmpty = record.isEmpty;

    // Fields to check for invalid UTF-8 values
    const fieldsToCheck = ['PLYR_ASSETNAME', 'FirstName', 'LastName'];

    // Iterate over the fields to check for non-UTF8 values
    for (const field of fieldsToCheck) {
      const fieldValue = record[field];
      const hasInvalidValue = containsNonUTF8(Buffer.from(fieldValue, 'utf-8'));

      if (hasInvalidValue) {
        record[field] = ""; // Set the field to an empty string if it contains invalid UTF-8
      }
    }

    if (isEmpty) {
      record['CareerStats'] = FranchiseUtils.ZERO_REF;

    }

    // Dictionary for fields and their replacement values when a number is detected
    const fieldsToReplace = {
      'PlayerVisMoveType': 'Default',
      'TRAIT_COVER_BALL': 'Never',
      'PLYR_HOME_STATE': 'INVALID',
      'InjurySeverity': 'Invalid_',
      'CaptainsPatch': 'Invalid_'
    };

    // Iterate over the dictionary to check for numbers and replace values accordingly
    for (const [field, replacementValue] of Object.entries(fieldsToReplace)) {
      const fieldValue = record[field];
      const numberCheck = FranchiseUtils.hasNumber(fieldValue);

      if (numberCheck) {
        record[field] = replacementValue;
      }
    }
  }

    playerTable.records.filter(record => !record.isEmpty && record.ContractStatus === 'Expiring')
      .forEach(record => record.ContractStatus = 'Signed');
}


async function fillResignTable() {
  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  const teamTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamTable);
  const resignArrayTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.reSignArrayTable);
  const resignTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.reSignTable);
  await playerTable.readRecords();
  await teamTable.readRecords();
  await resignArrayTable.readRecords();
  await resignTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {//Iterate through player
    if (playerTable.records[i].isEmpty) {
      continue
    }
    //Get contract status and year
    currentContractStatus = playerTable.records[i]["ContractStatus"]
    contractYearsLeft = playerTable.records[i]["ContractLength"] - playerTable.records[i]["ContractYear"] 
    
    //If eligible to be resigned...
    if (currentContractStatus === "Signed" && contractYearsLeft === 1) {
      for (let j = 0; j < teamTable.header.recordCapacity;j++) { //Iterate to get their team table value
        if (teamTable.records[j]['TeamIndex'] === playerTable.records[i]['TeamIndex']) {
          var currentTeamBinary =  getBinaryReferenceData(teamTable.header.tableId,j);
          var currentPlayerBinary = getBinaryReferenceData(playerTable.header.tableId,i);
          break
        }
      }


    
    //Get resign table record and set the needed attributes
    resignTableNextRecord = resignTable.header.nextRecordToUse;
    resignTable.records[resignTableNextRecord]["Team"] = currentTeamBinary
    resignTable.records[resignTableNextRecord]["Player"] = currentPlayerBinary
    resignTable.records[resignTableNextRecord]["ActiveRequestID"] = -1
    resignTable.records[resignTableNextRecord]["NegotiationWeek"] = 3

    //Get resign row binary for the array table
    var currentResignBinary =  getBinaryReferenceData(resignTable.header.tableId,resignTableNextRecord);
    var n = 0;
    while (true) { // Find first zeroed out value in resign table and insert the binary
      if (resignArrayTable.records[0][`PlayerReSignNegotiation${n}`] === FranchiseUtils.ZERO_REF) {
        resignArrayTable.records[0][`PlayerReSignNegotiation${n}`] = currentResignBinary
        break
      }
      n++;
    }
    }

  }

};

async function handleTable(targetTable,mergedTableMappings) {

  const targetUniqueId = targetTable.header.uniqueId; // Get table unique ID
  const tableKey = FranchiseUtils.findKeyByValue(TARGET_TABLES,targetTable.header.uniqueId);
  const sourceUniqueId = SOURCE_TABLES[tableKey];
  const sourceTable = sourceFranchise.getTableByUniqueId(sourceUniqueId);
  const currentTableName = targetTable.header.name;
  console.log(currentTableName)
  const [keepColumns,deleteColumns,zeroColumns] = await getNeededColumns(currentTableName) // Get the columns we need for the current table

  const sourceColumns = await FranchiseUtils.getColumnNames(sourceTable); //Get the headers from the table

  sourceColumns.forEach((currentCol, colIndex) => {
    for (let i = 0; i < sourceTable.header.recordCapacity; i++) {
      const record = sourceTable.records[i];
  
      try {
        const field = record.fields[currentCol];
        if (!field.isReference) continue; // Skip if not a bin reference column
  
        const currentValue = record[currentCol];
  
        // Skip if all zeroes OR if it starts with 1 (meaning it's a reference from the FTC files)
        if (currentValue === FranchiseUtils.ZERO_REF || currentValue.startsWith('1')) continue;
  
        // Convert tableId to binary and zero-pad it
        const outputBin = zeroPad(FranchiseUtils.dec2bin(field.referenceData.tableId), 15);
  
        // Find the corresponding dictionary entry in mergedTableMappings
        const sourceTableDict = mergedTableMappings.find(table => table.sourceIdBinary === outputBin);

        if (!sourceTableDict) {
          if (!record.isEmpty) console.log(currentCol);
          continue; // Skip if no matching dictionary entry
        }
        
        // Replace the binary value with the target binary value
        record[currentCol] = currentValue.replace(outputBin, sourceTableDict.targetIdBinary);
  
      } catch (error) {
        console.error(`Error processing column: ${currentCol} at row ${i}`, error);
      }
    }
  });

  // Handle specific table types
  switch (currentTableName) {
    case 'Player':
      FranchiseUtils.emptyTable(targetTable,{"CareerStats": FranchiseUtils.ZERO_REF,"SeasonStats": FranchiseUtils.ZERO_REF, "GameStats": FranchiseUtils.ZERO_REF, "CharacterVisuals": FranchiseUtils.ZERO_REF})
      handlePlayerTable(sourceTable);
      break;
    case 'Team':
      //await handleTeamTable(sourceTable);
      break;
    case 'ActiveSignatureData':
      if (is24To25) {
        //await adjustSignatureTableBinary(sourceTable);
        emptySignatureTable(targetTable);
        return
      }
      break;
  }

  for (let i = 0; i < sourceTable.header.recordCapacity; i++) {
    const sourceRecord = sourceTable.records[i];
    // Here we add the record from the source table to the target
    // We set our ignoreColumns, zeroColumns, and keepColumns, and specify to use the same index from the source table in the target table to keep the same structure
    FranchiseUtils.addRecordToTable(sourceRecord, targetTable, { ignoreColumns: deleteColumns, zeroColumns: zeroColumns, keepColumns: keepColumns, useSameIndex: true  })
  } 
};



async function getPlayerTables() {
  const player = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  const freeAgents = targetFranchise.getTableByUniqueId(TARGET_TABLES.freeAgentTable);
  const playerArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.rosterTable);
  const playerPracticeSquads = targetFranchise.getTableByUniqueId(TARGET_TABLES.practiceSquadTable);
  const depthChart = targetFranchise.getTableByUniqueId(TARGET_TABLES.depthChartPlayerTable);
  const teamRoadMap = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamRoadmapTable);
  const mainActiveSignature = targetFranchise.getTableByUniqueId(TARGET_TABLES.mainSigAbilityTable);
  const secondaryActiveSignature = targetFranchise.getTableByUniqueId(TARGET_TABLES.secondarySigAbilityTable);
  const signatureArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.signatureArrayTable);
  const careerDefensiveKPReturnStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.careerDefKPReturnStatsTable);
  const careerOffensiveKPReturnStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOffKPReturnStatsTable);
  const careerOLineStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOLineStatsTable);
  const careerOffensiveStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.careerOffStatsTable);
  const careerDefensiveStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.careerDefStatsTable);
  const careerKickingStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.careerKickingStatsTable);
  const playerMerchTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerMerchTable);

  const seasonStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonStatsTable);
  const seasonDefensiveKPReturnStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonDefKPReturnStatsTable);
  const seasonOffensiveKPReturnStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonOffKPReturnStatsTable);
  const seasonOLineStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonOLineStatsTable);
  const seasonOffensiveStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonOffStatsTable);
  const seasonDefensiveStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonDefStatsTable);
  const seasonKickingStats = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonKickingStatsTable);

  const tableArray = [player,freeAgents,playerArray,playerPracticeSquads,
    depthChart,teamRoadMap,careerDefensiveKPReturnStats,careerOffensiveKPReturnStats,careerOLineStats,careerOffensiveStats,careerDefensiveStats,
    careerKickingStats,mainActiveSignature,secondaryActiveSignature];


  return tableArray;

};

async function getTradeTables() {
  const tradeNegotiationArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.tradeNegotiationArrayTable);
  const tradeNegotiation = targetFranchise.getTableByUniqueId(TARGET_TABLES.tradeNegotiationTable);
  const teamTradePackageArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamTradePackageArrayTable);
  const requestArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.tradeRequestArrayTable);
  const pendingTeamArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.pendingTeamArrayTable);
  const teamTradePackage = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamTradePackageTable);

  const tableArray = [tradeNegotiationArray,tradeNegotiation,teamTradePackageArray,
    requestArray,pendingTeamArray,teamTradePackage];

  return tableArray;

}

async function getAwardTables() {
  const playerAward = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerAwardTable);
  const coachAward = targetFranchise.getTableByUniqueId(TARGET_TABLES.coachAwardTable);
  const awardArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.awardArrayTable);

  const tableArray = [playerAward,coachAward,awardArray];

  return tableArray;

};

async function getDraftPickTables() {
  const draftPicks = targetFranchise.getTableByUniqueId(TARGET_TABLES.draftPickTable);

  const tableArray = [draftPicks];

  return tableArray;

};

async function getOptionalTables() {
  const seasonInfo = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);
  const salaryInfo = targetFranchise.getTableByUniqueId(TARGET_TABLES.salaryInfoTable);
  const sourceSeasonInfo = sourceFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);
  const leagueHistoryAward = targetFranchise.getTableByUniqueId(TARGET_TABLES.leagueHistoryAward);
  const leagueHistoryArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.leagueHistoryArray);
  const yearSummary = targetFranchise.getTableByUniqueId(TARGET_TABLES.yearSummary);
  const yearSummaryArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.yearSummaryArray);
  const historyTables = [];

  await sourceSeasonInfo.readRecords();
  await seasonInfo.readRecords();

  const targetCurrentStage = seasonInfo.records[0]['CurrentStage'];

  if (targetCurrentStage !== 'PreSeason') {
    const currentWeekType = seasonInfo.records[0]['CurrentWeekType'];
    console.log(`ERROR! Target file MUST be in the PreSeason to execute this program. Your target file is currently in the ${currentWeekType}.`);
    console.log("Ensure your target franchise file is in the PreSeason before using this program.");
    FranchiseUtils.EXIT_PROGRAM();
  }

  const sourceSeasonYear = sourceSeasonInfo.records[0]['CurrentSeasonYear'];
  const sourceCurrentStage = sourceSeasonInfo.records[0]['CurrentStage'];

  if (sourceCurrentStage === 'OffSeason') {
    console.log("WARNING! The source file you've selected is in the Offseason.");
    console.log("It's not advisable to use a source file that's in the OffSeason because Draft Class players won't be transferred, AND there's a good chance that your target file will crash.");

    const validOptions = ['YES', 'NO'];
    let quitPrompt;

    while (!validOptions.includes(quitPrompt)) {
      console.log("Are you sure you want to continue? Enter YES to continue or NO to quit.");
      quitPrompt = prompt();

      if (quitPrompt.toUpperCase() === 'YES') {
        const sourceCurrentOffseasonStage = sourceSeasonInfo.records[0]['CurrentOffseasonStage'];
        const sourceCurrentYear = sourceSeasonInfo.records[0]['CurrentYear'];

        if (sourceCurrentOffseasonStage < 10) {
          const updatedSeasonYear = sourceSeasonYear + 1;
          const updatedCurrentYear = sourceCurrentYear + 1;
          sourceSeasonInfo.records[0]['CurrentSeasonYear'] = updatedSeasonYear;
          sourceSeasonInfo.records[0]['CurrentYear'] = updatedCurrentYear;
        }

        break;
      } else if (quitPrompt.toUpperCase() === 'NO') {
        FranchiseUtils.EXIT_PROGRAM();
      }
    }
  }

  const tableArray = [];

  for (let count = 1; count <= 2; count++) {
    let currentTable;

    if (count === 1) {
      console.log("Would you like to transfer over the Season Year from your source file to your target file?");
      console.log("Enter YES to transfer the Season Year or NO to leave it as is in the target file.");
      currentTable = seasonInfo;
    } else if (count === 2) {
      console.log("Would you like to transfer over the Salary Cap from your source file to your target file? This is heavily recommended.");
      console.log("Enter YES to transfer the Salary Cap or NO to leave them as is in the target file.");
      currentTable = salaryInfo;
    }

    const namePrompt = prompt(); // Get user input
    if (namePrompt.toUpperCase() === 'YES') {
      tableArray.push(currentTable);
      if (count === 1) {
        tableArray.push(...historyTables);
      }
    }
  }

  return tableArray;
}

async function emptyRookieStatTracker(targetFranchise) {
  const rookieStatTracker = targetFranchise.getTableByUniqueId(TARGET_TABLES.rookieStatTrackerTable);
  const rookieStatTrackerArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.rookieStatTrackerArray);

  await rookieStatTracker.readRecords();
  await rookieStatTrackerArray.readRecords();

  let rookieStatTrackerNumRows = rookieStatTracker.header.recordCapacity;

  for (let i = 0; i < rookieStatTrackerNumRows; i++) {
    if (!rookieStatTracker.records[i].isEmpty) {
      rookieStatTracker.records[i]['DownsPlayed'] = 0;
      rookieStatTracker.records[i].empty();
    }
  }

  for (let i = 0; i < rookieStatTrackerArray.header.numMembers; i++) {
    rookieStatTrackerArray.records[0][`RookieStatTracker${i}`] = FranchiseUtils.ZERO_REF;
  }
};

async function clearFocusTrainingList() {
  const focusTrainingTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.focusTrainingTable);
  await focusTrainingTable.readRecords()

  for (let i = 0; i < focusTrainingTable.header.recordCapacity; i++) {
    const record = focusTrainingTable.records[i];

    for (let j = 0; j < focusTrainingTable.header.numMembers; j++) {
      record[`Player${j}`] = FranchiseUtils.ZERO_REF;
    }
  }
};

async function generateActiveAbilityPlayers() {
  const teamTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamTable);
  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);


  for (let i = 0; i < teamTable.header.recordCapacity; i++) {
    const record = teamTable.records[i];

    if (!record.isEmpty && record.OffenseActiveAbilitiesPlayers !== FranchiseUtils.ZERO_REF) {
      const teamIndex = record.TeamIndex;
      const defenseAbilityRef = record.DefenseActiveAbilitiesPlayers;
      const offenseAbilityRef = record.OffenseActiveAbilitiesPlayers;

      const offenseTableId = await FranchiseUtils.bin2Dec(offenseAbilityRef.slice(0,15));
      const defenseTableId = await FranchiseUtils.bin2Dec(defenseAbilityRef.slice(0,15));
      
      const defenseRowNum = await FranchiseUtils.bin2Dec(defenseAbilityRef.slice(15));
      const offenseRowNum = await FranchiseUtils.bin2Dec(offenseAbilityRef.slice(15));

      const offenseTable = targetFranchise.getTableById(offenseTableId);
      const defenseTable = targetFranchise.getTableById(defenseTableId);

      await FranchiseUtils.readTableRecords([offenseTable,defenseTable]);

      const offenseRecord = offenseTable.records[offenseRowNum];
      const defenseRecord = defenseTable.records[defenseRowNum];

      for (j = 0; j < offenseTable.header.numMembers; j++) {
        offenseRecord[`Player${j}`] = FranchiseUtils.ZERO_REF;
        defenseRecord[`Player${j}`] = FranchiseUtils.ZERO_REF;
      }

      const players = playerTable.records.filter(record => record.ContractStatus === 'Signed' && record.TeamIndex === teamIndex
        && record.TraitDevelopment === 'XFactor'
      );

      const offensivePlayers = players.filter(record => FranchiseUtils.OFFENSIVE_SKILL_POSITIONS.includes(record.Position));
      const defensivePlayers = players.filter(record => FranchiseUtils.ALL_DEFENSIVE_POSITIONS.includes(record.Position));

      // Sort and keep top 3 offensive players by OverallRating (descending)
      const topOffensivePlayers = offensivePlayers.sort((a, b) => b.OverallRating - a.OverallRating).slice(0, offenseTable.header.numMembers);

      // Sort and keep top 3 defensive players by OverallRating (descending)
      const topDefensivePlayers = defensivePlayers.sort((a, b) => b.OverallRating - a.OverallRating).slice(0, defenseTable.header.numMembers);

      // Iterate through the top offensive players using for...of with index
      for (const [i, player] of topOffensivePlayers.entries()) {
        const playerBinary = getBinaryReferenceData(playerTable.header.tableId,player.index);
        offenseRecord[`Player${i}`] = playerBinary;
      }

      // Iterate through the top defensive players using for...of with index
      for (const [i, player] of topDefensivePlayers.entries()) {
        const playerBinary = getBinaryReferenceData(playerTable.header.tableId,player.index);
        defenseRecord[`Player${i}`] = playerBinary;
      }
    }
  }
}

async function emptyMediaGoals(targetFranchise) {
  const characterActiveMediaGoal = targetFranchise.getTableByUniqueId(TARGET_TABLES.characterActiveMediaGoal);
  const characterActiveMediaGoalArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.characterActiveMediaGoalArray);

  await characterActiveMediaGoal.readRecords();
  await characterActiveMediaGoalArray.readRecords();

  const activeMediaGoalNumRows = characterActiveMediaGoal.header.recordCapacity;
  const activeMediaGoalArrayNumRows = characterActiveMediaGoalArray.header.recordCapacity;
  
  for (let i = 0; i < activeMediaGoalNumRows; i++) {
    if (!characterActiveMediaGoal.records[i].isEmpty) {
      characterActiveMediaGoal.records[i]['ActiveMediaGoals'] = FranchiseUtils.ZERO_REF;
      characterActiveMediaGoal.records[i].empty();
    }
  }

  for (let i = 0; i < activeMediaGoalArrayNumRows;i++) {
    if (!characterActiveMediaGoalArray.records[i].isEmpty) {
      for (let mediaArrayRow = 0; mediaArrayRow < characterActiveMediaGoalArray.header.numMembers;mediaArrayRow++) {
        characterActiveMediaGoalArray.records[0][`CharacterActiveMediaGoal${mediaArrayRow}`] = FranchiseUtils.ZERO_REF;
      }
      if (i !== 0) {
        characterActiveMediaGoalArray.records[i].empty();

      }
   }

  }

}

async function adjustSeasonGameTable(targetFranchise) {
  const seasonInfo = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);
  const seasonGame = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonGameTable);

  await FranchiseUtils.readTableRecords([seasonInfo,seasonGame]);

  for (const record of seasonGame.records) {
    if (!record.isEmpty && !record.IsPractice) {
      record.HomePlayerStatCache = FranchiseUtils.ZERO_REF;
      record.InjuryCache = FranchiseUtils.ZERO_REF;
      record.AwayPlayerStatCache = FranchiseUtils.ZERO_REF;
      record.ScoringSummaries = FranchiseUtils.ZERO_REF;
      record.SeasonYear = seasonInfo.records[0].CurrentYear;
    }
  }
}


async function emptyStoryTable(targetFranchise) {
  const storyArrayTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.storyArrayTable)
  await storyArrayTable.readRecords();

  for (let i = 0; i < storyArrayTable.header.recordCapacity;i++) {
    if (!storyArrayTable.records[i].isEmpty) {
        for (let j = 0; j < storyArrayTable.header.numMembers;j++) {
          storyArrayTable.records[i][`Story${j}`] = FranchiseUtils.ZERO_REF;
        }
      }
   }
};


async function removeUnnecessaryAssetNames() {
  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    const record = playerTable.records[i];
    if (!record.isEmpty) {
      if (!ALL_ASSET_NAMES.includes(record.PLYR_ASSETNAME)) {
        record.PLYR_ASSETNAME = "";
      }
    }
  }
}

async function adjustPlayerIds(targetFranchise, fieldToCheck, fieldToAdjust, lookupObject) {
  const player = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  await player.readRecords();

  for (let i = 0; i < player.header.recordCapacity; i++) {
    if (!player.records[i].isEmpty) {
      let fieldValue = player.records[i][fieldToCheck];
      if (lookupObject.hasOwnProperty(fieldValue)) {
        const id = lookupObject[fieldValue];
        player.records[i][fieldToAdjust] = id;
      }
    }
  }
}

// This function looks at the tables from SOURCE_TABLES and TARGET_TABLES for mergedTableMappings
// and essentially fills in missing sourceIdBinary values.
async function updateTableMappings(mergedTableMappings) {
  for (const [key, targetTableId] of Object.entries(TARGET_TABLES)) {
      const tableMap = mergedTableMappings.find(table => table.uniqueId === targetTableId);
      if (!tableMap) continue; // If no matching table, skip to next iteration
      
      if (key in SOURCE_TABLES && SOURCE_TABLES[key] !== TARGET_TABLES[key]) {
        const sourceUniqueId = SOURCE_TABLES[key];
        const sourceTable = sourceFranchise.getTableByUniqueId(sourceUniqueId);
        await sourceTable.readRecords();

        tableMap.sourceIdBinary = zeroPad(FranchiseUtils.dec2bin(sourceTable.header.tableId),15);
        tableMap.sourceId = sourceTable.header.tableId;
      }
  }
}

sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    if (await FranchiseUtils.hasMultiplePlayerTables(sourceFranchise)) {
      await FranchiseUtils.fixPlayerTables(sourceFranchise);
    }

    const sourceGameYear = sourceFranchise.schema.meta.gameYear // Get the game year of the source file
    const targetGameYear = targetFranchise.schema.meta.gameYear // Get the game year of the target file

    is24To25 = sourceGameYear === FranchiseUtils.YEARS.M24 && targetGameYear === FranchiseUtils.YEARS.M25;

    // We're going to read all tables for our source/target franchises so that we don't have to read them again later
    const allTables = [];
    for (const key in SOURCE_TABLES) {
      const sourceTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES[key]);
      const targetTable = targetFranchise.getTableByUniqueId(TARGET_TABLES[key]);
      allTables.push(sourceTable,targetTable);
    }

    // We read records for all tables, and we simply continue if there's an error loading a table
    await FranchiseUtils.readTableRecords(allTables,true);

    // Get the tableMappings for the source and target files - These are used to update bin references!
    const allTableMappingsTarget = targetFranchise.tables.map((table) => 
    { return { name: table.name, uniqueId: table.header.uniqueId, targetId: table.header.tableId, targetIdBinary: zeroPad(FranchiseUtils.dec2bin(table.header.tableId),15)  } });
    
    const allTableMappingsSource = sourceFranchise.tables.map((table) => 
    { return { name: table.name, uniqueId: table.header.uniqueId, sourceId: table.header.tableId, sourceIdBinary: zeroPad(FranchiseUtils.dec2bin(table.header.tableId),15)  } });

    // This is our mergedTableMappings, so that we can lookup the targetIdBinary and replace the sourceIdBinary with it
    const mergedTableMappings = allTableMappingsTarget.map(targetTable => {
      const sourceTable = allTableMappingsSource.find(sourceTable => sourceTable.uniqueId === targetTable.uniqueId);
    
      return { // Store all relevant data here
        name: targetTable.name,
        uniqueId: targetTable.uniqueId,
        targetId: targetTable.targetId,
        targetIdBinary: targetTable.targetIdBinary,
        sourceId: sourceTable ? sourceTable.sourceId : undefined,
        sourceIdBinary: sourceTable ? sourceTable.sourceIdBinary : undefined
      };
    });

    await updateTableMappings(mergedTableMappings);

    const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);

    for (let currentRow = 0; currentRow < playerTable.header.recordCapacity;currentRow++) {
      if (playerTable.records[currentRow].isEmpty)  {
        referencedRow = targetFranchise.getReferencesToRecord(playerTable.header.tableId,currentRow)
    
        referencedRow.forEach((table) => {
          //console.log(`${table.tableId}: ${table.name}: ${currentRow}`)
        })
      }
    }
    //const coachTables = await getCoachTables(mergedTableMappings);
    const playerTables = await getPlayerTables();
    const awardTables = await getAwardTables();
    //const optionalTables = await getOptionalTables();
    //const tradeTables = await getTradeTables();

    const draftPickTables = await getDraftPickTables();

    const allTablesArray = [playerTables,awardTables,draftPickTables];

    console.log("Now working on transferring all table data...");

    try {
      for (const currentArray of allTablesArray) {
        for (const currentTable of currentArray) {
          await handleTable(
            currentTable,
            mergedTableMappings
          );
        }
      }
    } catch (error) {
      console.log("******************************************************************************************");
      console.log(`FATAL ERROR! Please report this message to Sinthros IMMEDIATELY and send your source/target Franchise Files - ${error}`);
      console.log("Exiting program.");
      console.log("******************************************************************************************");
      FranchiseUtils.EXIT_PROGRAM();
    }


    await FranchiseUtils.emptyHistoryTables(targetFranchise); // Function to empty history tables (Avoid crashing)
    await FranchiseUtils.emptyAcquisitionTables(targetFranchise);

    await deleteExcessFreeAgents(targetFranchise); // Only keep the top 3500 players
    await fixPlayerTableRow(targetFranchise);
    await emptyRookieStatTracker(targetFranchise); // Function to empty Rookie Tracker table (Avoid crashing)
    await clearFocusTrainingList();
    await generateActiveAbilityPlayers();
    await FranchiseUtils.emptyResignTable(targetFranchise); // Empty and fill the resign tables
    await FranchiseUtils.regenerateMarketingTables(targetFranchise);
    await fillResignTable();

    await emptyStoryTable(targetFranchise); // Empty stories
    await emptyMediaGoals(targetFranchise); // Function to empty Media Goals table (Avoid crashing)
    await adjustSeasonGameTable(targetFranchise); // Function to update SeasGame table based on current SeasonYear

    await assignFranchiseUsers(targetFranchise)
    
    try {
      if (is24To25) {
        const message = "Would you like to remove asset names from the Player table that aren't in Madden 24's Database?";
        const removeAssetNames = FranchiseUtils.getYesOrNo(message);

        if (removeAssetNames) {
          await removeUnnecessaryAssetNames();
        }
      }

      //await adjustPlayerIds(targetFranchise, 'PLYR_ASSETNAME', 'PresentationId', presentationIdLookup);
      //await adjustPlayerIds(targetFranchise, 'LastName', 'PLYR_COMMENT', commentaryLookup);


      const scheduleMsg = "Would you like to transfer your schedule from your source file to your target file?\n" +
                          "This will transfer over both PreSeason and RegularSeason games.";      
      const transferSchedule = FranchiseUtils.getYesOrNo(scheduleMsg);
      
      if (transferSchedule) {
        console.log("Attempting to transfer your schedule from your source file...");
        const scheduleJson = await SCHEDULE_FUNCTIONS.convertScheduleToJson(sourceFranchise);
        TRANSFER_SCHEDULE_FUNCTIONS.setFranchise(targetFranchise);
        console.log("Yep")
        await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(scheduleJson);
      }
    } catch (e) {
      console.log("******************************************************************************************")
      console.log(`FATAL ERROR!! Please report this message to Sinthros IMMEDIATELY and send your source/target Franchise Files - ${e}`)
      console.log("Exiting program.")
      console.log("******************************************************************************************")
      FranchiseUtils.EXIT_PROGRAM();

    }
    
    console.log("Successfully completed transfer of data.");

    await FranchiseUtils.saveFranchiseFile(targetFranchise);
    FranchiseUtils.EXIT_PROGRAM();
    
})});



