const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');
const zeroPad = (num, places) => String(num).padStart(places, '0')

let is24To25;

// Options
let transferSeasonYear;
let transferTeamNames;
let transferStadiums;
let transferPlayerAssets;

const ALL_ASSET_NAMES = JSON.parse(fs.readFileSync('lookupFiles/all_asset_names.json', 'utf-8'));
const COMMENTARY_LOOKUP = JSON.parse(fs.readFileSync('lookupFiles/commentary_lookup.json', 'utf-8'));
const COACH_LOOKUP = JSON.parse(fs.readFileSync('lookupFiles/coach_lookup.json', 'utf-8'));
const PLAYER_LOOKUP = JSON.parse(fs.readFileSync('lookupFiles/player_lookup.json', 'utf-8'));
const TRANSFER_SCHEDULE_FUNCTIONS = require('../../retroSchedules/transferScheduleFromJson');
const SCHEDULE_FUNCTIONS = require('../../Utils/ScheduleFunctions');
const FranchiseUtils = require('../../Utils/FranchiseUtils');
const ISON_FUNCTIONS = require('../../isonParser/isonFunctions');
const VISUAL_FUNCTIONS = require('../../Utils/characterVisualsLookups/characterVisualFunctions');
const COACH_VISUAL_LOOKUP_M25 = JSON.parse(fs.readFileSync('../../Utils/characterVisualsLookups/25/coachVisualsLookup.json', 'utf-8'));
const DEFAULT_PLAYER_ROW = 720; // Default player row for Madden 25

// We won't convert the binary for these fields because we have to do additional operations on these fields
const IGNORE_COLUMNS = ["CharacterVisuals","SeasonStats","Stadium"];
const VISUAL_KEYS_TO_REMOVE = [
  "genericHeadName",
  "genericHead",
  "skinToneScale",
  "containerId",
  "assetName",
  "heightInches"
];

const SOURCE_VALID_YEARS = [FranchiseUtils.YEARS.M24,FranchiseUtils.YEARS.M25]
const TARGET_VALID_YEARS = [FranchiseUtils.YEARS.M25];
  
console.log("In this program, you can convert your Madden 24 Franchise to Madden 25 (Or Madden 25 to another Madden 25 Franchise File)");
console.log("Your SOURCE franchise file will have the data you want to transfer. Your TARGET franchise file is the one you'll be transferring the data to.");
console.log("Please note that your TARGET franchise file MUST be in the PreSeason for this program to work.");

const sourceFranchise = FranchiseUtils.init(SOURCE_VALID_YEARS, {customYearMessage: "Select the Madden version of your SOURCE Franchise file. Valid inputs are 24 and 25.", promptForBackup: false, isAutoUnemptyEnabled: false});
const targetFranchise = FranchiseUtils.init(TARGET_VALID_YEARS, {customFranchiseMessage: "Please enter the name of your Madden 25 franchise file (such as CAREER-BEARS).", promptForBackup: true, isAutoUnemptyEnabled: true});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);


async function handleTeamTable(teamTable) {
  const practiceTeamTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.practiceTeamTable);
  const proBowlRosterTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.proBowlRosterTable);
  await FranchiseUtils.readTableRecords([practiceTeamTable,proBowlRosterTable]);

  const practiceRecord = practiceTeamTable.records[0];
  const defaultOffensiveCoordinator = practiceRecord.OffensiveCoordinator;
  const defaultDefensiveCoordinator = practiceRecord.DefensiveCoordinator;

  const proBowlRosterTableId = proBowlRosterTable.header.tableId;
  const afcRosterRef = getBinaryReferenceData(proBowlRosterTableId,0);
  const nfcRosterRef = getBinaryReferenceData(proBowlRosterTableId,1);

  const proBowlTeamRecords = teamTable.records.filter(record => !record.isEmpty && (FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName) || record.DisplayName === FranchiseUtils.EXTRA_TEAM_NAMES.FREE_AGENTS));

  for (const record of proBowlTeamRecords) {
    record.OffensiveCoordinator = defaultOffensiveCoordinator;
    record.DefensiveCoordinator = defaultDefensiveCoordinator;
    record.HeadCoach = FranchiseUtils.ZERO_REF;
    record.PlayerPersonnel = FranchiseUtils.ZERO_REF;

    switch (record.DisplayName) {
      case FranchiseUtils.EXTRA_TEAM_NAMES.AFC:
        record.Roster = afcRosterRef;
        break;
      case FranchiseUtils.EXTRA_TEAM_NAMES.NFC:
        record.Roster = nfcRosterRef;
        break;
      case FranchiseUtils.EXTRA_TEAM_NAMES.FREE_AGENTS:
        record.Roster = FranchiseUtils.ZERO_REF;
        break;
    }
  }
};

