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
const { tables } = require('../lookupFunctions/FranchiseTableId');
const DEFAULT_PLAYER_ROW = 755;


const ZERO_REF = FranchiseUtils.zeroRef;
const PLAYER_TABLE = 1612938518;
const OFFENSIVE_SKILL_POSITIONS = ['QB','HB','FB','WR','TE'];
const validGames = ['22','24'];


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
      console.log(e);
      console.log("Invalid franchise file name/path given. Please try again.");
      continue

    }
  }
}

var sourceFranchise = "";
sourceFranchise = selectFranchiseFile(sourceFranchise,default_path,"Source");

var targetFranchise = "";
targetFranchise = selectFranchiseFile(targetFranchise,m24Path,"Target");

async function importTables(tableToEdit,filePath,keepColumns,deleteColumns,zeroColumns) {

  //These are the tables we need to explicitly set the nextRecordToUse for
  let nextRecordTables = ["CoachAward","CareerOffensiveKPReturnStats","CareerDefensiveKPReturnStats","CareerOffensiveStats","CareerDefensiveStats","CareerKickingStats","CareerOLineStats","LeagueHistoryAward"]

  let checkEmptyRows = []
  let checkInvalidRows = [] //This is specifically for the TalentNodeStatus table
  let nextRecordToUse = ""

  const table = await importTableData({ inputFilePath: filePath });

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
        nextRecordToUse = i;
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
      keepColumns.forEach(k => obj[k] = e[k]);
      return obj;
    });
  }
  trimmedTable.forEach((record, index) => {
      
      let franchiseRecord = tableToEdit.records[index];
      let i = 0;
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
        tableToEdit.records[record]['TalentStatus'] = 'NotOwned';
      } catch {
        //
      }})

    //Empty all defined empty records
    checkEmptyRows.forEach(function (record) {
      tableToEdit.records[record].empty();
     })

     //Explicitly set the next record to use and end the function
     tableToEdit.setNextRecordToUse(nextRecordToUse);
     return;
  }

  //If our table needs to have the nextRecord set by us...
  if (nextRecordTables.includes(tableToEdit.header.name)) {
    checkEmptyRows.forEach(function (record) {
      tableToEdit.records[record].empty();
  
     })
     tableToEdit.setNextRecordToUse(nextRecordToUse);
     return;

  }

  // Else, empty all the defined empty records
  checkEmptyRows.forEach(function (record) {

    try {
      tableToEdit.records[record].empty();
    }
    catch {
      console.log("Couldn't empty record.");
    }
   })
   if (table.length < tableToEdit.records.length) {
    for (let i = table.length;i < tableToEdit.records.length;i++) {
      await tableToEdit.records[i].empty();
    }
   }
  return;
};


  

