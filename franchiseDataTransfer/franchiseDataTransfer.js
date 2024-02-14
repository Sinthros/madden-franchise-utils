// Requirements
const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const path = require('path');
const os = require('os');
const { exportTableData, importTableData } = require('./externalDataService');
const fs = require('fs');
const zeroPad = (num, places) => String(num).padStart(places, '0')

const teamIdentityLookup = JSON.parse(fs.readFileSync('lookupFiles/team_identity.json', 'utf8'));
const coachTalentsPositions = JSON.parse(fs.readFileSync('lookupFiles/coach_talents.json', 'utf8'));
const coachTalentsLookup = JSON.parse(fs.readFileSync('lookupFiles/coach_talents_lookup.json', 'utf8'));
const sigAbilityJson = JSON.parse(fs.readFileSync('lookupFiles/signature_abilities_lookup.json', 'utf-8'));
const allAssetNames = Object.keys(JSON.parse(fs.readFileSync('lookupFiles/all_asset_names.json', 'utf-8')));
const presentationIdLookup = JSON.parse(fs.readFileSync('lookupFiles/presentation_id_lookup.json', 'utf-8'));
const commentaryLookup = JSON.parse(fs.readFileSync('lookupFiles/commentary_lookup.json', 'utf-8'));
const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const TRANSFER_SCHEDULE_FUNCTIONS = require('../lookupFunctions/transferSchedule');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');


const ZERO_REF = '00000000000000000000000000000000';
const ACTIVE_ABILITY_UNIQUE_ID_M22 = 3512815678;
const ACTIVE_ABILITY_UNIQUE_ID_M24 = 3545956611;
const DRAFTED_PLAYERS_ARRAY_M22 = 3638782800;
const DRAFTED_PLAYERS_ARRAY_M24 = 4073486347;
const MARKETED_PLAYERS_ARRAY_M22 = 3584052617;
const MARKETED_PLAYERS_ARRAY_M24 = 434873538;
const PLAYER_TABLE = 1612938518;
const OFFENSIVE_SKILL_POSITIONS = ['QB','HB','FB','WR','TE'];


const playerMotivationsM24 = [
  "NoIncomeTax",
  "WarmWeatherState",
  "BigMarket",
  "ChampionshipContender",
  "TeamPrestige",
  "SchemeFit",
  "ToptheDepthChart",
  "TeamHasFranchiseQB",
  "MentoratPosition",
  "HeadCoachHistoricRecord",
  "CloseToHome",
  "HighestOffer",
];


const currentDate = new Date().toISOString().split('T')[0] //Current date for temp folder
const dir = `./temp-${currentDate}-temp`; //Ensure we aren't accidentally erasing anyone's potentially existing folder by using current date

fs.rmSync(dir, { recursive: true, force: true }); //Remove this folder if it already exists and recreate it
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}
  
console.log("In this program, you can convert your Madden 22 Franchise to Madden 24 (Or Madden 24 to another Madden 24 Franchise File)")
console.log("Your SOURCE franchise file will have the data you want to transfer. Your TARGET franchise file is the one you'll be transferring the data to.")
console.log("Please note that your TARGET franchise file MUST be in the PreSeason for this program to work.")

var gamePrompt;
validGames = ['22','24']
while (!validGames.includes(gamePrompt)) {
  console.log("Select the Madden version of your SOURCE Franchise file. Valid inputs are 22 and 24.")
  console.log("Only enter 24 if you're purposely trying to transfer a Madden 24 Franchise file's data into another Madden 24 file.")
  gamePrompt = prompt()

  if (validGames.includes(gamePrompt)) {
    break
  }
  else {
    console.log("Invalid option. Please try again.")
  }
}

const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gamePrompt}\\saves\\`); //Two paths - One using default, one with OneDrive
const oneDriveDir = path.join(os.homedir(),`OneDrive\\Documents\\Madden NFL ${gamePrompt}\\saves\\`)
default_path = documentsDir // Set to default dir first

if (fs.existsSync(documentsDir)) { //First, check if our Madden saves are in the default location
  default_path = documentsDir
  m24Path = default_path.replace(gamePrompt, "24");
}
else if (fs.existsSync(oneDriveDir)) { // Else, check if it's in the OneDrive path
  default_path = oneDriveDir
  m24Path = default_path.replace(gamePrompt, "24");
}
else { // Else, ask the user to put in their full file path
  console.log(`IMPORTANT! Couldn't find the path to your Madden ${gamePrompt} save files. When selecting your file, make sure to give the FULL PATH.`)
}


//Our franchise file
function selectFranchiseFile (franchise,default_path,fileType) {
  while (franchise === "") { //While we haven't selected a franchise file...
    try {
      console.log(`Please enter the name of your ${fileType} franchise file. Either give the full path of the file OR just give the file name (ie CAREER-BEARS) if it's in your documents folder. `)
      var fileName = prompt()
      
      if (fileName.startsWith("CAREER-")) { // Try to get from the default_path
        let fullPath = default_path.concat(fileName);
        var franchise = new Franchise(fullPath, {'autoUnempty': true})
        return franchise;

      }
      else { //Perform a RegExp and get the full franchise file
        let fullPath = default_path.concat(fileName);
        var franchise = new Franchise(fullPath, {'autoUnempty': true})
        var search = '/'
        var replacer = new RegExp(search, 'g')
        var fileName = fileName.replace(replacer,'\\')
        var franchise = new Franchise(fileName, {'autoUnempty': true});
        return franchise;
      }

    }
    catch (e) { // Except, print the error and try again
      console.log(e)
      console.log("Invalid franchise file name/path given. Please try again.")
      continue

    }
  }
}

var sourceFranchise = ""
sourceFranchise = selectFranchiseFile(sourceFranchise,default_path,"Source")

var targetFranchise = ""
targetFranchise = selectFranchiseFile(targetFranchise,m24Path,"Target")

async function importTables(tableToEdit,filePath,keepColumns,deleteColumns,zeroColumns) {

  //These are the tables we need to explicitly set the nextRecordToUse for
  let nextRecordTables = ["CoachAward","CareerOffensiveKPReturnStats","CareerDefensiveKPReturnStats","CareerOffensiveStats","CareerDefensiveStats","CareerKickingStats","CareerOLineStats","LeagueHistoryAward"]

  let checkEmptyRows = []
  let checkInvalidRows = [] //This is specifically for the TalentNodeStatus table
  let nextRecordToUse = ""

  const table = await importTableData({ inputFilePath: filePath })

  await table.forEach(async function (record,i) { //If the TalentStatus column exists, do this check
    numCheck = await FranchiseUtils.hasNumber(record.TalentStatus)
    if (numCheck === true) {
      record.TalentStatus = 'NotOwned'
      checkInvalidRows.push(i);
    }
  })

  await table.forEach(function (record,i) { //Define our empty rows AND nextRecordToUse
    if (record.isRowEmpty === 'TRUE') {
      checkEmptyRows.push(i);
      if (record.nextRecordToUse === 'TRUE') {
        nextRecordToUse = i
      }
    }  
  })

  //Get our data
  var trimmedTable = table.slice(0, tableToEdit.records.length);


  //Remove each column in the deleteColumns array
  for (let j = 0;j< deleteColumns.length;j++) {

    trimmedTable.forEach(function(item){ delete item[deleteColumns[j]] });
  }

  //Zero out each column in the zeroColumns array
  for (let j = 0; j< zeroColumns.length;j++) {
    trimmedTable.forEach(function(item){ item[zeroColumns[j]] = ZERO_REF });
  }

  //If keepColumns is defined, ONLY keep those columns
  if (keepColumns.length != 0) {
    trimmedTable= trimmedTable.map(e => {
      const obj = {};
      keepColumns.forEach(k => obj[k] = e[k])
      return obj;
    });
  }
  trimmedTable.forEach((record, index) => {
      
      let franchiseRecord = tableToEdit.records[index];
      var i = 0
      i++;
      Object.keys(record).forEach((key) => {
          if (franchiseRecord[key] != record[key]) {
            franchiseRecord[key] = record[key];

          }
      });   
  });

  if (tableToEdit.header.name === 'TalentNodeStatus') { //If tableName = TalentNodeStatus...
    checkInvalidRows.forEach(function (record) {
      try {
        //First, set each invalid TalentStatus value = NotOwned
        tableToEdit.records[record]['TalentStatus'] = 'NotOwned'
      } catch {
        //
      }})

    //Empty all defined empty records
    checkEmptyRows.forEach(function (record) {
      tableToEdit.records[record].empty()  
     })

     //Explicitly set the next record to use and end the function
     tableToEdit.setNextRecordToUse(nextRecordToUse)
     return
  }

  //If our table needs to have the nextRecord set by us...
  if (nextRecordTables.includes(tableToEdit.header.name)) {
    checkEmptyRows.forEach(function (record) {
      tableToEdit.records[record].empty()
  
     })
     tableToEdit.setNextRecordToUse(nextRecordToUse)
     return

  }

  // Else, empty all the defined empty records
  checkEmptyRows.forEach(function (record) {

    try {
      tableToEdit.records[record].empty()
    }
    catch {
      console.log("Couldn't empty record.")
    }
   })
   if (table.length < tableToEdit.records.length) {
    for (let i = table.length;i < tableToEdit.records.length;i++) {
      await tableToEdit.records[i].empty()
    }
   }
  return;
};

async function emptyCharacterVisualsTable(targetFranchise) {
  console.log("Regenerating all Character Visuals for players/coaches...")
  const characterVisuals = targetFranchise.getTableByUniqueId(1429178382);
  await characterVisuals.readRecords();

  for (let rows = 0; rows < characterVisuals.header.recordCapacity;rows++) {
      if (characterVisuals.records[rows].isEmpty) {
        await characterVisuals.records[rows].empty();
      }
  }
};