async function fixPlayerTableRow() {
  const player = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  await player.readRecords();

  const defaultPlayerRow = player.records[DEFAULT_PLAYER_ROW];
  
  if (!defaultPlayerRow.isEmpty && defaultPlayerRow.PLYR_ASSETNAME !== '_0') {
    const nextPlayerRecord = player.header.nextRecordToUse;
    const referencedRow = targetFranchise.getReferencesToRecord(player.header.tableId,DEFAULT_PLAYER_ROW);

    const originalPlayerBin = getBinaryReferenceData(player.header.tableId,DEFAULT_PLAYER_ROW);
    const newPlayerBin = getBinaryReferenceData(player.header.tableId,nextPlayerRecord);

    const columnHeaders = await FranchiseUtils.getColumnNames(player) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      player.records[nextPlayerRecord][currentCol] = defaultPlayerRow[currentCol];
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

  defaultPlayerRow.MorphHead = FranchiseUtils.ZERO_REF;
  defaultPlayerRow.FirstName = '';
  defaultPlayerRow.LastName = '';
  defaultPlayerRow.PLYR_ASSETNAME = '_0';
  defaultPlayerRow.ContractStatus = 'None';
  defaultPlayerRow.TeamIndex = 32;
  defaultPlayerRow.WeeklyGoals = FranchiseUtils.ZERO_REF;
  defaultPlayerRow.CareerStats = FranchiseUtils.ZERO_REF;
  defaultPlayerRow.SeasonStats = FranchiseUtils.ZERO_REF;
  defaultPlayerRow.CharacterVisuals = FranchiseUtils.ZERO_REF;
  defaultPlayerRow.SeasonalGoal = FranchiseUtils.ZERO_REF;  

};

async function getNeededColumns(currentTableName) {

  switch (currentTableName) {
    case FranchiseUtils.TABLE_NAMES.PLAYER:
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = ["GameStats","CharacterVisuals","SeasonalGoal","WeeklyGoals","SeasonStats"];
      return [keepColumns,deleteColumns,zeroColumns];
    case FranchiseUtils.TABLE_NAMES.TEAM:
      keepColumns = ["Philosophy","HeadCoach","OffensiveCoordinator","DefensiveCoordinator","Roster","PracticeSquad","PlayerPersonnel", "City",
        "DepthChart","ActiveRosterSize","SalCapRosterSize","SalCapNextYearRosterSize","TeamIndex", "TEAM_OFFPLAYBOOK","TEAM_DEFPLAYBOOK",
        "Rival1TeamRef","Rival2TeamRef","Rival3TeamRef","TeamBuilding","ContentionPhase","PresentationId","TEAM_ORIGID","RolloverCap","TEAM_LOGO","TEAM_ORDER","TEAM_GROUP","PrestigeRank"];
      deleteColumns = [];
      zeroColumns = ["UserCharacter"];

      if (transferTeamNames) {
        keepColumns.push("DisplayName","ShortName","NickName","LongName","TEAM_PREFIX_NAME",
        "TEAM_BACKGROUNDCOLORR2","TEAM_BACKGROUNDCOLORR","TEAM_BACKGROUNDCOLORB","TEAM_BACKGROUNDCOLORB2",
        "TEAM_BACKGROUNDCOLORG","TEAM_BACKGROUNDCOLORG2","TEAM_DBASSETNAME","AssetName","UniformPrefix","UniformAssetName");
      }

      return [keepColumns,deleteColumns,zeroColumns];   
    case FranchiseUtils.TABLE_NAMES.COACH:
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = ["SeasonalGoal","WeeklyGoals","CharacterVisuals"];
      return [keepColumns,deleteColumns,zeroColumns];  
    case FranchiseUtils.TABLE_NAMES.SEASON_INFO:
      keepColumns = ["CurrentSeasonYear","CurrentYear"];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];  
    case FranchiseUtils.TABLE_NAMES.SALARY_INFO:
      keepColumns = ["TeamSalaryCap","InitialSalaryCap"];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];  
    case FranchiseUtils.TABLE_NAMES.TEAM_ROADMAP:
      keepColumns = [];
      deleteColumns = ['Needs'];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns]; 
    case FranchiseUtils.TABLE_NAMES.COACH_TALENT_EFFECTS:
      keepColumns = [];
      deleteColumns = ['TeamRelativeAbilities'];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];   
    default:
      keepColumns = [];
      deleteColumns = [];
      zeroColumns = [];
      return [keepColumns,deleteColumns,zeroColumns];  
  }
};

async function assignFranchiseUsers() {
  const franchiseUserTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.franchiseUserTable);
  const franchiseUserArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.franchiseUsersArray);
  const teamTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.teamTable);
  const coach = targetFranchise.getTableByUniqueId(TARGET_TABLES.coachTable);
  const owner = targetFranchise.getTableByUniqueId(TARGET_TABLES.ownerTable);
  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  const franchiseTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.franchiseTable);

  // First, set everyone to !IsUserControlled
  coach.records.forEach(record => { if (!record.isEmpty) record.IsUserControlled = false; });
  owner.records.forEach(record => { if (!record.isEmpty) record.IsUserControlled = false; });
  playerTable.records.forEach(record => { if (!record.isEmpty) record.IsUserControlled = false; });

  for (const franchiseRecord of franchiseUserTable.records) {
    if (franchiseRecord.isEmpty) continue;

    let foundUser = false;
    const userBinary = getBinaryReferenceData(franchiseUserTable.header.tableId, franchiseRecord.index);
    for (let row = 0; row < franchiseUserArray.header.numMembers;row++) {
      if (franchiseUserArray.records[0][`User${row}`] === userBinary) {
        foundUser = true
        break;
      }
    }

    if (foundUser) { // If the user exists in the array table...
      const teamBinary = franchiseRecord.Team;

      const teamRecord = teamTable.records.find(teamRecord => 
        getBinaryReferenceData(teamTable.header.tableId, teamRecord.index) === teamBinary
      );

      if (teamRecord) { // If we found an associated team record...
        // Dynamically get the head coach or owner binary, depending on if the team has a head coach
        const userEntity = teamRecord.HeadCoach !== FranchiseUtils.ZERO_REF ? teamRecord.HeadCoach : teamRecord.Owner;
        teamRecord.UserCharacter = userEntity; // Set the userEntity in the Team and FranchiseUser tables
        franchiseRecord.UserEntity = userEntity;

        if (franchiseRecord.AdminLevel === 'Owner') { // If this user is an owner, set it in the Franchise table
          franchiseTable.records[0].LeagueOwner = userEntity;
        }

        // Get either the coach or owner table depending on the above condition
        const userControlTable = teamRecord.HeadCoach !== FranchiseUtils.ZERO_REF ? coach : owner;

        const controlRecord = userControlTable.records.find((_, row) => 
          getBinaryReferenceData(userControlTable.header.tableId, row) === userEntity
        );

        if (controlRecord) controlRecord.IsUserControlled = true;
      }
    }
  }
}