async function generatePlayerMotivations(targetFranchise) {
  console.log("Regenerating all Player Motivations...")
  const playerTable = targetFranchise.getTableByUniqueId(tables.playerTable);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    if (!playerTable.records[i].isEmpty) {
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
  const playerTable = targetFranchise.getTableByUniqueId(tables.playerTable);
  const teamTable = targetFranchise.getTableByUniqueId(tables.teamTable);
  const resignArrayTable = targetFranchise.getTableByUniqueId(tables.reSignArrayTable);
  await playerTable.readRecords();
  await teamTable.readRecords();
  await resignArrayTable.readRecords();

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
  let coachTable = targetFranchise.getTableByUniqueId(tables.coachTable);
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
  const player = targetFranchise.getTableByUniqueId(tables.playerTable);
  await player.readRecords();
  
  if (!player.records[DEFAULT_PLAYER_ROW].isEmpty && player.records[DEFAULT_PLAYER_ROW]['PLYR_ASSETNAME'] !== '_0') {
    const nextPlayerRecord = player.header.nextRecordToUse;
    const referencedRow = targetFranchise.getReferencesToRecord(player.header.tableId,DEFAULT_PLAYER_ROW);

    const originalPlayerBin = getBinaryReferenceData(player.header.tableId,DEFAULT_PLAYER_ROW);
    const newPlayerBin = getBinaryReferenceData(player.header.tableId,nextPlayerRecord);

    const columnHeaders = await formatHeaders(player) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      player.records[nextPlayerRecord][currentCol] = player.records[DEFAULT_PLAYER_ROW][currentCol];
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

  player.records[DEFAULT_PLAYER_ROW]['MorphHead'] = ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['FirstName'] = '';
  player.records[DEFAULT_PLAYER_ROW]['LastName'] = '';
  player.records[DEFAULT_PLAYER_ROW]['PLYR_ASSETNAME'] = '_0';
  player.records[DEFAULT_PLAYER_ROW]['ContractStatus'] = 'None';
  player.records[DEFAULT_PLAYER_ROW]['TeamIndex'] = 32;
  player.records[DEFAULT_PLAYER_ROW]['WeeklyGoals'] = ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['CareerStats'] = ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['SeasonStats'] = ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['CharacterVisuals'] = ZERO_REF;
  player.records[DEFAULT_PLAYER_ROW]['SeasonalGoal'] = ZERO_REF;

};

async function deleteExcessFreeAgents(targetFranchise) {
  const playerTable = targetFranchise.getTableByUniqueId(tables.playerTable);
  const freeAgentsTable = targetFranchise.getTableByUniqueId(tables.freeAgentTable);
  const drillCompletedTable = targetFranchise.getTableByUniqueId(tables.drillCompletedTable);
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
      playerTable.records[rowIndex].CareerStats = ZERO_REF; // If we don't zero these out the game will crash
      playerTable.records[rowIndex].SeasonStats = ZERO_REF;
      playerTable.records[rowIndex].GameStats = ZERO_REF;
      playerTable.records[rowIndex].CharacterVisuals = ZERO_REF;
      playerTable.records[rowIndex].College = ZERO_REF;
      playerTable.records[rowIndex].PLYR_ASSETNAME = ""; // Don't know if this is needed, but doesn't hurt
      playerTable.records[rowIndex].empty();
      await FranchiseUtils.removeFromTable(drillCompletedTable, currentBin);
    }

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

async function assignFranchiseUsers(franchise) {
  let franchiseUserTable = franchise.getTableByUniqueId(tables.franchiseUserTable);
  await franchiseUserTable.readRecords();
  let franchiseUserArray = franchise.getTableByUniqueId(tables.franchiseUsersArray)
  let teamTable = franchise.getTableByUniqueId(tables.teamTable);
  let coach = franchise.getTableByUniqueId(tables.coachTable);
  let owner = franchise.getTableByUniqueId(tables.ownerTable);
  let franchiseTable = franchise.getTableByUniqueId(tables.franchiseTable)

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
    var foundUser = true;
    currentBin = getBinaryReferenceData(franchiseUserTable.header.tableId,i)
    for (let row = 0; row < franchiseUserArray.header.numMembers;row++) {
      if (franchiseUserArray.records[0][`User${row}`] === currentBin) {
        foundUser = true
        break

      }
    }
    if (foundUser === true) {
      let teamBin = franchiseUserTable.records[i]["Team"]; // Get current team from the FranchiseUser table
      for (let teamRow = 0; teamRow < teamTableNumRows;teamRow++) {
        currentRowBinary = getBinaryReferenceData(teamTable.header.tableId,teamRow);
        if (currentRowBinary === teamBin) {
          headCoach = teamTable.records[teamRow]['HeadCoach'];
          if (headCoach !== ZERO_REF) {
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
  
  await draftPickSource.readRecords();
  await draftPickTarget.readRecords();
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
  
  const coach = targetFranchise.getTableByUniqueId(tables.coachTable);
  const freeAgentCoachTable = targetFranchise.getTableByUniqueId(tables.freeAgentCoachTable);
  const team = targetFranchise.getTableByUniqueId(tables.teamTable);
  const activeTalentTree = targetFranchise.getTableByUniqueId(tables.activeTalentTree);
  const talentNodeStatus = targetFranchise.getTableByUniqueId(tables.talentNodeStatus);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(tables.talentNodeStatusArray);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(tables.talentSubTreeStatus);


  const tableArray = [coach,freeAgentCoachTable,team]

  if (!is22To24) {
    tableArray.push(activeTalentTree,talentNodeStatus,talentNodeStatusArray,talentSubTreeStatus)
  }

  const targetIndices = [ // M22 has 68 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
  0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36
  ];

  let teamSource = sourceFranchise.getTableByUniqueId(tables.teamTable);
  await teamSource.readRecords();
  const zeroPad = (num, places) => String(num).padStart(places, '0')

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

  const tableName = currentTable.header.name;
  
  const currentTableNumRows = currentTable.header.recordCapacity // Get name and number of rows from table
  const currentTableName = currentTable.header.name
  
  const uniqueId = currentTable.header.tablePad1; // Get table unique ID
  var sourceUniqueId = uniqueId; //Sometimes the unique IDs don't match up - Cause fuck me, I guess!
  const [keepColumns,deleteColumns,zeroColumns] = await getNeededColumns(currentTableName,is22To24) // Get the columns we need for the current table

  const options = {outputFilePath: `${dir}\\${currentTableName}.xlsx`} //Define our output path for the temp Excel file
  const filePath = `${dir}\\${currentTableName}.xlsx` //Define the filepath

  switch (uniqueId) {
    case tables.activeAbilityArrayTable: //activeAbility table has a different unique id between M22 and M24
      if (is22To24) {
        sourceUniqueId = tables.activeAbilityArrayTableM22;
      };
      break;
    default: //This is almost ALWAYS the case
      sourceUniqueId = uniqueId;
      break;
  }

  currentTable = sourceFranchise.getTableByUniqueId(sourceUniqueId); // Now get the table in the SOURCE file and read it
  await currentTable.readRecords();
  const sourceTableNumRows = currentTable.header.recordCapacity // Get name and number of rows from table
  const columnHeaders = await formatHeaders(currentTable); //Get the headers from the table

  if (sourceUniqueId === tables.activeAbilityArrayTableM22 && is22To24) { 
    //If it's the activeAbilities table AND we're transferring from 22 to 24...
    currentTable.records[96]['Player0'] = ZERO_REF; // These two rows aren't empty on 24, but are on 22
    currentTable.records[97]['Player0'] = ZERO_REF;

    for (let i = 18; i <= 77;i++) {
      currentTable.records[i]['Player0'] = ZERO_REF
      currentTable.records[i]['Player1'] = ZERO_REF
      currentTable.records[i]['Player2'] = ZERO_REF
    }
  }


  for (var i = 0; i < columnHeaders.length; i++) { // Iterate through the columns of the table

    for (var rows = 0; rows < sourceTableNumRows; rows++) { // Iterate through the table rows
      const currentCol = columnHeaders[i]; // Current column
  
      if (sourceUniqueId === tables.playerTable && (currentCol === 'PLYR_ASSETNAME' || currentCol === 'LastName' || currentCol === 'FirstName' )) {
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

            let teamTable = sourceFranchise.getTableByUniqueId(tables.teamTable);
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
      // We want to empty the resign tables for both franchises, and then we'll regenerate it after
      await FranchiseUtils.emptyResignTable(sourceFranchise, tables);
      await FranchiseUtils.emptyResignTable(targetFranchise, tables);
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
  const player = targetFranchise.getTableByUniqueId(tables.playerTable);
  const freeagents = targetFranchise.getTableByUniqueId(tables.freeAgentTable);
  const playerArray = targetFranchise.getTableByUniqueId(tables.rosterTable);
  const playerPracticeSquads = targetFranchise.getTableByUniqueId(tables.practiceSquadTable);
  const depthChart = targetFranchise.getTableByUniqueId(tables.depthChartPlayerTable);
  const teamRoadMap = targetFranchise.getTableByUniqueId(tables.teamRoadmapTable);
  const playerResignNegotiation = targetFranchise.getTableByUniqueId(tables.reSignTable);
  const mainActiveSignature = targetFranchise.getTableByUniqueId(tables.mainSigAbilityTable);
  const secondaryActiveSignature = targetFranchise.getTableByUniqueId(tables.secondarySigAbilityTable);
  const signatureArray = targetFranchise.getTableByUniqueId(tables.signatureArrayTable);
  const careerDefensiveKPReturnStats = targetFranchise.getTableByUniqueId(tables.careerDefKPReturnStatsTable);
  const careerOffensiveKPReturnStats = targetFranchise.getTableByUniqueId(tables.careerOffKPReturnStatsTable);
  const careerOLineStats = targetFranchise.getTableByUniqueId(tables.careerOLineStatsTable);
  const careerOffensiveStats = targetFranchise.getTableByUniqueId(tables.careerOffStatsTable);
  const careerDefensiveStats = targetFranchise.getTableByUniqueId(tables.careerDefStatsTable);
  const careerKickingStats = targetFranchise.getTableByUniqueId(tables.careerKickingStatsTable);
  const playerMerchTable = targetFranchise.getTableByUniqueId(tables.playerMerchTable);
  const activeAbilityArray = targetFranchise.getTableByUniqueId(tables.activeAbilityArrayTable);

  const tableArray = [mainActiveSignature,secondaryActiveSignature,signatureArray,player,freeagents,playerArray,playerPracticeSquads,
    depthChart,teamRoadMap,playerResignNegotiation,careerDefensiveKPReturnStats,careerOffensiveKPReturnStats,careerOLineStats,careerOffensiveStats,careerDefensiveStats,
    careerKickingStats,playerMerchTable,activeAbilityArray];

  return tableArray;

};

async function getTradeTables() {
  const tradeNegotiationArray = targetFranchise.getTableByUniqueId(tables.tradeNegotiationArrayTable);
  const tradeNegotiation = targetFranchise.getTableByUniqueId(tables.tradeNegotiationTable);
  const teamTradePackageArray = targetFranchise.getTableByUniqueId(tables.teamTradePackageArrayTable);
  const requestArray = targetFranchise.getTableByUniqueId(tables.tradeRequestArrayTable);
  const pendingTeamArray = targetFranchise.getTableByUniqueId(tables.pendingTeamArrayTable);
  const teamTradePackage = targetFranchise.getTableByUniqueId(tables.teamTradePackageTable);

  const tableArray = [tradeNegotiationArray,tradeNegotiation,teamTradePackageArray,
    requestArray,pendingTeamArray,teamTradePackage];

  return tableArray;

}

async function getAwardTables() {
  const playerAward = targetFranchise.getTableByUniqueId(tables.playerAwardTable);
  const coachAward = targetFranchise.getTableByUniqueId(tables.coachAwardTable);
  const awardArray = targetFranchise.getTableByUniqueId(tables.awardArrayTable);

  const tableArray = [playerAward,coachAward,awardArray];

  return tableArray;

};

async function getDraftPickTables() {
  const draftPicks = targetFranchise.getTableByUniqueId(tables.draftPickTable);

  const tableArray = [draftPicks];

  return tableArray;

};

async function getOptionalTables() {
  const seasonInfo = targetFranchise.getTableByUniqueId(tables.seasonInfoTable);
  const salaryInfo = targetFranchise.getTableByUniqueId(tables.salaryInfoTable);
  const sourceSeasonInfo = sourceFranchise.getTableByUniqueId(tables.seasonInfoTable);
  const leagueHistoryAward = targetFranchise.getTableByUniqueId(tables.leagueHistoryAward);
  const leagueHistoryArray = targetFranchise.getTableByUniqueId(tables.leagueHistoryArray);
  const yearSummary = targetFranchise.getTableByUniqueId(tables.yearSummary);
  const yearSummaryArray = targetFranchise.getTableByUniqueId(tables.yearSummaryArray);
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
  const rookieStatTracker = targetFranchise.getTableByUniqueId(tables.rookieStatTrackerTable);
  const rookieStatTrackerArray = targetFranchise.getTableByUniqueId(tables.rookieStatTrackerArray);

  await rookieStatTracker.readRecords();
  await rookieStatTrackerArray.readRecords();

  let rookieStatTrackerNumRows = rookieStatTracker.header.recordCapacity;

  for (let i = 0; i < rookieStatTrackerNumRows; i++) {
    if (!rookieStatTracker.records[i].isEmpty) {
      rookieStatTracker.records[i]['DownsPlayed'] = 0;
      await rookieStatTracker.records[i].empty();
    }
  }

  for (let i = 0; i < rookieStatTrackerArray.header.numMembers; i++) {
    rookieStatTrackerArray.records[0][`RookieStatTracker${i}`] = ZERO_REF;
  }
};

async function emptyMediaGoals(targetFranchise) {
  const characterActiveMediaGoal = targetFranchise.getTableByUniqueId(tables.characterActiveMediaGoal);
  const characterActiveMediaGoalArray = targetFranchise.getTableByUniqueId(tables.characterActiveMediaGoalArray);

  await characterActiveMediaGoal.readRecords();
  await characterActiveMediaGoalArray.readRecords();

  const activeMediaGoalNumRows = characterActiveMediaGoal.header.recordCapacity;
  const activeMediaGoalArrayNumRows = characterActiveMediaGoalArray.header.recordCapacity;
  
  for (let i = 0; i < activeMediaGoalNumRows; i++) {
    if (!characterActiveMediaGoal.records[i].isEmpty) {
      characterActiveMediaGoal.records[i]['ActiveMediaGoals'] = ZERO_REF;
      await characterActiveMediaGoal.records[i].empty();
    }
  }

  for (let i = 0; i < activeMediaGoalArrayNumRows;i++) {
    if (!characterActiveMediaGoalArray.records[i].isEmpty) {
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
  const seasonInfo = targetFranchise.getTableByUniqueId(tables.seasonInfoTable);
  const seasonGame = targetFranchise.getTableByUniqueId(tables.seasonGameTable);

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
  const talentNodeStatus = targetFranchise.getTableByUniqueId(tables.talentNodeStatus);
  const activeTalentTree = targetFranchise.getTableByUniqueId(tables.activeTalentTree);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(tables.talentNodeStatusArray);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(tables.talentSubTreeStatus);

  await talentNodeStatus.readRecords();
  await activeTalentTree.readRecords();
  await talentNodeStatusArray.readRecords();
  await talentSubTreeStatus.readRecords();

  const activeTalentTreeRows = activeTalentTree.header.recordCapacity;
  const talentNodeStatusRows = talentNodeStatus.header.recordCapacity;
  const talentNodeStatusArrayRows = talentNodeStatusArray.header.recordCapacity;
  const talentSubTreeStatusRows = talentSubTreeStatus.header.recordCapacity;

  for (let i = 0; i < activeTalentTreeRows;i++) {
    if (!activeTalentTree.records[i].isEmpty) {
      referencedRow = targetFranchise.getReferencesToRecord(activeTalentTree.header.tableId,i);
      if (referencedRow.length === 0) {
        activeTalentTree.records[i]['TalentSubTreeStatusThird'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeStatusSecond'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeStatusFirst'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeSecond'] = ZERO_REF;
        activeTalentTree.records[i]['TalentSubTreeFirst'] = ZERO_REF;
        activeTalentTree.records[i].empty();
      }

    }
  }

  for (let i = 0; i < talentSubTreeStatusRows;i++) {
    if (!talentSubTreeStatus.records[i].isEmpty) {
      referencedRow = targetFranchise.getReferencesToRecord(talentSubTreeStatus.header.tableId,i);
      if (referencedRow.length === 0) {
        talentSubTreeStatus.records[i].empty();
      }
    }
  }

  for (let i = 0; i < talentNodeStatusArrayRows; i++) {
    if (!talentNodeStatusArray.records[i].isEmpty) {
      referencedRow = targetFranchise.getReferencesToRecord(talentNodeStatusArray.header.tableId,i);
      if (referencedRow.length === 0) {
        for (let j = 0; j < talentNodeStatusArray.header.numMembers;j++) {
          talentNodeStatusArray.records[i][`TalentNodeStatus${j}`] = ZERO_REF;
        }
        talentNodeStatusArray.records[i].empty();
      }
   }
  }

  for (let i = 0; i < talentNodeStatusRows;i++) {
    if (!talentNodeStatus.records[i].isEmpty) {
      referencedRow = targetFranchise.getReferencesToRecord(talentNodeStatus.header.tableId,i);
      if (referencedRow.length === 0) {
        talentNodeStatus.records[i].empty();
      }
    }
  }
}

async function handleTalentTree(targetFranchise,coachTable,coachTableCurrentRecord) {
  const talentNodeStatus = targetFranchise.getTableByUniqueId(tables.talentNodeStatus);
  const activeTalentTree = targetFranchise.getTableByUniqueId(tables.activeTalentTree);
  const talentNodeStatusArray = targetFranchise.getTableByUniqueId(tables.talentNodeStatusArray);
  const talentSubTreeStatus = targetFranchise.getTableByUniqueId(tables.talentSubTreeStatus);
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
  const coachTable = targetFranchise.getTableByUniqueId(tables.coachTable);
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
  const storyArrayTable = targetFranchise.getTableByUniqueId(tables.storyArrayTable)
  await storyArrayTable.readRecords();

  for (let i = 0; i < storyArrayTable.header.recordCapacity;i++) {
    if (!storyArrayTable.records[i].isEmpty) {
        for (let j = 0; j < storyArrayTable.header.numMembers;j++) {
          storyArrayTable.records[i][`Story${j}`] = ZERO_REF;

        }
      }
   }
};

async function fixAllPlayerTables(sourceFranchise,allPlayerTables) {
  const mainPlayerTable = sourceFranchise.getTableByUniqueId(tables.playerTable); //Get our main player table
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
  const player = targetFranchise.getTableByUniqueId(tables.playerTable);
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
  const player = targetFranchise.getTableByUniqueId(tables.playerTable);
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

async function regenerateAgilityRatings(targetFranchise) {
  const player = targetFranchise.getTableByUniqueId(tables.playerTable);
  await player.readRecords();

  for (let i = 0; i < player.header.recordCapacity; i++) {
    if (!player.records[i].isEmpty && OFFENSIVE_SKILL_POSITIONS.includes(player.records[i]['Position']) ) {
      const speedRating = player.records[i]['SpeedRating'];
      const accelerationRating = player.records[i]['AccelerationRating'];

      const agilityRating = Math.round((speedRating + accelerationRating) / 2);
      player.records[i]['AgilityRating'] = agilityRating
    }
  }
};

sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    const allPlayerTables = sourceFranchise.getAllTablesByName('Player');

    if (allPlayerTables.length > 1) {
      console.log("******************************************************************************************")
      console.log("Warning: Source file has more than one Player table, but this should still transfer over properly.");
      console.log("******************************************************************************************")
      await fixAllPlayerTables(sourceFranchise,allPlayerTables);
    }

    const sourceGameYear = sourceFranchise.schema.meta.gameYear // Get the game year of the source file
    const targetGameYear = targetFranchise.schema.meta.gameYear // Get the game year of the target file
    if (targetGameYear !== 24) {
      console.log("Target franchise file isn't a Madden 24 Franchise File. Exiting program.");
      prompt();
      process.exit(1);
    }

    if (sourceGameYear !== 22 && sourceGameYear !== 24) {
      console.log("Source franchise file isn't a Madden 22 or Madden 24 Franchise File. Exiting program.");
      prompt();
      process.exit(1);
    }

    // We're going to read all tables for our source/target franchise so that we don't have to read them again later
    const allTables = [];
    for (const key in tables) {
      const sourceTable = sourceFranchise.getTableByUniqueId(tables[key]);
      const targetTable = targetFranchise.getTableByUniqueId(tables[key]);
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

    const draftPickTables = await getDraftPickTables();

    const allTablesArray = [playerTables,coachTables,awardTables,optionalTables,draftPickTables]
    const [ignoreColumns] = await columnOptions()

    console.log("Now working on transferring all table data...");

    try {
      for (const currentArray of allTablesArray) {
        for (const currentTable of currentArray) {
          await handleTable(
            sourceFranchise,
            targetFranchise,
            currentTable,
            ignoreColumns,
            sourceGameYear,
            targetGameYear,
            mergedTableMappings,
            is22To24
          );
        }
      }
    } catch (error) {
      console.log("******************************************************************************************");
      console.log(`FATAL ERROR! Please report this message to Sinthros IMMEDIATELY and send your source/target Franchise Files - ${error}`);
      console.log("Exiting program.");
      console.log("******************************************************************************************");
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
      await deleteExcessFreeAgents(targetFranchise); // Only keep the top 3500 players
      await FranchiseUtils.emptyHistoryTables(targetFranchise, tables); // Function to empty history tables (Avoid crashing)
      await FranchiseUtils.emptyAcquisitionTables(targetFranchise,tables);

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
      await FranchiseUtils.regenerateMarketingTables(targetFranchise,tables);

      if (targetGameYear >= 24) {
        console.log("Regenerating all Character Visuals for players/coaches...");
        await FranchiseUtils.emptyCharacterVisualsTable(targetFranchise, tables); // Empty all character visuals and then update them for everyone
        await characterVisualFunctions.updateAllCharacterVisuals(targetFranchise);
      }

      const validOptions = ['YES','NO'];
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