async function generatePlayerMotivations(targetFranchise) {
  console.log("Regenerating all Player Motivations...")
  const playerTable = targetFranchise.getTableByUniqueId(PLAYER_TABLE);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    if (playerTable.records[i].isEmpty === false) {
      const motivationsCopy = [...playerMotivationsM24];
      if (playerTable.records[i]['Position'] === 'QB') {
        // If the position is QB, remove 'TeamHasFranchiseQB' from a copy of the array
        const qbIndex = motivationsCopy.indexOf('TeamHasFranchiseQB');
        if (qbIndex !== -1) {
          motivationsCopy.splice(qbIndex, 1);
        }
      }

      if (playerTable.records[i]['OverallRating'] < 75) {
        // If bad overall, remove 'ToptheDepthChart' from a copy of the array
        const topDepthChartIndex = motivationsCopy.indexOf('ToptheDepthChart');
        if (topDepthChartIndex !== -1) {
          motivationsCopy.splice(topDepthChartIndex, 1);
        }

      }
      
      await shuffleArray(motivationsCopy);

      // Take the first three elements (they will be random and unique)
      const randomMotivations = motivationsCopy.slice(0, 3);

      playerTable.records[i]['Motivation1'] = randomMotivations[0];
      playerTable.records[i]['Motivation2'] = randomMotivations[1];
      playerTable.records[i]['Motivation3'] = randomMotivations[2];
    }
  }
}

// Function to shuffle an array (Fisher-Yates algorithm)
async function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
async function emptyAcquisitionTables(targetFranchise) {
  const playerAcquisitionEvaluation = targetFranchise.getTableByUniqueId(2531183555);
  const playerAcquisitionEvaluationArray = targetFranchise.getTableByUniqueId(498911520);

  await playerAcquisitionEvaluation.readRecords();
  await playerAcquisitionEvaluationArray.readRecords();

  for (let i = 0; i < playerAcquisitionEvaluation.header.recordCapacity;i++) {
    if (playerAcquisitionEvaluation.records[i].isEmpty) {
      continue
    }
    playerAcquisitionEvaluation.records[i]['Player'] = ZERO_REF;
    playerAcquisitionEvaluation.records[i]['isPlayerSuperstar'] = false;
    playerAcquisitionEvaluation.records[i]['isPlayerXFactor'] = false;
    playerAcquisitionEvaluation.records[i]['AddedValue'] = 0;
    playerAcquisitionEvaluation.records[i]['DevelopmentValue'] = 0;
    playerAcquisitionEvaluation.records[i]['Value'] = 0;
    playerAcquisitionEvaluation.records[i]['FreeAgentComparisonValue'] = 0;
    playerAcquisitionEvaluation.records[i]['ImportanceValue'] = 0;
    playerAcquisitionEvaluation.records[i]['TeamSchemeOverallValue'] = 0;
    playerAcquisitionEvaluation.records[i]['TeamTradePhilosophyValue'] = 0;
    playerAcquisitionEvaluation.records[i]['AcquisitionType'] = "Signed";
    playerAcquisitionEvaluation.records[i]['Rank'] = 0;
    playerAcquisitionEvaluation.records[i]['BestSchemeOverallValue'] = 0;
    playerAcquisitionEvaluation.records[i]['CoachTradeInfluenceValue'] = 0;
    playerAcquisitionEvaluation.records[i]['ContractValue'] = 0;
    playerAcquisitionEvaluation.records[i]['IsPlayerHidden'] = false;
    await playerAcquisitionEvaluation.records[i].empty();
  }

  for (let i = 0; i < playerAcquisitionEvaluationArray.header.recordCapacity;i++) {
    if (playerAcquisitionEvaluationArray.records[i].isEmpty) {
      continue
    }
    for (j = 0; j < 10;j++) {
      playerAcquisitionEvaluationArray.records[i][`PlayerAcquisitionEvaluation${j}`] = ZERO_REF;
    }
  }

}

async function emptyResignTable(currentTable,currentTableNumRows) {
  for (let rows = 0;rows<currentTableNumRows;rows++) {
    //Iterate through resign table and set default values
    currentTable.records[rows]["Team"] = ZERO_REF;
    currentTable.records[rows]["Player"] = ZERO_REF;
    currentTable.records[rows]["ActiveRequestID"] = "-2147483648"
    currentTable.records[rows]["NegotiationWeek"] = "0"
    currentTable.records[rows]["TeamReSignInterest"] = "0"
    currentTable.records[rows]["ContractSalary"] = "0"
    currentTable.records[rows]["NegotiationCount"] = "0"
    currentTable.records[rows]["PlayerReSignInterest"] = "0"
    currentTable.records[rows]["ContractBonus"] = "0"
    currentTable.records[rows]["PreviousOfferedContractBonus"] = "0"
    currentTable.records[rows]["PreviousOfferedContractSalary"] = "0"
    currentTable.records[rows]["FairMarketContractBonus"] = "0"
    currentTable.records[rows]["FairMarketContractSalary"] = "0"
    currentTable.records[rows]["ActualDesiredContractBonus"] = "0"
    currentTable.records[rows]["ActualDesiredContractSalary"] = "0"
    currentTable.records[rows]["LatestOfferStage"] = "PreSeason"
    currentTable.records[rows]["ContractLength"] = "0"
    currentTable.records[rows]["FairMarketContractLength"] = "0"
    currentTable.records[rows]["PreviousOfferedContractLength"] = "0"
    currentTable.records[rows]["PreviousReSignStatus"] = "Invalid"
    currentTable.records[rows]["ReSignStatus"] = "NotReady"
    currentTable.records[rows]["LatestOfferWeek"] = "0"
    currentTable.records[rows]["PlayerPreviousReSignInterest"] = "0"
    currentTable.records[rows]["InitialContract"] = "false"
    currentTable.records[rows]["NegotiationsEnded"] = "false"
    currentTable.records[rows]["ActualDesiredContractLength"] = "0"


    //This results in every row being emptied
    if (!currentTable.records[rows].isEmpty) {
      await currentTable.records[rows].empty()

    }

  }

  //Get the resign array table
  const resignArrayTable = targetFranchise.getTableByUniqueId(91905499)
  await resignArrayTable.readRecords();
  //Iterate through the resign array table and zero everything out
  for (let resignArrayRow = 0; resignArrayRow < resignArrayTable.header.numMembers;resignArrayRow++) {
    resignArrayTable.records[0][`PlayerReSignNegotiation${resignArrayRow}`] = ZERO_REF;
  }

};

async function emptySignatureTable(currentTable,currentTableNumRows) {
  for (let rows = 0;rows<currentTableNumRows;rows++) {
    //Iterate through signature table and set default values
    currentTable.records[rows]["Player"] = ZERO_REF;
    currentTable.records[rows]["ActivationEnabled"] = false
    currentTable.records[rows]["Active"] = false
    currentTable.records[rows]["DeactivationEnabled"] = false
    currentTable.records[rows]["StartActivated"] = false
    currentTable.records[rows]["SlotIndex"] = 0

    //This results in every row being emptied
    if (currentTable.records[rows].isEmpty === false) {
      await currentTable.records[rows].empty()

    }

  }

};

async function getBinaryReferenceM24(currentSignatureValue) {
  const matchingItem = sigAbilityJson.find(item => item.binaryReferenceM22.includes(currentSignatureValue));
  
  if (matchingItem) {
    return matchingItem.binaryReferenceM24;
  } else {
    return null;
  }
}

async function adjustSignatureTableBinary(currentTable,currentTableNumRows) {
  for (let rows = 0; rows<currentTableNumRows;rows++) {
    if (currentTable.records[rows].isEmpty === false) {
      let currentSignatureValue = currentTable.records[rows]['Signature']
      const binaryReferenceM24Value = await getBinaryReferenceM24(currentSignatureValue);
      
      if (binaryReferenceM24Value !== null) {
        //console.log(`binaryReferenceM24 value for binaryReferenceM22 ${currentSignatureValue} is: ${binaryReferenceM24Value}`);
        currentTable.records[rows]['Signature'] = binaryReferenceM24Value
      }
      else {
        console.log(`No matching Madden 22 Signature Ability found for value: ${currentSignatureValue}. This should not happen. Please inform Sinthros of this message.`);
      }
      

    }
  }

}

async function fillResignTable(currentTable) {
  const playerTable = targetFranchise.getTableByUniqueId(1612938518);
  const teamTable = targetFranchise.getTableByUniqueId(502886486);
  const resignArrayTable = targetFranchise.getTableByUniqueId(91905499);
  await playerTable.readRecords();
  await teamTable.readRecords();
  await resignArrayTable.readRecords();

  for (var i = 0; i < playerTable.header.recordCapacity; i++) {//Iterate through player
    if (playerTable.records[i].isEmpty) {
      continue
    }
    //Get contract status and year
    currentContractStatus = playerTable.records[i]["ContractStatus"]
    contractYearsLeft = playerTable.records[i]["ContractLength"] - playerTable.records[i]["ContractYear"] 
    
    //If eligible to be resigned...
    if (currentContractStatus === "Signed" && contractYearsLeft === 1) {
      for (var j = 0; j < teamTable.header.recordCapacity;j++) { //Iterate to get their team table value
        if (teamTable.records[j]['TeamIndex'] === playerTable.records[i]['TeamIndex']) {
          var currentTeamBinary =  getBinaryReferenceData(teamTable.header.tableId,j);
          var currentPlayerBinary = getBinaryReferenceData(playerTable.header.tableId,i);
          break
        }
      }


    
    //Get resign table record and set the needed attributes
    resignTableNextRecord = currentTable.header.nextRecordToUse;
    currentTable.records[resignTableNextRecord]["Team"] = currentTeamBinary
    currentTable.records[resignTableNextRecord]["Player"] = currentPlayerBinary
    currentTable.records[resignTableNextRecord]["ActiveRequestID"] = -1
    currentTable.records[resignTableNextRecord]["NegotiationWeek"] = 3

    //Get resign row binary for the array table
    var currentResignBinary =  getBinaryReferenceData(currentTable.header.tableId,resignTableNextRecord);
    var n = 0;
    while (true) { // Find first zeroed out value in resign table and insert the binary
      if (resignArrayTable.records[0][`PlayerReSignNegotiation${n}`] === ZERO_REF) {
        resignArrayTable.records[0][`PlayerReSignNegotiation${n}`] = currentResignBinary
        break
      }
      n++;
    }
    }

  }

};