function getCoachTables() {
  const tableIds = [
    TARGET_TABLES.coachTable,
    TARGET_TABLES.freeAgentCoachTable,
    TARGET_TABLES.retiredCoachTable,
    TARGET_TABLES.hallOfFameCoachTable,
    TARGET_TABLES.teamTable,
    TARGET_TABLES.salaryInfoTable,
    TARGET_TABLES.activeTalentTree,
    TARGET_TABLES.talentNodeStatus,
    TARGET_TABLES.talentNodeStatusArray,
    TARGET_TABLES.talentSubTreeStatus,
    TARGET_TABLES.coachTalentEffects,
    TARGET_TABLES.playerPersonnelTable
  ];

  const tableArray = tableIds.map(id => targetFranchise.getTableByUniqueId(id));

  handleCoachTable(sourceFranchise.getTableByUniqueId(SOURCE_TABLES.coachTable));

  return tableArray;
}

function handleCoachTable(coachTable) {
  for (const record of coachTable.records) {
    const isEmpty = record.isEmpty;

    const fullName = `${record.FirstName} ${record.LastName}`;

    const coachLookup = COACH_LOOKUP[fullName];

    if (coachLookup && !isEmpty) {
      for (const [key, value] of Object.entries(coachLookup)) {
        record[key] = value;
      }
    }
  }
}
function handlePlayerTable(playerTable) {
  for (const record of playerTable.records) {
    const isEmpty = record.isEmpty;

    if (is24To25) {
      record.YearDrafted--; // If transferring from 24 to 25, we need to account for the year difference

      if (record.YearDrafted === -1) record.YearDrafted--;
    }

    if (isEmpty) {
      record.CareerStats = FranchiseUtils.ZERO_REF;
      record.SeasonStats = FranchiseUtils.ZERO_REF;
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

    if (transferPlayerAssets) {
      // Update player assets
      const playerLookup = PLAYER_LOOKUP[record.PLYR_ASSETNAME];
        
      if (playerLookup && !record.isEmpty) {
          // Iterate over each key-value pair
          for (const [key, value] of Object.entries(playerLookup)) {
            // Dynamically set each key-value pair in the record object
            record[key] = value;
          }
      }
    }
  }

  // Set all expiring players to signed
  playerTable.records.filter(record => !record.isEmpty && record.ContractStatus === FranchiseUtils.CONTRACT_STATUSES.EXPIRING)
    .forEach(record => record.ContractStatus = FranchiseUtils.CONTRACT_STATUSES.SIGNED);

  playerTable.records
    .filter(record => !record.isEmpty && record.ContractStatus === FranchiseUtils.CONTRACT_STATUSES.DRAFT)
    .forEach(record => {
      record.ContractStatus = FranchiseUtils.CONTRACT_STATUSES.DELETED;
      record.empty();
    });
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
    var currentResignBinary = getBinaryReferenceData(resignTable.header.tableId,resignTableNextRecord);
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

/**
 * Replaces the binary value in a record's column based on the provided merged table mappings.
 *
 * @param {Array} mergedTableMappings - Array of dictionary entries mapping source IDs to target IDs.
 * @param {Object} record - The record object containing the field to be processed.
 * @param {string} column - The column name whose binary value is to be replaced.
 * @returns {string} - The replaced binary value, or the original value if no replacement is made.
 */
function replaceBinaryValue(mergedTableMappings, record, column) {
  const field = record.fields[column];
  const currentValue = record[column];

  // Convert tableId to binary and zero-pad it
  const outputBin = zeroPad(FranchiseUtils.dec2bin(field.referenceData.tableId), 15);

  // Find the corresponding dictionary entry in mergedTableMappings
  const sourceTableDict = mergedTableMappings.find(table => table.sourceIdBinary === outputBin);

  if (!sourceTableDict) {
    return null; // No matching dictionary entry found
  }

  // Replace the binary value with the target binary value
  return currentValue.replace(outputBin, sourceTableDict.targetIdBinary);
}

async function handleTable(targetTable,mergedTableMappings) {

  const tableKey = FranchiseUtils.findKeyByValue(TARGET_TABLES,targetTable.header.uniqueId);
  const sourceUniqueId = SOURCE_TABLES[tableKey];
  const sourceTable = sourceFranchise.getTableByUniqueId(sourceUniqueId);
  const currentTableName = targetTable.header.name;
  const [keepColumns,deleteColumns,zeroColumns] = await getNeededColumns(currentTableName) // Get the columns we need for the current table

  const sourceColumns = await FranchiseUtils.getColumnNames(sourceTable); //Get the headers from the table

  sourceColumns.forEach((currentCol) => {

    for (const record of sourceTable.records) {
      const fieldOffset = record._fields[currentCol].offset;
  
      // Check if ref column and not a column to ignore
      if (FranchiseUtils.isReferenceColumn(record, currentCol) && !IGNORE_COLUMNS.includes(currentCol)) {
        try {
          const updatedValue = replaceBinaryValue(mergedTableMappings, record, currentCol);
          if (updatedValue !== null) {
            record[currentCol] = updatedValue;
          }
        } catch (error) {
          console.error(`Error processing column: ${currentCol} at row ${record.index}`, error);
        }
      }
  
      // Remove/replace non-UTF8 values from any string columns
      if (fieldOffset.type === 'string') {
        record[currentCol] = FranchiseUtils.removeNonUTF8(record[currentCol]);
      }
    }
  });

  // Handle specific table types
  switch (currentTableName) {
    case FranchiseUtils.TABLE_NAMES.PLAYER:
      FranchiseUtils.emptyTable(targetTable,{"CareerStats": FranchiseUtils.ZERO_REF,"SeasonStats": FranchiseUtils.ZERO_REF, "GameStats": FranchiseUtils.ZERO_REF, "CharacterVisuals": FranchiseUtils.ZERO_REF, "GenericHeadAssetName": ""})
      break;
    case FranchiseUtils.TABLE_NAMES.COACH:
      FranchiseUtils.emptyTable(targetTable,{"CharacterVisuals": FranchiseUtils.ZERO_REF,"TeamPhilosophy": FranchiseUtils.ZERO_REF, "DefaultTeamPhilosophy": FranchiseUtils.ZERO_REF, "DefensivePlaybook": FranchiseUtils.ZERO_REF, 
        "OffensivePlaybook": FranchiseUtils.ZERO_REF, "OffensiveScheme": FranchiseUtils.ZERO_REF, "DefensiveScheme": FranchiseUtils.ZERO_REF, "ActiveTalentTree": FranchiseUtils.ZERO_REF, "GenericHeadAssetName": ""});
      break;
  }

  for (const sourceRecord of sourceTable.records) {
    // Here we add the record from the source table to the target
    // We set our ignoreColumns, zeroColumns, and keepColumns, and specify to use the same index from the source table in the target table to keep the same structure
    const targetRecord = FranchiseUtils.addRecordToTable(sourceRecord, targetTable, { ignoreColumns: deleteColumns, zeroColumns: zeroColumns, keepColumns: keepColumns, useSameIndex: true  })

    if (currentTableName === FranchiseUtils.TABLE_NAMES.PLAYER) {
      await handleCharacterVisuals(sourceRecord,targetRecord,currentTableName);
      if (transferSeasonYear) await handleSeasonStats(sourceRecord,targetRecord);
    }

    if (currentTableName === FranchiseUtils.TABLE_NAMES.COACH) {
      await handleCharacterVisuals(sourceRecord,targetRecord,currentTableName);
    }

    if (currentTableName === FranchiseUtils.TABLE_NAMES.TEAM && transferStadiums) {
      await transferStadium(sourceRecord,targetRecord);
    }
  } 

  switch (currentTableName) {
    case FranchiseUtils.TABLE_NAMES.TEAM:
      await handleTeamTable(targetTable);
      break;
  }
};

async function emptySeasonStatTables() {
  const seasonStatsArrayTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonStatsTable);
  const seasonOffKPReturnStatsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonOffKPReturnStatsTable);
  const seasonOffStatsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonOffStatsTable);
  const seasonOLineStatsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonOLineStatsTable);
  const seasonDefStatsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonDefStatsTable);
  const seasonKickingStatsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonKickingStatsTable);
  const seasonDefKPReturnStatsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonDefKPReturnStatsTable);

  const goalsTable = targetFranchise.getTableByUniqueId(720737254);
  await goalsTable.readRecords();

  const goalsRecord = goalsTable.records[0];

  // Empty season stat tables, except for default rows which need to remain unemptied
  FranchiseUtils.emptyTable(seasonOffKPReturnStatsTable,{},[FranchiseUtils.getRowAndTableIdFromRef(goalsRecord.ZeroOffensiveStat).row]);
  FranchiseUtils.emptyTable(seasonOffStatsTable);
  FranchiseUtils.emptyTable(seasonOLineStatsTable,{},[FranchiseUtils.getRowAndTableIdFromRef(goalsRecord.ZeroOLineStat).row]);
  FranchiseUtils.emptyTable(seasonDefStatsTable);
  FranchiseUtils.emptyTable(seasonKickingStatsTable,{},[FranchiseUtils.getRowAndTableIdFromRef(goalsRecord.ZeroKickingStat).row]);
  FranchiseUtils.emptyTable(seasonDefKPReturnStatsTable,{},[FranchiseUtils.getRowAndTableIdFromRef(goalsRecord.ZeroDefensiveStat).row]);

  for (const record of seasonStatsArrayTable.records) {
    if (record.isEmpty) continue;
    for (let i = 0; i < seasonStatsArrayTable.header.numMembers; i++) {
      const column = `SeasonStats${i}`;

      record[column] = FranchiseUtils.ZERO_REF;
    }
    record.empty();
  }


}
async function handleSeasonStats(sourceRecord, targetRecord) {
  if (targetRecord.isEmpty) return;

  const seasonStatsRef = sourceRecord.SeasonStats;
  const targetStatsArray = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonStatsTable);
  const nextRecord = targetStatsArray.header.nextRecordToUse;

  // Check if source has reference data for SeasonStats
  if (!FranchiseUtils.isReferenceColumn(sourceRecord, 'SeasonStats')) return;

  const targetNextRecord = targetStatsArray.records[nextRecord];
  const refData = FranchiseUtils.getRowAndTableIdFromRef(seasonStatsRef);
  const seasonStatsArray = sourceFranchise.getTableById(refData.tableId);
  await seasonStatsArray.readRecords();
  const arrayRecord = seasonStatsArray.records[refData.row];

  for (let i = 0; i < seasonStatsArray.header.numMembers; i++) {
    const column = `SeasonStats${i}`;
    const sourceColumnValue = arrayRecord[column];

    // Simplified check: FtcReference or simple reference
    if (FranchiseUtils.isFtcReference(arrayRecord, column)) {
      targetNextRecord[column] = sourceColumnValue;
    } else if (FranchiseUtils.isReferenceColumn(arrayRecord, column, false, false)) {
      const sourceStatsData = FranchiseUtils.getRowAndTableIdFromRef(sourceColumnValue);
      const statsTable = sourceFranchise.getTableById(sourceStatsData.tableId);

      await statsTable.readRecords();
      const targetStatsTable = targetFranchise.getTableByName(statsTable.header.name);
      await targetStatsTable.readRecords();

      const statsRecord = statsTable.records[sourceStatsData.row];
      const targetStatsRecord = FranchiseUtils.addRecordToTable(statsRecord, targetStatsTable);

      // Adjust season year if applicable
      if (is24To25) targetStatsRecord.SEAS_YEAR--;

      targetNextRecord[column] = getBinaryReferenceData(targetStatsTable.header.tableId, targetStatsRecord.index);
    } else {
      // If not an FTC or defined reference, set to zeroes
      targetNextRecord[column] = FranchiseUtils.ZERO_REF;
    }
  }

  // Update target record SeasonStats reference
  targetRecord.SeasonStats = getBinaryReferenceData(targetStatsArray.header.tableId, nextRecord);
}
async function handleCharacterVisuals(sourceRecord, targetRecord, currentTableName) {
  if (targetRecord.isEmpty) return;

  const characterVisuals = sourceRecord.CharacterVisuals;
  if (FranchiseUtils.isFtcReference(sourceRecord,'CharacterVisuals')) {
    targetRecord.CharacterVisuals = characterVisuals;
    return;
  }

  const sourcePlayerTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
  const sourceCoachTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.coachTable);
  const targetVisualsTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.characterVisualsTable);
  const nextRecord = targetVisualsTable.header.nextRecordToUse;
  
  // If no rows are left, return
  if (nextRecord > targetVisualsTable.header.recordCapacity) return;

  let jsonData;
  let genericHead;
  
  const isPlayer = currentTableName === FranchiseUtils.TABLE_NAMES.PLAYER;

  if (characterVisuals !== FranchiseUtils.ZERO_REF) {
    const visualsMetadata = FranchiseUtils.getRowAndTableIdFromRef(characterVisuals);
    const visualsTable = sourceFranchise.getTableById(visualsMetadata.tableId);
    await visualsTable.readRecords();

    const visualsRecord = visualsTable.records[visualsMetadata.row];

    if (is24To25) {
      try { // We should always regenerate coach visuals if from 24 to 25
        jsonData = isPlayer ? JSON.parse(visualsRecord.RawData) : await VISUAL_FUNCTIONS.getGeneratedCoachVisual(sourceCoachTable,sourceRecord.index,"N/A",COACH_VISUAL_LOOKUP_M25);
      } catch (error) {
          jsonData = isPlayer ? await VISUAL_FUNCTIONS.getGeneratedPlayerVisual(sourcePlayerTable,sourceRecord.index)
          : await VISUAL_FUNCTIONS.getGeneratedCoachVisual(sourceCoachTable,sourceRecord.index,"N/A",COACH_VISUAL_LOOKUP_M25);
      }
    }
    else {
      try {
        jsonData = ISON_FUNCTIONS.isonVisualsToJson(visualsTable,visualsMetadata.row);
      } catch (error) {
        console.error(error);
        return;
      }
    }

  }

  else if (is24To25) { // If source file is 24, we can generate the visual
    jsonData = isPlayer ? await VISUAL_FUNCTIONS.getGeneratedPlayerVisual(sourcePlayerTable,sourceRecord.index)
    : await VISUAL_FUNCTIONS.getGeneratedCoachVisual(sourceCoachTable,sourceRecord.index,"N/A",COACH_VISUAL_LOOKUP_M25);
  }
  else { // If source file is 25 and they have no visual, return
    return;
  }

  genericHead = is24To25 ? jsonData.genericHeadName : targetRecord.GenericHeadAssetName;

  if (jsonData === null) {
    jsonData = {}; // Should never happen, but just to be safe
  }

  
  VISUAL_KEYS_TO_REMOVE.forEach(key => {
    FranchiseUtils.removeKeyFromJson(jsonData, key);
  });

  ISON_FUNCTIONS.jsonVisualsToIson(targetVisualsTable,nextRecord,jsonData); // Set the data in the visuals table

  targetRecord.CharacterVisuals = getBinaryReferenceData(targetVisualsTable.header.tableId, nextRecord);

  targetRecord.GenericHeadAssetName = typeof genericHead !== 'undefined' ? genericHead : "";

  if (is24To25) targetRecord.CharacterBodyType = FranchiseUtils.approximateBodyType(jsonData);

}

async function transferStadium(sourceRecord, targetRecord) {
  
  if (targetRecord.isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(targetRecord.DisplayName) || !targetRecord.TEAM_VISIBLE) return;

  // If it's a binary reference (not FTC) add the record to the target stadium table
  if (FranchiseUtils.isReferenceColumn(sourceRecord,'Stadium')) {
    const targetStadiumTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.stadiumTable);

    const stadiumRef = sourceRecord.Stadium;
    const metadata = FranchiseUtils.getRowAndTableIdFromRef(stadiumRef);

    const stadiumTable = sourceFranchise.getTableById(metadata.tableId);
    await stadiumTable.readRecords();

    const stadiumRecord = stadiumTable.records[metadata.row];
    stadiumRecord.Name = FranchiseUtils.removeNonUTF8(stadiumRecord.Name);

    const targetStadiumRecord = await FranchiseUtils.addRecordToTable(stadiumRecord,targetStadiumTable);

    targetRecord.Stadium = getBinaryReferenceData(targetStadiumTable.header.tableId, targetStadiumRecord.index);
  }

  // If it's an FTC reference, we can just set it in the target record
  else if (FranchiseUtils.isReferenceColumn(sourceRecord,'Stadium',false,true)) {
    targetRecord.Stadium = sourceRecord.Stadium;
  }

}