async function handlePlayerTable(currentTable,currentTableNumRows) {
  for (let i = 0; i < currentTableNumRows; i++) { //Iterate through the table
    if (currentTable.records[i].isEmpty) { //If empty, continue
      continue
    }

    //If expiring, make them signed
    contractStatus = currentTable.records[i]['ContractStatus']
    if (contractStatus === 'Expiring') {
      currentTable.records[i]['ContractStatus'] = 'Signed'

    }
  }
};

async function handleTeamTable(currentTable,currentTableNumRows) {
  let coachTable = targetFranchise.getTableByUniqueId(1860529246);
  await coachTable.readRecords();
  let defaultOffensiveCoordinator = ZERO_REF;
  let defaultDefensiveCoordinator = ZERO_REF;
  let defaultSpecialTeams = ZERO_REF;

  for (let j = 0; j < coachTable.header.recordCapacity;j++) { //Find default offensive/defensive coordinator rows

    if (coachTable.records[j]['Name'] === "" && coachTable.records[j]['TeamIndex'] === 0 && coachTable.records[j]['ActiveTalentTree'] === ZERO_REF) {
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

  proBowlTeams = ['AFC','NFC']
  for (let i = 0; i < currentTableNumRows; i++) { //Iterate through team table
    if (currentTable.records[i].isEmpty) { //If empty, continue
      continue
    }
    // If the current row is a pro bowl team, zero out their HC column and set their OC/DC to the default row values from before
    if (proBowlTeams.includes(currentTable.records[i]['DisplayName'])) {
      currentTable.records[i]['HeadCoach'] = ZERO_REF;
      currentTable.records[i]['OffensiveCoordinator'] = defaultOffensiveCoordinator;
      currentTable.records[i]['DefensiveCoordinator'] = defaultDefensiveCoordinator;
    }
    currentTable.records[i]['SpecialTeamsCoach'] = defaultSpecialTeams;

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
      //currentTeamTable.records[k]['HeadCoach'] = ZERO_REF;
      currentTeamTable.records[k]['OffensiveCoordinator'] = defaultOffensiveCoordinator;
      currentTeamTable.records[k]['DefensiveCoordinator'] = defaultDefensiveCoordinator;
      currentTeamTable.records[k]['SpecialTeamsCoach'] = defaultSpecialTeams;

    }

  }
  
};

async function fixPlayerTableRow(targetFranchise) {
  const player = targetFranchise.getTableByUniqueId(PLAYER_TABLE);
  await player.readRecords();
  
  if (!player.records[755].isEmpty && player.records[755]['PLYR_ASSETNAME'] !== '_0') {
    const nextPlayerRecord = player.header.nextRecordToUse;
    const referencedRow = targetFranchise.getReferencesToRecord(player.header.tableId,755);

    const originalPlayerBin = getBinaryReferenceData(player.header.tableId,755);
    const newPlayerBin = getBinaryReferenceData(player.header.tableId,nextPlayerRecord);

    const columnHeaders = await formatHeaders(player) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      player.records[nextPlayerRecord][currentCol] = player.records[755][currentCol];
    }

    for (const table of referencedRow) {
      const currentTableId = table.tableId;
      const currentRelatedTable = targetFranchise.getTableById(currentTableId);
      await currentRelatedTable.readRecords();

      const currentRelatedHeaders = await formatHeaders(currentRelatedTable) //Get the headers from the table


      try {
        for (let n = 0; n < currentRelatedHeaders.length;n++) {
          for (let row = 0; row < currentRelatedTable.header.recordCapacity; row++) { // Iterate through the table rows
              let currentCol = currentRelatedHeaders[n];
              if (currentRelatedTable.records[row].fields[currentCol]["isReference"] === true) {
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

  player.records[755]['MorphHead'] = ZERO_REF;
  player.records[755]['FirstName'] = '';
  player.records[755]['LastName'] = '';
  player.records[755]['PLYR_ASSETNAME'] = '_0';
  player.records[755]['ContractStatus'] = 'None';
  player.records[755]['TeamIndex'] = 32;
  player.records[755]['WeeklyGoals'] = ZERO_REF;
  player.records[755]['CareerStats'] = ZERO_REF;
  player.records[755]['SeasonStats'] = ZERO_REF;
  player.records[755]['CharacterVisuals'] = ZERO_REF;
  player.records[755]['SeasonalGoal'] = ZERO_REF;

};

async function deleteExcessFreeAgents(targetFranchise) {
  const playerTable = targetFranchise.getTableByUniqueId(1612938518);
  const freeAgentsTable = targetFranchise.getTableByUniqueId(4201237426);
  await playerTable.readRecords();
  await freeAgentsTable.readRecords();


  const freeAgentNumMembers = freeAgentsTable.header.numMembers;
  const filteredRecords = playerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  const numSignedPlayers = filteredRecords.filter(record => record.ContractStatus === 'Signed') // Filter nonempty players for where they're signed
  const numFreeAgents = filteredRecords.filter(record => record.ContractStatus === 'FreeAgent') // Filter nonempty players for where they're free agents
  var allFreeAgentsBinary = [];
  const worstFreeAgentsBinary = [];

  const numTotalPlayersDesired = 3500 //Max amount of free agents (this is relevant for a fantasy draft)
  const totalNumCurrentPlayers = numSignedPlayers.length + numFreeAgents.length //Get the current number of players

  numFreeAgents.forEach((freeAgentRecord) => {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord);
    currentBin = getBinaryReferenceData(playerTable.header.tableId,rowIndex)
    allFreeAgentsBinary.push(currentBin)
    
  });
  

  if (totalNumCurrentPlayers > numTotalPlayersDesired) { // If we're above 3500 total players...
    const numExtraPlayers = totalNumCurrentPlayers - numTotalPlayersDesired; // Get the excess amount of players 
    const worstFreeAgents = numFreeAgents.sort((a, b) => a.OverallRating - b.OverallRating).slice(0, numExtraPlayers);  // Get the worst free agents up till the amount of extra players

    worstFreeAgents.forEach((freeAgentRecord) => {
      const rowIndex = playerTable.records.indexOf(freeAgentRecord); 
      currentBin = getBinaryReferenceData(playerTable.header.tableId,rowIndex);
      worstFreeAgentsBinary.push(currentBin);
      playerTable.records[rowIndex]['ContractStatus'] = 'Deleted' //Mark as deleted and empty the row
      playerTable.records[rowIndex].empty()
    });

    //Filter for where we aren't including the worstFreeAgentBin
    allFreeAgentsBinary = allFreeAgentsBinary.filter((bin) => !worstFreeAgentsBinary.includes(bin));
  
    while (allFreeAgentsBinary.length < freeAgentNumMembers) { //Fill up the remainder with zeroed out binary
      allFreeAgentsBinary.push(ZERO_REF)
    }

    //One liner to set the FA table binary = our free agent binary
    allFreeAgentsBinary.forEach((val, index) => { freeAgentsTable.records[0].fieldsArray[index].value = val; })
    //console.log(worstFreeAgents.length)
  }
};

async function getNeededColumns(currentTableName,is22To24) {

  switch (currentTableName) {
    case "Player":
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = ["SeasonStats","GameStats","CharacterVisuals","SeasonalGoal"];
      return [keepColumns,deleteColumns,zeroColumns];
    case "Team":
      keepColumns = ["Philosophy","HeadCoach","OffensiveCoordinator","DefensiveCoordinator","Roster","PracticeSquad","DepthChart","ActiveRosterSize","SalCapRosterSize","SalCapNextYearRosterSize","TeamIndex","isRowEmpty","nextRecordToUse"];
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
      if (is22To24) {
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

async function assignFranchiseUsers(currentFranchise) {
  let currentTable = targetFranchise.getTableByUniqueId(3429237668);
  await currentTable.readRecords();
  let franchiseUserArray = currentFranchise.getTableByUniqueId(2655789119)
  let teamTable = currentFranchise.getTableByUniqueId(502886486);
  let coach = targetFranchise.getTableByUniqueId(1860529246);
  let owner = targetFranchise.getTableByUniqueId(2357578975);
  let franchiseTable = targetFranchise.getTableByUniqueId(2684583414)

  await franchiseUserArray.readRecords();
  await teamTable.readRecords();
  await coach.readRecords();
  await owner.readRecords();
  await franchiseTable.readRecords();

  let currentTableNumRows = currentTable.header.recordCapacity
  let teamTableNumRows = teamTable.header.recordCapacity
  let coachTableNumRows = coach.header.recordCapacity
  let ownerTableNumRows = owner.header.recordCapacity

  for (var i = 0; i < currentTableNumRows;i++) {
    if (currentTable.records[i].isEmpty) {
      continue
    }
    var foundUser = true;
    currentBin = getBinaryReferenceData(currentTable.header.tableId,i)
    for (let row = 0; row < franchiseUserArray.header.numMembers;row++) {
      if (franchiseUserArray.records[0][`User${row}`] === currentBin) {
        foundUser = true
        break

      }
    }
    if (foundUser === true) {
      teamBin = currentTable.records[i]["Team"] // Get current team from the FranchiseUser table
      for (let teamRow = 0; teamRow < teamTableNumRows;teamRow++) {
        currentRowBinary = getBinaryReferenceData(teamTable.header.tableId,teamRow)
        if (currentRowBinary === teamBin) {
          headCoach = teamTable.records[teamRow]['HeadCoach']
          if (headCoach !== ZERO_REF) {
            teamTable.records[teamRow]['UserCharacter'] = headCoach
            currentTable.records[i]['UserEntity'] = headCoach

            if (currentTable.records[i]['AdminLevel'] === 'Owner') {
              franchiseTable.records[0]['LeagueOwner'] = headCoach
            }

            for (let coachRow = 0; coachRow < coachTableNumRows; coachRow++) {
              currentCoachRowBinary = getBinaryReferenceData(coach.header.tableId,coachRow)
              if (currentCoachRowBinary === headCoach) {
                coach.records[coachRow]['IsUserControlled'] = true
              }
            }
            break
          }
          else {
            defaultOwner = teamTable.records[teamRow]["Owner"]
            teamTable.records[teamRow]['UserCharacter'] = defaultOwner
            currentTable.records[i]['UserEntity'] = defaultOwner
            if (currentTable.records[i]['AdminLevel'] === 'Owner') {
              franchiseTable.records[0]['LeagueOwner'] = defaultOwner
            }
            for (let ownerRow = 0; ownerRow < ownerTableNumRows; ownerRow++) {
              currentOwnerRowBinary = getBinaryReferenceData(owner.header.tableId,ownerRow)
              if (currentOwnerRowBinary === defaultOwner) {
                owner.records[ownerRow]['IsUserControlled'] = true
              }
            }
            break

          }
        }
      }

    }


  }


};


async function formatHeaders(table) {
  if (table.offsetTable) {
      if (this.showHeaderTypes) {
          return table.offsetTable.map((offset) => {
              return `${offset.name} <div class="header-type">${offset.type}</div>`;
          });
      } else {
          return table.offsetTable.map((offset) => {
              return offset.name;
          });
      }
  } else {
      return [];
  }
};

async function containsNonUTF8(value) {
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
    if (currentTable.records[i].isEmpty === false) {
      currentTable.records[i]['teamIdentity'] = binaryReference

    }
  }
};

async function handleDraftPicks(sourceFranchise,targetFranchise,uniqueId) {
  const draftPickSource = sourceFranchise.getTableByUniqueId(uniqueId);
  const draftPickTarget = targetFranchise.getTableByUniqueId(uniqueId); // Get source/target DraftPick table
  const draftPickSourceRows = draftPickSource.header.recordCapacity;
  const draftPickTargetRows = draftPickTarget.header.recordCapacity;
  const filteredRows = [];

  for (let i = 0; i < draftPickTargetRows; i++) {
    if (draftPickTarget.records[i]['YearOffset'] !== 2) {
      filteredRows.push(i);
    }
  }

  for (let currentSourceRow = 0; currentSourceRow < draftPickSourceRows; currentSourceRow++) {
    let originalTeam = draftPickSource.records[currentSourceRow]['OriginalTeam'];
    let currentTeam = draftPickSource.records[currentSourceRow]['CurrentTeam'];
    let yearOffset = draftPickSource.records[currentSourceRow]['YearOffset'];
    let roundNum = draftPickSource.records[currentSourceRow]['Round'];
    let pickNumber = draftPickSource.records[currentSourceRow]['PickNumber'];
    for (let currentTargetRow = 0; currentTargetRow < draftPickTargetRows; currentTargetRow++) {

      if (filteredRows.includes(currentTargetRow)) {
        draftPickTarget.records[currentTargetRow]['OriginalTeam'] = originalTeam;
        draftPickTarget.records[currentTargetRow]['CurrentTeam'] = currentTeam;
        draftPickTarget.records[currentTargetRow]['YearOffset'] = yearOffset;
        draftPickTarget.records[currentTargetRow]['Round'] = roundNum;
        draftPickTarget.records[currentTargetRow]['PickNumber'] = pickNumber;
        const indexToRemove = filteredRows.indexOf(currentTargetRow);
        filteredRows.splice(indexToRemove, 1);
        break;
      }
    }
  }
};

async function handleOriginalCurrentTeamBin(currentTable, rows, currentCol) {
  const targetIndices = [
    // M22 has 68 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
    0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 32, 33, 34, 35, 36
  ];

  let currentTeamBinVal = currentTable.records[rows][currentCol]; // Get currentBinVal

  const teamRowBinaryRef = currentTeamBinVal.slice(15);

  const actualRowRef = await FranchiseUtils.bin2Dec(teamRowBinaryRef);
  const targetRowRef = targetIndices[actualRowRef];

  const updatedBinaryRef = zeroPad(FranchiseUtils.dec2bin(targetRowRef), 17);

  const finalBinary = currentTeamBinVal.replace(teamRowBinaryRef, updatedBinaryRef);

  currentTable.records[rows][currentCol] = finalBinary;
}

async function getCoachTables(mergedTableMappings,is22To24) {
  
  const coach = targetFranchise.getTableByUniqueId(1860529246);
  const coachArray = targetFranchise.getTableByUniqueId(2191908271);
  const team = targetFranchise.getTableByUniqueId(502886486);
  const activeTalentTree = targetFranchise.getTableByUniqueId(1386036480);
  const talentNodeStatus = targetFranchise.getTableByUniqueId(4148550679);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(232168893);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(1725084110);


  let tableArray = [coach,coachArray,team]

  if (!is22To24) {
    tableArray.push(activeTalentTree,talentNodeStatus,talentNodeStatusArray,talentSubTreeStatus)
  }

  await team.readRecords();


  const targetIndices = [ // M22 has 68 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
  0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36
  ];

  let teamSource = sourceFranchise.getTableByUniqueId(502886486);
  await teamSource.readRecords();
  const zeroPad = (num, places) => String(num).padStart(places, '0')

  for (let i = 0;i<team.header.recordCapacity;i++) {
    if (team.records[i].isEmpty === false ) {
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
            var finalBinValue = ZERO_REF;
          
          }

          currentTrainingTable.records[0][`Player${trainingRow}`] = finalBinValue

        }
          
        }


      }


    }
  

  return tableArray;
};

async function handleTable(sourceFranchise,targetFranchise,currentTable,ignoreColumns,sourceGameYear,targetGameYear,mergedTableMappings,is22To24) { // Main function to handle table

  await currentTable.readRecords(); //Read table records
  const tableName = currentTable.header.name
  
  
  const currentTableNumRows = currentTable.header.recordCapacity // Get name and number of rows from table
  const currentTableName = currentTable.header.name
  var sourceUniqueId; //Sometimes the unique IDs don't match up - Cause fuck me, I guess!
  
  const uniqueId = currentTable.header.tablePad1 // Get table unique ID
  const [keepColumns,deleteColumns,zeroColumns] = await getNeededColumns(currentTableName,is22To24) // Get the columns we need for the current table

  const options = {outputFilePath: `${dir}\\${currentTableName}.xlsx`} //Define our output path for the temp Excel file
  const filePath = `${dir}\\${currentTableName}.xlsx` //Define the filepath

  switch (uniqueId) {
    case ACTIVE_ABILITY_UNIQUE_ID_M24: //activeAbility table has a different unique id between M22 and M24
      if (is22To24) {
        sourceUniqueId = ACTIVE_ABILITY_UNIQUE_ID_M22;
      }
      else {
        sourceUniqueId = uniqueId;
      }
      break;
    case MARKETED_PLAYERS_ARRAY_M24:
      if (is22To24) {
        sourceUniqueId = MARKETED_PLAYERS_ARRAY_M22;
      }
      else {
        sourceUniqueId = uniqueId;
      }
      break
    case DRAFTED_PLAYERS_ARRAY_M24:
      if (is22To24) {
        sourceUniqueId = DRAFTED_PLAYERS_ARRAY_M22;
      }
      else {
        sourceUniqueId = uniqueId;
      }
      break;
      
    default: //This is almost ALWAYS the case
      sourceUniqueId = uniqueId;
      break;
  }

  currentTable = sourceFranchise.getTableByUniqueId(sourceUniqueId); // Now get the table in the SOURCE file and read it
  var sourceTableNumRows = currentTable.header.recordCapacity // Get name and number of rows from table
  await currentTable.readRecords();
  const columnHeaders = await formatHeaders(currentTable) //Get the headers from the table

  if (sourceUniqueId === ACTIVE_ABILITY_UNIQUE_ID_M22 && is22To24) { 
    //If it's the activeAbilities table AND we're transferring from 22 to 24...
    currentTable.records[96]['Player0'] = ZERO_REF; // These two rows aren't empty on 24, but are on 22
    currentTable.records[97]['Player0'] = ZERO_REF;

    for (let i = 18; i <= 77;i++) {
      currentTable.records[i]['Player0'] = ZERO_REF
      currentTable.records[i]['Player1'] = ZERO_REF
      currentTable.records[i]['Player2'] = ZERO_REF
    }
  }

  if (sourceUniqueId === MARKETED_PLAYERS_ARRAY_M22 && is22To24) {
    for (let i = 8; i < 40;i++) {
      for (let j = 0;j < 5;j++) {
        currentTable.records[i][`Player${j}`] = ZERO_REF;
      }  
    }
    for (let j = 0;j < 5;j++) {
        currentTable.records[48][`Player${j}`] = ZERO_REF;
    }
  }

  if (sourceUniqueId === DRAFTED_PLAYERS_ARRAY_M22 && is22To24) {
    for (let j = 0;j < 25; j++ ) {
      for (let i = 8; i < 40;i++) {
        currentTable.records[i][`Player${j}`] = ZERO_REF
      }
      currentTable.records[48][`Player${j}`] = ZERO_REF

    }
  }

  for (var i = 0; i < columnHeaders.length; i++) { // Iterate through the columns of the table

    for (var rows = 0; rows < sourceTableNumRows; rows++) { // Iterate through the table rows
      const currentCol = columnHeaders[i]; // Current column
  
      if (sourceUniqueId === PLAYER_TABLE && (currentCol === 'PLYR_ASSETNAME' || currentCol === 'LastName' || currentCol === 'FirstName' )) {
        let currentVal = currentTable.records[rows][currentCol];
        let value1 = Buffer.from(currentVal, 'utf-8');
        const hasInvalidValue = await containsNonUTF8(value1);
  
        if (hasInvalidValue === true) {
          sourceFranchise._settings['autoUnempty'] = false;
          currentTable.records[rows][currentCol] = "";
          sourceFranchise._settings['autoUnempty'] = true;
        }
      }

      if (sourceUniqueId === PLAYER_TABLE && currentCol === 'CareerStats' && currentTable.records[rows].isEmpty) {
        sourceFranchise._settings['autoUnempty'] = false;
        currentTable.records[rows][currentCol] = ZERO_REF;
        sourceFranchise._settings['autoUnempty'] = true;

      }
      
  
      if (currentCol === 'InjurySeverity' || currentCol === 'CaptainsPatch' || currentCol === 'PLYR_HOME_STATE' || currentCol === 'PlayerVisMoveType' || currentCol === 'TRAIT_COVER_BALL') {
        // We have to do this because Madden is...
        sourceFranchise._settings['autoUnempty'] = false;
        let numberCheck = await FranchiseUtils.hasNumber(currentTable.records[rows][currentCol]);
  
        if (numberCheck === true) {
          if (currentCol === 'PlayerVisMoveType') {
            currentTable.records[rows][currentCol] = 'Default'
          }
          else if (currentCol === 'TRAIT_COVER_BALL') {
            currentTable.records[rows][currentCol] = 'Never'

          }
          else if (currentCol !== 'PLYR_HOME_STATE') {
            currentTable.records[rows][currentCol] = 'Invalid_';

          }
          else {
          currentTable.records[rows][currentCol] = 'INVALID';
          }
        }
  
        sourceFranchise._settings['autoUnempty'] = true;
      }
  
      try {
        if (currentTable.records[rows].fields[currentCol]["isReference"] === true) { // If it's a bin reference column...
          // If it should be ignored, or if it's empty, or all zeroes, continue
          if (ignoreColumns.includes(currentCol) || currentTable.records[rows].isEmpty || currentTable.records[rows][currentCol] === ZERO_REF ) {
            continue
          }
         
          if (currentTableName === 'YearSummary' && (currentCol === 'NFC_Team' || currentCol === 'AFC_Team') && is22To24) {

            let currentTeamBinVal = currentTable.records[rows][currentCol] // Get currentBinVal
            const teamRowBinaryRef = currentTeamBinVal.slice(15)
            const actualRowRef = await FranchiseUtils.bin2Dec(teamRowBinaryRef)

            let teamTable = sourceFranchise.getTableByUniqueId(502886486);
            await teamTable.readRecords();

            teamNameLookup = teamTable.records[actualRowRef]['DisplayName']

            var foundData = teamIdentityLookup.find(item => item.teamName === teamNameLookup);

            if (foundData) {
              const binaryReference = foundData.binaryReference;
              currentTable.records[rows][currentCol] = binaryReference
            } else {
              foundData = teamIdentityLookup.find(item => item.teamName === 'AFC');
              const binaryReference = foundData.binaryReference;
              currentTable.records[rows][currentCol] = binaryReference

            }

            continue           
          }

          if ((currentCol === '' || currentCol === 'OriginalTeam' || currentCol === 'CurrentTeam') && is22To24) {
            await  handleOriginalCurrentTeamBin(currentTable, rows, currentCol);
          }

          currentBinVal = currentTable.records[rows][currentCol] // Get currentBinVal
          let outputBin = zeroPad(FranchiseUtils.dec2bin(currentTable.records[rows].fields[currentCol]["referenceData"]["tableId"]), 15); //Get our outputBin and zero-pad it to 15 characters

          const currentTableDict = mergedTableMappings.find(table => table.sourceIdBinary === outputBin);
          try {
            replaceBin = currentTableDict.targetIdBinary

          }
          catch (e) {
            //console.log(columnHeaders[i])
            continue
            
          }
          
            // Else, replace the outputBin with the currentDictValue
            currentTable.records[rows][currentCol] = currentBinVal.replace(outputBin,replaceBin)
          }

        
      } catch (e) {
        console.log(e)
        continue

      }
  
    }

  }


  // Handle specific table types
  switch (currentTableName) {
    case 'PlayerReSignNegotiation':
      await emptyResignTable(currentTable, currentTableNumRows);
      break;
    case 'Player':
      await handlePlayerTable(currentTable, currentTableNumRows);
      break;
    case 'Team':
      await handleTeamTable(currentTable, sourceTableNumRows);
      break;
    case 'ActiveSignatureData':
      if (is22To24) {
        await adjustSignatureTableBinary(currentTable, sourceTableNumRows);
      }
      break;
    case 'DraftPick':
      if (is22To24) {
        await handleDraftPicks(sourceFranchise, targetFranchise, uniqueId);
        return; // If we handle it through this function, there's no need to export the table/import it, so we return here
      }
      break;
  }

  exportTableData(options, currentTable, sourceGameYear, targetGameYear); // Export the table to Excel

  currentTable = targetFranchise.getTableByUniqueId(uniqueId); // Back to the target franchise
  await currentTable.readRecords();


  switch (currentTableName) {
    case 'ActiveSignatureData':
      await emptySignatureTable(currentTable, currentTableNumRows);
      break;
  }
  await importTables(currentTable,filePath,keepColumns,deleteColumns,zeroColumns) //Import the table in

  switch (currentTableName) {
    case 'PlayerReSignNegotiation':
      await fillResignTable(currentTable);
      break;
    case 'LeagueHistoryAward':
      await handleLeagueHistoryBin(currentTable, teamIdentityLookup);
      break;
  }
};



async function getPlayerTables() {
  const player = targetFranchise.getTableByUniqueId(PLAYER_TABLE);
  const freeagents = targetFranchise.getTableByUniqueId(4201237426);
  const playerArray = targetFranchise.getTableByUniqueId(4062699918);
  const playerPracticeSquads = targetFranchise.getTableByUniqueId(3892093744);
  const depthChart = targetFranchise.getTableByUniqueId(2940627083);
  const teamRoadMap = targetFranchise.getTableByUniqueId(3807550398);
  const playerResignNegotiation = targetFranchise.getTableByUniqueId(846670960);
  const mainActiveSignature = targetFranchise.getTableByUniqueId(2421474727);
  const secondaryActiveSignature = targetFranchise.getTableByUniqueId(3439793083);
  const signatureArray = targetFranchise.getTableByUniqueId(1691308264);
  const careerDefensiveKPReturnStats = targetFranchise.getTableByUniqueId(2070026668);
  const careerOffensiveKPReturnStats = targetFranchise.getTableByUniqueId(2742909435);
  const careerOLineStats = targetFranchise.getTableByUniqueId(694886857);
  const careerOffensiveStats = targetFranchise.getTableByUniqueId(1181574195);
  const careerDefensiveStats = targetFranchise.getTableByUniqueId(2237963694);
  const careerKickingStats = targetFranchise.getTableByUniqueId(2471741740);
  const playerMerchTable = targetFranchise.getTableByUniqueId(2046620302);
  const topMarketedPlayers = targetFranchise.getTableByUniqueId(1505961096);
  const activeAbilityArray = targetFranchise.getTableByUniqueId(3545956611);
  const draftedPlayers = targetFranchise.getTableByUniqueId(DRAFTED_PLAYERS_ARRAY_M24);
  const marketedPlayers = targetFranchise.getTableByUniqueId(MARKETED_PLAYERS_ARRAY_M24);

  const tableArray = [mainActiveSignature,secondaryActiveSignature,signatureArray,player,freeagents,playerArray,playerPracticeSquads,
    depthChart,teamRoadMap,playerResignNegotiation,careerDefensiveKPReturnStats,careerOffensiveKPReturnStats,careerOLineStats,careerOffensiveStats,careerDefensiveStats,
    careerKickingStats,playerMerchTable,topMarketedPlayers,activeAbilityArray,marketedPlayers,draftedPlayers]

  return tableArray;

};

async function getTradeTables() {
  let tradeNegotiationArray = targetFranchise.getTableByUniqueId(2760331084);
  let tradeNegotiation = targetFranchise.getTableByUniqueId(1352033064);
  let teamTradePackageArray = targetFranchise.getTableByUniqueId(2688963323);
  let requestArray = targetFranchise.getTableByUniqueId(1322332973);
  let pendingTeamArray = targetFranchise.getTableByUniqueId(2550787910);
  let teamTradePackage = targetFranchise.getTableByUniqueId(1415020191);
  let tableArray = [tradeNegotiationArray,tradeNegotiation,teamTradePackageArray,
    requestArray,pendingTeamArray,teamTradePackage];
    return tableArray;

}

async function getAwardTables() {
  let playerAward = targetFranchise.getTableByUniqueId(657983086);
  let coachAward = targetFranchise.getTableByUniqueId(3027881868);
  let awardArray = targetFranchise.getTableByUniqueId(1586942378);

  let tableArray = [playerAward,coachAward,awardArray];

  return tableArray

};

async function getOptionalTables() {
  const seasonInfo = targetFranchise.getTableByUniqueId(3123991521);
  const salaryInfo = targetFranchise.getTableByUniqueId(3759217828);
  const sourceSeasonInfo = sourceFranchise.getTableByUniqueId(3123991521);
  const leagueHistoryAward = targetFranchise.getTableByUniqueId(335278464);
  const leagueHistoryArray = targetFranchise.getTableByUniqueId(444189422);
  const yearSummary = targetFranchise.getTableByUniqueId(2136473174);
  const yearSummaryArray = targetFranchise.getTableByUniqueId(2073486305);
  const historyTables = [];

  await sourceSeasonInfo.readRecords();
  await seasonInfo.readRecords();

  const targetCurrentStage = seasonInfo.records[0]['CurrentStage'];

  if (targetCurrentStage !== 'PreSeason') {
    const currentWeekType = seasonInfo.records[0]['CurrentWeekType'];
    console.log(`ERROR! Target file MUST be in the PreSeason to execute this program. Your target file is currently in the ${currentWeekType}.`);
    console.log("Ensure your target franchise file is in the PreSeason before using this program. Enter anything to exit.");
    prompt();
    process.exit(0);
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
        console.log("Exiting program. Enter anything to quit.");
        prompt();
        process.exit(0);
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

async function columnOptions() {
  const ignoreColumns = ['TeamPhilosophy','Signature','College', 'Philosophy']
  return [ignoreColumns]

};

async function emptyRookieStatTracker(targetFranchise) {
  const rookieStatTracker = targetFranchise.getTableByUniqueId(3785623318);
  const rookieStatTrackerArray = targetFranchise.getTableByUniqueId(540270022);

  await rookieStatTracker.readRecords();
  await rookieStatTrackerArray.readRecords();

  let rookieStatTrackerNumRows = rookieStatTracker.header.recordCapacity;

  for (let i = 0; i < rookieStatTrackerNumRows; i++) {
    if (rookieStatTracker.records[i].isEmpty === false) {
      rookieStatTracker.records[i]['DownsPlayed'] = 0
      await rookieStatTracker.records[i].empty()
    }
  }

  for (let rookieArrayRow = 0; rookieArrayRow < rookieStatTrackerArray.header.numMembers;rookieArrayRow++) {
    rookieStatTrackerArray.records[0][`RookieStatTracker${rookieArrayRow}`] = ZERO_REF
  }
};

async function emptyMediaGoals(targetFranchise) {
  const characterActiveMediaGoal = targetFranchise.getTableByUniqueId(3932345199);
  const characterActiveMediaGoalArray = targetFranchise.getTableByUniqueId(4003712728);

  await characterActiveMediaGoal.readRecords();
  await characterActiveMediaGoalArray.readRecords();

  const activeMediaGoalNumRows = characterActiveMediaGoal.header.recordCapacity;
  const activeMediaGoalArrayNumRows = characterActiveMediaGoalArray.header.recordCapacity;
  
  for (let i = 0; i < activeMediaGoalNumRows; i++) {
    if (characterActiveMediaGoal.records[i].isEmpty === false) {
      characterActiveMediaGoal.records[i]['ActiveMediaGoals'] = ZERO_REF;
      await characterActiveMediaGoal.records[i].empty()
    }
  }

  for (let i = 0; i < activeMediaGoalArrayNumRows;i++) {
    if (characterActiveMediaGoalArray.records[i].isEmpty === false) {
      for (let mediaArrayRow = 0; mediaArrayRow < characterActiveMediaGoalArray.header.numMembers;mediaArrayRow++) {
        characterActiveMediaGoalArray.records[0][`CharacterActiveMediaGoal${mediaArrayRow}`] = ZERO_REF;
      }
      if (i !== 0) {
        characterActiveMediaGoalArray.records[i].empty()

      }
      
   }

  }

}

async function adjustSeasonGameTable(targetFranchise) {
  const seasonInfo = targetFranchise.getTableByUniqueId(3123991521);
  const seasonGame = targetFranchise.getTableByUniqueId(1607878349);

  await seasonInfo.readRecords();
  await seasonGame.readRecords();

  const currentSeasYear = seasonInfo.records[0]['CurrentYear'];

  for (const record of seasonGame.records) {
    if (!record.isEmpty && !record['IsPractice']) {
      record['HomePlayerStatCache'] = ZERO_REF;
      record['InjuryCache'] = ZERO_REF;
      record['AwayPlayerStatCache'] = ZERO_REF;
      record['ScoringSummaries'] = ZERO_REF;
      record['SeasonYear'] = currentSeasYear;
    }
  }
}


async function emptyTalentTreeTables(targetFranchise) { // Function to empty all coach talent trees
  const talentNodeStatus = targetFranchise.getTableByUniqueId(4148550679);
  const activeTalentTree = targetFranchise.getTableByUniqueId(1386036480);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(232168893);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(1725084110);

  await talentNodeStatus.readRecords();
  await activeTalentTree.readRecords();
  await talentNodeStatusArray.readRecords();
  await talentSubTreeStatus.readRecords();

  const activeTalentTreeRows = activeTalentTree.header.recordCapacity
  const talentNodeStatusRows = talentNodeStatus.header.recordCapacity
  const talentNodeStatusArrayRows = talentNodeStatusArray.header.recordCapacity
  const talentSubTreeStatusRows = talentSubTreeStatus.header.recordCapacity

  for (let i = 0; i < activeTalentTreeRows;i++) {
    if (activeTalentTree.records[i].isEmpty === false) {
      referencedRow = targetFranchise.getReferencesToRecord(activeTalentTree.header.tableId,i)
      if (referencedRow.length === 0) {
        activeTalentTree.records[i]['TalentSubTreeStatusThird'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeStatusSecond'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeStatusFirst'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeSecond'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeFirst'] = ZERO_REF;
        activeTalentTree.records[i].empty()
      }

    }
  }

  for (let i = 0; i < talentSubTreeStatusRows;i++) {
    if (talentSubTreeStatus.records[i].isEmpty === false) {
      referencedRow = targetFranchise.getReferencesToRecord(talentSubTreeStatus.header.tableId,i)
      if (referencedRow.length === 0) {
        talentSubTreeStatus.records[i].empty()
      }
    }
  }

  for (let i = 0; i < talentNodeStatusArrayRows;i++) {
    if (talentNodeStatusArray.records[i].isEmpty === false) {
      referencedRow = targetFranchise.getReferencesToRecord(talentNodeStatusArray.header.tableId,i)
      if (referencedRow.length === 0) {
        for (let j = 0; j < talentNodeStatusArray.header.numMembers;j++) {

          talentNodeStatusArray.records[i][`TalentNodeStatus${j}`] = ZERO_REF;

        }
        talentNodeStatusArray.records[i].empty()
      }
   }
  }

  for (let i = 0; i < talentNodeStatusRows;i++) {
    if (talentNodeStatus.records[i].isEmpty === false) {
      referencedRow = targetFranchise.getReferencesToRecord(talentNodeStatus.header.tableId,i)
      if (referencedRow.length === 0) {
        talentNodeStatus.records[i].empty()
      }
    }
  }





}

async function handleTalentTree(targetFranchise,coachTable,coachTableCurrentRecord) {
  const talentNodeStatus = targetFranchise.getTableByUniqueId(4148550679);
  const activeTalentTree = targetFranchise.getTableByUniqueId(1386036480);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(232168893);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(1725084110);
  const activeTalentTreeNextRecord = activeTalentTree.header.nextRecordToUse;
  const activeTalentTreeCurrentBinary = getBinaryReferenceData(activeTalentTree.header.tableId,activeTalentTreeNextRecord);

  await talentNodeStatus.readRecords();
  await activeTalentTree.readRecords();
  await talentNodeStatusArray.readRecords();
  await talentSubTreeStatus.readRecords();

  try {
      
      const coachPosition = coachTable.records[coachTableCurrentRecord].Position // Get coach position

      if (coachPosition === 'HeadCoach') {
        var firstTalentNodeCount = 8; // Get talent tree length - Should always be 9 in M24 (which means 10 actual talents)
        var secondTalentNodeCount = 8;
        var thirdTalentNodeCount = 8;

      }
      else {
        var firstTalentNodeCount = 9; // Get talent tree length - Should always be 9 in M24 (which means 10 actual talents)
        var secondTalentNodeCount = 9;
        var thirdTalentNodeCount = 9;
      }


      //console.log("Next, we're going to set the TALENT TREES for your coach. If you selected Head Coach, you won't have to do anything.")
      const pickedTalents = []; // This allows us to keep track of the talents selected by the user

      for (let i = 0; i < 3; i++) { // For loop to get coach talents
          let talentNum = i === 0 ? 'first' : i === 1 ? 'second' : 'third'; 
      
          let validChoices = coachTalentsPositions[coachPosition][talentNum]; //Our current valid talent choices
      
          // If there is only one valid choice, automatically set the talent and continue to the next loop iteration
          if (validChoices.length === 1) {
              let talentChoice = validChoices[0];
              let coachTalentBinary = coachTalentsLookup.find(obj => obj.coachTalent === talentChoice)?.binaryReference; // Find the respective talent binary

              if (i === 0) { // Depending on our iteration, set it for the first, second, or third TalentSubTree
                  activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeFirst = coachTalentBinary;
              } else if (i === 1) {
                  activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeSecond = coachTalentBinary;
              } else {
                  activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeThird = coachTalentBinary;
              }
              pickedTalents.push(talentChoice); // Push the talentChoice to pickedTalents so it can't be selected again
              continue; // Move on to the next loop iteration
          }
      
          // Exclude previously picked talents from the options presented to the user
          validChoices = validChoices.filter(choice => !pickedTalents.includes(choice));
      
          const randomIndex = Math.floor(Math.random() * validChoices.length); // Generate a random index
          const talentChoice = validChoices[randomIndex]; // Select a random talent from valid choices

          let coachTalentBinary = coachTalentsLookup.find(obj => obj.coachTalent === talentChoice)?.binaryReference; // Find the respective binary
          if (i === 0) { // Depending on our iteration, set it for the first, second, or third TalentSubTree
              activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeFirst = coachTalentBinary;
          } else if (i === 1) {
              activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeSecond = coachTalentBinary;
          } else {
              activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeThird = coachTalentBinary;
          }
          pickedTalents.push(talentChoice); // Push the talentChoice to pickedTalents so it can't be selected again 
          continue       
      }

      var talentNodeStatusNextRecord = talentNodeStatus.header.nextRecordToUse; // Get the next record for the TalentNodeStatus table

    }
    catch (e) {
      console.warn('ERROR! Exiting program due to; ', e);
      prompt();
      process.exit(0);
    }
    
  var talentNodeCountArray = [firstTalentNodeCount,secondTalentNodeCount,thirdTalentNodeCount]
  for (var currentTalentNodeCount = 0; currentTalentNodeCount < talentNodeCountArray.length;currentTalentNodeCount++) {
    try {
      var talentSubTreeStatusNextRecord = talentSubTreeStatus.header.nextRecordToUse;
      var talentNodeStatusArrayNextRecord = talentNodeStatusArray.header.nextRecordToUse;

      currentNodeArrayCount = talentNodeCountArray[currentTalentNodeCount]
      var i = 0;
      var talentNodeArray = [];
      while (i <= currentNodeArrayCount) {
          if (i === 0) {
            var currentBinary = getBinaryReferenceData(talentNodeStatus.header.tableId,talentNodeStatusNextRecord);
            if (currentTalentNodeCount === 2 && coachTable.records[coachTableCurrentRecord].Position !== 'HeadCoach') {
              talentNodeStatus.records[talentNodeStatusNextRecord].TalentStatus = 'Owned';
              talentNodeStatus.records[talentNodeStatusNextRecord].UpgradeCount = '1';

            }
            else {
              talentNodeStatus.records[talentNodeStatusNextRecord].TalentStatus = 'NotOwned';
              talentNodeStatus.records[talentNodeStatusNextRecord].UpgradeCount = '0';

            }

            talentNodeArray.push(currentBinary);
            var talentNodeStatusNextRecord = talentNodeStatus.header.nextRecordToUse;
  
          }
          else {
            var currentBinary = getBinaryReferenceData(talentNodeStatus.header.tableId,talentNodeStatusNextRecord);
            talentNodeStatus.records[talentNodeStatusNextRecord].TalentStatus = 'NotOwned';
            talentNodeStatus.records[talentNodeStatusNextRecord].UpgradeCount = '0';
            talentNodeArray.push(currentBinary);
            var talentNodeStatusNextRecord = talentNodeStatus.header.nextRecordToUse;
          }
          i++;
        }
  
        var j = 0;
        while (j <= 11) {
          if (currentNodeArrayCount >= j) { //Put each talent node from our resulting array into the array table
            var currentArrayElement = talentNodeArray.shift();
            talentNodeStatusArray.records[talentNodeStatusArrayNextRecord][`TalentNodeStatus${j}`] = currentArrayElement;
            j++;
          }
          else if (currentNodeArrayCount < j) { //Once our array is empty, make sure the rest of the row is zeroed out
            talentNodeStatusArray.records[talentNodeStatusArrayNextRecord][`TalentNodeStatus${j}`] = ZERO_REF;;
            j++;
          }
        }
      var talentNodeBinary = getBinaryReferenceData(talentNodeStatusArray.header.tableId,talentNodeStatusArrayNextRecord); //Get the binary for our row in the node status array table
      talentSubTreeStatus.records[talentSubTreeStatusNextRecord].TalentStatusOrderedList = talentNodeBinary; // Use the above binary in the TalentSubTreeStatus table
  
      var currentActiveTalentTreeBinary = getBinaryReferenceData(talentSubTreeStatus.header.tableId,talentSubTreeStatusNextRecord); //The final binary we need for the first active talent tree column
      if (currentTalentNodeCount === 0) {
        activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeStatusFirst = currentActiveTalentTreeBinary

      }
      else if (currentTalentNodeCount === 1) {
        currentActiveTalentTreeBinary = getBinaryReferenceData(talentSubTreeStatus.header.tableId,talentSubTreeStatusNextRecord) //The final binary we need for the second active talent tree column
        activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeStatusSecond = currentActiveTalentTreeBinary

      }

      else {
        currentActiveTalentTreeBinary = getBinaryReferenceData(talentSubTreeStatus.header.tableId,talentSubTreeStatusNextRecord) //The final binary we need for the second active talent tree column
        activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeStatusThird = currentActiveTalentTreeBinary

      }
    } catch (e) {
      console.warn("ERROR! Exiting program due to; ", e);
      prompt();
      process.exit(0);
      
    }

  }
  coachTable.records[coachTableCurrentRecord].ActiveTalentTree = activeTalentTreeCurrentBinary

}

async function adjustCoachTalents(targetFranchise) {
  console.log("Regenerating all Coach Talent Trees...")
  const coachTable = targetFranchise.getTableByUniqueId(1860529246);
  await coachTable.readRecords();

  await emptyTalentTreeTables(targetFranchise)

  const coachNumRows = coachTable.header.recordCapacity

  for (let coachTableCurrentRecord = 0; coachTableCurrentRecord < coachNumRows; coachTableCurrentRecord++) {
    if (!coachTable.records[coachTableCurrentRecord].isEmpty && coachTable.records[coachTableCurrentRecord]['Name'] !== '') {
      await handleTalentTree(targetFranchise,coachTable,coachTableCurrentRecord)
    }
  }

};

async function emptyStoryTable(targetFranchise) {
  const storyArrayTable = targetFranchise.getTableByUniqueId(1350117431)
  await storyArrayTable.readRecords();

  for (let i = 0; i < storyArrayTable.header.recordCapacity;i++) {
    if (!storyArrayTable.records[i].isEmpty) {
        for (let j = 0; j < storyArrayTable.header.numMembers;j++) {
          storyArrayTable.records[i][`Story${j}`] = ZERO_REF;

        }
      }
   }
}
async function emptyHistoryTables(targetFranchise) {
  const historyEntryArray = targetFranchise.getTableByUniqueId(1765841029);
  const transactionHistoryArray = targetFranchise.getTableByUniqueId(766279362);
  await historyEntryArray.readRecords();
  await transactionHistoryArray.readRecords();


  for (let i = 0; i < historyEntryArray.header.recordCapacity;i++) {
    if (historyEntryArray.records[i].isEmpty === false) {
        for (let j = 0; j < historyEntryArray.header.numMembers;j++) {
          historyEntryArray.records[i][`HistoryEntry${j}`] = ZERO_REF;

        }
      }
   }

   for (let i = 0; i < transactionHistoryArray.header.recordCapacity;i++) {
    if (transactionHistoryArray.records[i].isEmpty === false) {
        for (let j = 0; j < transactionHistoryArray.header.numMembers;j++) {
          transactionHistoryArray.records[i][`TransactionHistoryEntry${j}`] = ZERO_REF;

        }
      }
   }
};

async function fixAllPlayerTables(sourceFranchise,allPlayerTables) {
  const mainPlayerTable = sourceFranchise.getTableByUniqueId(PLAYER_TABLE); //Get our main player table
  await mainPlayerTable.readRecords();

  //Iterate through all the extra player tables
  for (let tableIndex = 0; tableIndex < allPlayerTables.length;tableIndex++) {
    const nextPlayerRecord = mainPlayerTable.header.nextRecordToUse;

    //If we've run out of rows, we can't transfer the file over
    if (nextPlayerRecord === mainPlayerTable.header.recordCapacity) {
      console.log("******************************************************************************************")
      console.log("ERROR! Source file has too many players and CANNOT be transferred to Madden 24.");
      console.log("For more information on this issue, read the README.txt file.")
      console.log("******************************************************************************************")
      console.log("Exiting program.");
      prompt();
      process.exit(0);
    }

    const currentTable = allPlayerTables[tableIndex];
    await currentTable.readRecords();
    if (currentTable.header.uniqueId === PLAYER_TABLE) {
      continue
    }
    const referencedRow = sourceFranchise.getReferencesToRecord(currentTable.header.tableId,0);
    if (referencedRow.length === 0) {
      continue
    }

    const originalPlayerBin = getBinaryReferenceData(currentTable.header.tableId,0);
    const newPlayerBin = getBinaryReferenceData(mainPlayerTable.header.tableId,nextPlayerRecord);
    
      

    const columnHeaders = await formatHeaders(currentTable) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      mainPlayerTable.records[nextPlayerRecord][currentCol] = currentTable.records[0][currentCol];
    }

    for (const table of referencedRow) {
      const currentTableId = table.tableId;
      const currentRelatedTable = sourceFranchise.getTableById(currentTableId);
      await currentRelatedTable.readRecords();

      const currentRelatedHeaders = await formatHeaders(currentRelatedTable) //Get the headers from the table


      try {
        for (let n = 0; n < currentRelatedHeaders.length;n++) {
          for (let row = 0; row < currentRelatedTable.header.recordCapacity; row++) { // Iterate through the table rows
              let currentCol = currentRelatedHeaders[n];
              if (currentRelatedTable.records[row].fields[currentCol]["isReference"] === true) {
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
}

async function removeUnnecessaryAssetNames(targetFranchise) {
  const player = targetFranchise.getTableByUniqueId(PLAYER_TABLE);
  await player.readRecords();

  for (let i = 0;i < player.header.recordCapacity;i++) {
    if (player.records[i].isEmpty === false) {
      let assetName = player.records[i]['PLYR_ASSETNAME'];
      if (!allAssetNames.includes(assetName)) {
        player.records[i]['PLYR_ASSETNAME'] = "";
      }
    }
    
  }
}

async function adjustPlayerIds(targetFranchise, fieldToCheck, fieldToAdjust, lookupObject) {
  const player = targetFranchise.getTableByUniqueId(PLAYER_TABLE);
  await player.readRecords();

  for (let i = 0; i < player.header.recordCapacity; i++) {
    if (player.records[i].isEmpty === false) {
      let fieldValue = player.records[i][fieldToCheck];
      if (lookupObject.hasOwnProperty(fieldValue)) {
        const id = lookupObject[fieldValue];
        player.records[i][fieldToAdjust] = id;
      }
    }
  }
}

async function regenerateAgilityRatings(targetFranchise) {
  const player = targetFranchise.getTableByUniqueId(PLAYER_TABLE);
  await player.readRecords();

  for (let i = 0; i < player.header.recordCapacity; i++) {
    if (!player.records[i].isEmpty && OFFENSIVE_SKILL_POSITIONS.includes(player.records[i]['Position']) ) {
      const speedRating = player.records[i]['SpeedRating'];
      const accelerationRating = player.records[i]['AccelerationRating'];

      const agilityRating = Math.round((speedRating + accelerationRating) / 2);
      player.records[i]['AgilityRating'] = agilityRating
    }
  }

}
sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    const allPlayerTables = sourceFranchise.getAllTablesByName('Player');


    if (allPlayerTables.length > 1) {
      console.log("******************************************************************************************")
      console.log("Warning: Source file has more than one Player table, but this should still transfer over properly.");
      console.log("******************************************************************************************")
      await fixAllPlayerTables(sourceFranchise,allPlayerTables);
      await sourceFranchise.save();
      process.exit(0)
    }

    const sourceGameYear = sourceFranchise.schema.meta.gameYear // Get the game year of the source file
    const targetGameYear = targetFranchise.schema.meta.gameYear // Get the game year of the target file
    if (targetGameYear !== 24) {
      console.log("******************************************************************************************")
      console.log("ERROR! Target franchise isn't a Madden 24 Franchise File. Exiting program.");
      console.log("******************************************************************************************")
      prompt()
      process.exit(0);
    }

    if (sourceGameYear !== 22 && sourceGameYear !== 24) {
      console.log("******************************************************************************************")
      console.log("ERROR! Source franchise isn't a Madden 22 or Madden 24 Franchise File. Exiting program.");
      console.log("******************************************************************************************")
      prompt()
      process.exit(0);
    }

    // Get the tableMappings for the source and target files - These are used to update bin references!
    const allTableMappingsTarget = targetFranchise.tables.map((table) => 
    { return { name: table.name, uniqueId: table.header.uniqueId, targetId: table.header.tableId, targetIdBinary: zeroPad(FranchiseUtils.dec2bin(table.header.tableId),15)  } })
    
    const allTableMappingsSource = sourceFranchise.tables.map((table) => 
    { return { name: table.name, uniqueId: table.header.uniqueId, sourceId: table.header.tableId, sourceIdBinary: zeroPad(FranchiseUtils.dec2bin(table.header.tableId),15)  } })

    // This is our mergedTableMappings, so that we can lookup the targetIdBinary and replace the sourceIdBinary with it
    const mergedTableMappings = allTableMappingsTarget.map(targetTable => {
      const sourceTable = allTableMappingsSource.find(sourceTable => sourceTable.uniqueId === targetTable.uniqueId);
      
      if (sourceTable) {
        return { // Store all relevant data here
          name: targetTable.name,
          uniqueId: targetTable.uniqueId,
          targetId: targetTable.targetId,
          targetIdBinary: targetTable.targetIdBinary,
          sourceId: sourceTable.sourceId,
          sourceIdBinary: sourceTable.sourceIdBinary
        };
      } else {
        return targetTable; // If corresponding source table not found, keep target table data as is
      }
    });

    const is22To24 = sourceGameYear === 22 && targetGameYear === 24;


    const coachTables = await getCoachTables(mergedTableMappings,is22To24);
    const playerTables = await getPlayerTables();
    const awardTables = await getAwardTables();
    const optionalTables = await getOptionalTables();
    //const tradeTables = await getTradeTables();
  
    const draftPickTable = targetFranchise.getTableByUniqueId(343624504);
    const draftPicks = [draftPickTable]

    const allTablesArray = [playerTables,coachTables,awardTables,optionalTables,draftPicks]
    const [ignoreColumns] = await columnOptions()

 


    console.log("Now working on transferring all table data...")


    try {
      for (let array = 0;array < allTablesArray.length;array++) { //Iterate throuh allTablesArray
        currentArray = allTablesArray[array] //Get current array
        for (let table = 0;table < currentArray.length;table++) { //Then iterate through the currentArray
          let currentTable = currentArray[table] // Get and read the current table, then call handleTable()
          await currentTable.readRecords();
          await handleTable(sourceFranchise,targetFranchise,currentTable,ignoreColumns,sourceGameYear,targetGameYear,mergedTableMappings,is22To24)        
        }
      }

    } catch (e) { // Except, print the and exit
      console.log("******************************************************************************************")
      console.log(`FATAL ERROR! Please report this message to Sinthros IMMEDIATELY and send your source/target Franchise Files - ${e}`)
      console.log("Exiting program.")
      console.log("******************************************************************************************")
      prompt();
      process.exit(0);

    }


    
    try {
      await assignFranchiseUsers(targetFranchise); // Function to assign correct franchise users
      await emptyRookieStatTracker(targetFranchise); // Function to empty Rookie Tracker table (Avoid crashing)
      await emptyMediaGoals(targetFranchise); // Function to empty Media Goals table (Avoid crashing)
      await adjustSeasonGameTable(targetFranchise); // Function to update SeasGame table based on current SeasonYear
      if (is22To24) {
        await adjustCoachTalents(targetFranchise); // Function to empty coach talents and reassign them

      }
      await emptyHistoryTables(targetFranchise); // Function to empty history tables (Avoid crashing)
      await deleteExcessFreeAgents(targetFranchise); // Only keep the top 3500 players
      await emptyAcquisitionTables(targetFranchise);

      if (is22To24) {
        const validOptions = ['YES', 'NO'];
        let namePrompt;
        
        do {
          console.log(
            "Would you like to remove asset names from the Player table that aren't in Madden 24's Database?\n" +
            "Enter YES or NO. If you don't know exactly what the above statement means, it's safe to just enter YES."
          );
        
          namePrompt = prompt().toUpperCase(); // Get user input and convert to uppercase
        
          if (namePrompt === 'NO') {
            console.log("Keeping all asset names as is...");
          } else if (namePrompt === 'YES') {
            console.log("Removing asset names that don't appear in Madden 24's Database...");
            await removeUnnecessaryAssetNames(targetFranchise);
          }
        } while (!validOptions.includes(namePrompt));
        
  
        do {
          console.log(
            "Would you like to regenerate Agility ratings for all offensive skill position players?\n" +
            "Enter YES or NO. ONLY enter YES if you're transferring over a Franchise File that utilized the 50 AGI fix in Madden 22. Otherwise, enter NO."
          );
        
          namePrompt = prompt().toUpperCase(); // Get user input and convert to uppercase
        
          if (namePrompt === 'NO') {
            console.log("Keeping Agility ratings as is for offensive skill position players...");
          } else if (namePrompt === 'YES') {
            console.log("Regenerating all agility ratings for all offensive skill position players...");
            await regenerateAgilityRatings(targetFranchise);
          }
        } while (!validOptions.includes(namePrompt));
        await generatePlayerMotivations(targetFranchise);

      }

      await adjustPlayerIds(targetFranchise, 'PLYR_ASSETNAME', 'PresentationId', presentationIdLookup);
      await adjustPlayerIds(targetFranchise, 'LastName', 'PLYR_COMMENT', commentaryLookup);
      await fixPlayerTableRow(targetFranchise);
      await emptyStoryTable(targetFranchise);


  
      if (targetGameYear >= 24) {
        await emptyCharacterVisualsTable(targetFranchise); // Empty all character visuals and then update them for everyone
        await characterVisualFunctions.updateAllCharacterVisuals(targetFranchise);
      }

      const validOptions = ['YES','NO']
      let namePrompt;
      do {
        console.log(
          "Would you like to transfer your schedule from your source file to your target file?\n" +
          "This will transfer over both PreSeason and RegularSeason games.\n" +
          "Enter YES or NO. If you enter YES the program will attempt to transfer the schedule."
        );
      
        namePrompt = prompt().toUpperCase(); // Get user input and convert to uppercase
      
        if (namePrompt === 'NO') {
          console.log("Continuing without attempting to transfer your schedule from your source file...");
        } else if (namePrompt === 'YES') {
          console.log("Attempting to transfer your schedule from your source file...");
          await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(sourceFranchise,targetFranchise,mergedTableMappings);
        }
      } while (!validOptions.includes(namePrompt));


    } catch (e) {
      console.log("******************************************************************************************")
      console.log(`FATAL ERROR!! Please report this message to Sinthros IMMEDIATELY and send your source/target Franchise Files - ${e}`)
      console.log("Exiting program.")
      console.log("******************************************************************************************")
      prompt();
      process.exit(0);

    }

    try {
      fs.rmSync(dir, { recursive: true, force: true }); //Remove the temp folder
    } catch {
      
    }
    

    let confirming = true;

    do {
      console.log("Successfully completed transfer of data. To confirm this PERMANENT transfer, enter YES. Or, enter NO to exit without saving your transfer.");
      let finalPrompt = prompt().toUpperCase();
    
      if (finalPrompt === 'YES') {
        await targetFranchise.save(); // Save the target file and quit
        console.log("Target file successfully saved!");
        confirming = false;
      } else if (finalPrompt === 'NO') {
        console.log("Exiting program without saving your transfer of data.");
        confirming = false;
      }
    } while (confirming);
    
    console.log("Program completed. Enter anything to exit the program.");
    prompt();
    
})});