async function setOptions() {

  const message = "Would you like to transfer over the Season Year from your source file to your target file? Answering yes will also transfer Player season stats and league history.\n" +
  "Player Career Stats will be transferred regardless. Enter yes or no. If you're transferring a file that is at or close to 30 years, you should enter NO.";
  transferSeasonYear = FranchiseUtils.getYesOrNo(message);

  const teamMsg = "Would you like to transfer over team names from your source file to your target file (For example: Commanders, Bears, etc)? This will also transfer over Team menu colors. Enter yes or no.";
  transferTeamNames = FranchiseUtils.getYesOrNo(teamMsg);

  const stadiumMsg = "Would you like to transfer over stadiums from your source file to your target file? Enter yes or no.";
  transferStadiums = FranchiseUtils.getYesOrNo(stadiumMsg);

  const playerMsg = "Would you like to have Player Asset Names updated in your target file? Enter yes or no (If you don't know what this means, enter yes).";
  transferPlayerAssets = FranchiseUtils.getYesOrNo(playerMsg);
}

function getPlayerTables() {
  const tableIds = [
    TARGET_TABLES.playerTable,
    TARGET_TABLES.freeAgentTable,
    TARGET_TABLES.retiredPlayerTable,
    TARGET_TABLES.hallOfFamePlayerTable,
    TARGET_TABLES.rosterTable,
    TARGET_TABLES.practiceSquadTable,
    TARGET_TABLES.depthChartPlayerTable,
    TARGET_TABLES.teamRoadmapTable,
    TARGET_TABLES.careerDefKPReturnStatsTable,
    TARGET_TABLES.careerOffKPReturnStatsTable,
    TARGET_TABLES.careerOLineStatsTable,
    TARGET_TABLES.careerOffStatsTable,
    TARGET_TABLES.careerDefStatsTable,
    TARGET_TABLES.careerKickingStatsTable
  ];

  const tableArray = tableIds.map(id => targetFranchise.getTableByUniqueId(id));

  handlePlayerTable(sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable));

  return tableArray;
}


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

function getAwardTables() {
  const tableIds = [
    TARGET_TABLES.playerAwardTable,
    TARGET_TABLES.coachAwardTable,
    TARGET_TABLES.awardArrayTable,
    TARGET_TABLES.allTimeAwardTable,
  ];

  const tableArray = tableIds.map(id => targetFranchise.getTableByUniqueId(id));

  return tableArray;
}


function getDraftPickTables() {
  const tableIds = [
    TARGET_TABLES.draftPickTable,
  ];

  const tableArray = tableIds.map(id => targetFranchise.getTableByUniqueId(id));

  return tableArray;

};

async function validateFiles() {
  const seasonInfo = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);
  const sourceSeasonInfo = sourceFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);

  const sourceSeasonInfoRecord = sourceSeasonInfo.records[0];
  const seasonInfoRecord = seasonInfo.records[0];

  const targetCurrentStage = seasonInfoRecord.CurrentStage;

  if (targetCurrentStage !== FranchiseUtils.SEASON_STAGES.PRESEASON) {
    const currentWeekType = seasonInfoRecord['CurrentWeekType'];
    console.log(`ERROR! Target file MUST be in the PreSeason to execute this program. Your target file is currently in the ${currentWeekType}.`);
    console.log("Ensure your target franchise file is in the PreSeason before using this program.");
    FranchiseUtils.EXIT_PROGRAM();
  }

  const sourceSeasonYear = sourceSeasonInfoRecord.CurrentSeasonYear;
  const sourceCurrentStage = sourceSeasonInfoRecord.CurrentStage;

  if (sourceCurrentStage === FranchiseUtils.SEASON_STAGES.OFFSEASON) {
    const continueMsg = "WARNING! The source file you've selected is in the Offseason.\n" +
                        "It's not advisable to use a source file that's in the OffSeason because Draft Class players won't be transferred. Are you sure you want to continue?";
    const continueTransferring = FranchiseUtils.getYesOrNo(continueMsg);

    if (!continueTransferring) {
      FranchiseUtils.EXIT_PROGRAM();
    }

    const sourceCurrentOffseasonStage = sourceSeasonInfoRecord.CurrentOffseasonStage;
    const sourceCurrentYear = sourceSeasonInfoRecord.CurrentYear;
    if (sourceCurrentOffseasonStage < 10) {
      const updatedSeasonYear = sourceSeasonYear + 1;
      const updatedCurrentYear = sourceCurrentYear + 1;
      sourceSeasonInfoRecord.CurrentSeasonYear = updatedSeasonYear;
      sourceSeasonInfoRecord.CurrentYear = updatedCurrentYear;
    }
  }
}
function getOptionalTables() {

  if (!transferSeasonYear) return [];

  
  const tableIds = [
    TARGET_TABLES.seasonInfoTable,
    TARGET_TABLES.leagueHistoryAward,
    TARGET_TABLES.leagueHistoryArray,
    TARGET_TABLES.yearSummary,
    TARGET_TABLES.yearSummaryArray
  ];

  const tableArray = [];
  const tables = tableIds.map(id => targetFranchise.getTableByUniqueId(id));
  tableArray.push(...tables);

  return tableArray;
}

async function emptyRookieStatTracker() {
  const rookieStatTracker = targetFranchise.getTableByUniqueId(TARGET_TABLES.rookieStatTrackerTable);
  await rookieStatTracker.readRecords();

  for (let i = 0; i < rookieStatTracker.header.recordCapacity; i++) {
    const record = rookieStatTracker.records[i];
    if (!record.isEmpty) {
      record.DownsPlayed = 0;
      record.empty();
    }
  }
};

async function emptyMediaGoals() {
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

async function adjustSeasonGameTable() {
  const seasonInfo = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);
  const seasonGame = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonGameTable);

  await FranchiseUtils.readTableRecords([seasonInfo,seasonGame]);

  if (is24To25 && transferSeasonYear && seasonInfo.records[0].CurrentYear > 0) seasonInfo.records[0].CurrentYear--;

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

async function removeUnnecessaryAssetNames() {
  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    const record = playerTable.records[i];
    if (!record.isEmpty) {
      if (!ALL_ASSET_NAMES.includes(record.PLYR_ASSETNAME)) {
        record.PLYR_ASSETNAME = FranchiseUtils.EMPTY_STRING;
      }
    }
  }
}

async function adjustCommentaryValues() {

  const playerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    const record = playerTable.records[i];
    let commentId = 8191;

    if (!record.isEmpty) {
      const lastName = record.LastName;

      // Check if the exact last name exists in the database
      if (COMMENTARY_LOOKUP.hasOwnProperty(lastName)) {
        commentId = COMMENTARY_LOOKUP[lastName];
      } else {
          // Exact match not found, try to find a match after removing suffixes
          const lastNameWithoutSuffix = FranchiseUtils.removeSuffixes(lastName);
          if (COMMENTARY_LOOKUP.hasOwnProperty(lastNameWithoutSuffix)) {
              commentId = COMMENTARY_LOOKUP[lastNameWithoutSuffix];
          } 
      }
      record.PLYR_COMMENT = commentId;
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

/**
 * Generates a merged table mapping between source and target franchise files.
 * This is necessary because table IDs differ between games/franchise files.
 * The function creates a mapping that allows for replacing source binary references with target ones.
 * 
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of objects containing table mappings.
 * Each object includes the table name, unique ID, target ID/associated binary, and the source ID/associated binary.
 */
async function getTableMappings() {

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

  return mergedTableMappings;
}

function clearArrayTables() {
  const tableIds = [
    TARGET_TABLES.draftedPlayersArrayTable,
    TARGET_TABLES.miniGameCompletedArrayTable,
    TARGET_TABLES.drillCompletedTable,
    TARGET_TABLES.focusTrainingTable,
    TARGET_TABLES.rookieStatTrackerArray,
    TARGET_TABLES.storyArrayTable,
    TARGET_TABLES.tweetArrayTable,
    TARGET_TABLES.weeklyAwardTable,
    TARGET_TABLES.lastSeasonWeeklyAwardTable
  ];

  const allTables = tableIds.map(tableId => targetFranchise.getTableByUniqueId(tableId));

  allTables.forEach(table => FranchiseUtils.clearArrayTable(table));
}

async function transferPlayerAbilities(mergedTableMappings) {
  const sourceMainSignatureTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.mainSigAbilityTable);
  const sourceSecondarySignatureTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.secondarySigAbilityTable);

  const mainSignatureTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.mainSigAbilityTable);
  const secondarySignatureTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.secondarySigAbilityTable);
  const signatureArrayTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.signatureArrayTable);

  await FranchiseUtils.emptySignatureTables(targetFranchise);

  const processRecord = (record, primaryTable, secondaryTable, arrayTable) => {
    if (!record.isEmpty) {
      const nextRecordToUse = primaryTable.header.nextRecordToUse;
      const recordCapacity = primaryTable.header.recordCapacity;
      const secondaryNextRecord = secondaryTable.header.nextRecordToUse;
      const secondaryRecordCapacity = secondaryTable.header.recordCapacity;
      const updatedPlayerBinary = replaceBinaryValue(mergedTableMappings, record, 'Player');
      if (updatedPlayerBinary !== null && record.Player !== FranchiseUtils.ZERO_REF) {
        record.Player = updatedPlayerBinary;
      }

      if (nextRecordToUse < recordCapacity) {
        const targetRecord = FranchiseUtils.addRecordToTable(record, primaryTable);
        const binaryRef = getBinaryReferenceData(primaryTable.header.tableId, nextRecordToUse);
        FranchiseUtils.addToArrayTable(arrayTable,binaryRef);
      } else if (secondaryNextRecord < secondaryRecordCapacity) {
        const targetRecord = FranchiseUtils.addRecordToTable(record, secondaryTable);
        const binaryRef = getBinaryReferenceData(secondaryTable.header.tableId, secondaryNextRecord);
        FranchiseUtils.addToArrayTable(arrayTable, binaryRef);
      }
    }
  };

  // Process records for both main and secondary signature tables
  for (const record of sourceMainSignatureTable.records) {
    processRecord(record, mainSignatureTable, secondarySignatureTable, signatureArrayTable);
  }

  for (const record of sourceSecondarySignatureTable.records) {
    processRecord(record, mainSignatureTable, secondarySignatureTable, signatureArrayTable);
  }
}

sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    if (await FranchiseUtils.hasMultiplePlayerTables(sourceFranchise)) {
      await FranchiseUtils.fixPlayerTables(sourceFranchise);
    }

    const sourceGameYear = sourceFranchise.schema.meta.gameYear;
    const targetGameYear = targetFranchise.schema.meta.gameYear;

    is24To25 = sourceGameYear === FranchiseUtils.YEARS.M24 && targetGameYear === FranchiseUtils.YEARS.M25;

    // We're going to read all tables for our source/target franchises so that we don't have to read them again later
    const allSourceTables = [];
    const allTargetTables = [];
    for (const key in SOURCE_TABLES) {
      if (!key.includes('22')) { // Ignore Madden 22 tables
        const sourceTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES[key]);
        allSourceTables.push(sourceTable);
      }
    }

    for (const key in TARGET_TABLES) {
      const targetTable = targetFranchise.getTableByUniqueId(TARGET_TABLES[key]);
      allTargetTables.push(targetTable);
    }

    // We read records for all tables, and we simply continue if there's an error loading a table
    await FranchiseUtils.readTableRecords(allSourceTables,true,sourceFranchise);
    await FranchiseUtils.readTableRecords(allTargetTables,true,targetFranchise);
    
    validateFiles();
    setOptions();

    const mergedTableMappings = await getTableMappings();

    const allTablesArray = [
      getOptionalTables(),
      getPlayerTables(),
      getCoachTables(),
      getAwardTables(),
      getDraftPickTables(),
    ];

    // We need to empty visuals from the target table since we're repopulating them later
    await FranchiseUtils.emptyCharacterVisualsTable(targetFranchise);
    await emptySeasonStatTables();
    const stadiumTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.stadiumTable);

    FranchiseUtils.emptyTable(stadiumTable)
    await clearArrayTables(); // Clear out various array tables
    
    console.log("Now working on transferring all table data...");

    for (const currentTable of allTablesArray.flat()) {
      await handleTable(currentTable, mergedTableMappings);
    }

    await FranchiseUtils.emptyHistoryTables(targetFranchise); // Empty history/acquisition tables
    await FranchiseUtils.emptyAcquisitionTables(targetFranchise);

    await FranchiseUtils.deleteExcessFreeAgents(targetFranchise); // Only keep the top 3500 players
    await fixPlayerTableRow(); // Adjust the default player table row if needed
    await emptyRookieStatTracker(); // Function to empty Rookie Tracker table (Avoid crashing)
    await FranchiseUtils.generateActiveAbilityPlayers(targetFranchise);
    await FranchiseUtils.emptyResignTable(targetFranchise); // Empty and fill the resign tables
    await fillResignTable();
    await FranchiseUtils.regenerateMarketingTables(targetFranchise);

    await emptyMediaGoals(); // Empty media goals table
    await adjustSeasonGameTable(); // Function to update SeasGame table based on current SeasonYear

    await assignFranchiseUsers();
    await adjustCommentaryValues();
    await transferPlayerAbilities(mergedTableMappings);
    await FranchiseUtils.reorderTeams(targetFranchise);

    if (is24To25) {
      const message = "Would you like to remove asset names from the Player table that aren't in Madden 25's Database?";
      const removeAssetNames = FranchiseUtils.getYesOrNo(message);

      if (removeAssetNames) {
        await removeUnnecessaryAssetNames();
      }
    }

    const scheduleMsg = "Would you like to transfer your schedule from your source file to your target file?\n" +
    "This will transfer over both PreSeason and RegularSeason games."; 

    const transferSchedule = FranchiseUtils.getYesOrNo(scheduleMsg);

    if (transferSchedule) {
      console.log("Attempting to transfer your schedule from your source file...");
      const scheduleJson = await SCHEDULE_FUNCTIONS.convertScheduleToJson(sourceFranchise);
      TRANSFER_SCHEDULE_FUNCTIONS.setFranchise(targetFranchise);
      const successfulTransfer = await TRANSFER_SCHEDULE_FUNCTIONS.transferSchedule(scheduleJson);

      if (successfulTransfer) {
        console.log("Successfully transferred schedule.");
      }
    }
    
    console.log("Successfully completed transfer of data.");

    await FranchiseUtils.saveFranchiseFile(targetFranchise);
    FranchiseUtils.EXIT_PROGRAM();
})});



