const { getBinaryReferenceData } = require('madden-franchise/services/utilService');


const FranchiseUtils = require('../Utils/FranchiseUtils');
const ISON_FUNCTIONS = require('../isonParser/isonFunctions');
const VISUAL_FUNCTIONS = require('../Utils/characterVisualsLookups/characterVisualFunctions');

const VISUAL_KEYS_TO_REMOVE = [
  "genericHeadName",
  "genericHead",
  "skinToneScale",
  "containerId",
  "assetName",
  "heightInches"
  //"firstName",
  //"lastName",
  //"skinTone",
  //"weightPounds"
];

const ZERO_PLAYER_COLUMNS = [
  "GameStats",
  "CharacterVisuals",
  "SeasonalGoal",
  "WeeklyGoals",
  "SeasonStats",
  "CareerStats"
];

const MAX_DRAFT_PLAYERS = 450;

const SOURCE_VALID_YEARS = [FranchiseUtils.YEARS.M24]
const TARGET_VALID_YEARS = [FranchiseUtils.YEARS.M25];
  
console.log("In this program, you can convert a Draft Class from your Madden 24 Franchise to a Madden 25 franchise file.");
console.log("Your SOURCE franchise file will have the data you want to transfer. Your TARGET franchise file is the one you'll be transferring the data to.");
console.log("Please note that both franchise files MUST have Draft Class Scouting active.");

const sourceFranchise = FranchiseUtils.init(SOURCE_VALID_YEARS, {promptForBackup: false, isAutoUnemptyEnabled: false});
const targetFranchise = FranchiseUtils.init(TARGET_VALID_YEARS, {customFranchiseMessage: "Please enter the name of your Madden 25 franchise file (such as CAREER-BEARS).", promptForBackup: true, isAutoUnemptyEnabled: true});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

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

    try { // We should always regenerate coach visuals if from 24 to 25
      jsonData = isPlayer ? JSON.parse(visualsRecord.RawData) : await VISUAL_FUNCTIONS.getGeneratedCoachVisual(sourceCoachTable,sourceRecord.index,"N/A",COACH_VISUAL_LOOKUP_M25);
    } catch (error) {
        jsonData = isPlayer ? await VISUAL_FUNCTIONS.getGeneratedPlayerVisual(sourcePlayerTable,sourceRecord.index)
        : await VISUAL_FUNCTIONS.getGeneratedCoachVisual(sourceCoachTable,sourceRecord.index,"N/A",COACH_VISUAL_LOOKUP_M25);
    }

  }

  else { // If source file is 24, we can generate the visual
    jsonData = isPlayer ? await VISUAL_FUNCTIONS.getGeneratedPlayerVisual(sourcePlayerTable,sourceRecord.index)
    : await VISUAL_FUNCTIONS.getGeneratedCoachVisual(sourceCoachTable,sourceRecord.index,"N/A",COACH_VISUAL_LOOKUP_M25);
  }

  genericHead = jsonData.genericHeadName;

  if (jsonData === null) {
    jsonData = {}; // Should never happen, but just to be safe
  }

  
  VISUAL_KEYS_TO_REMOVE.forEach(key => {
    FranchiseUtils.removeKeyFromJson(jsonData, key);
  });

  ISON_FUNCTIONS.jsonVisualsToIson(targetVisualsTable,nextRecord,jsonData); // Set the data in the visuals table

  targetRecord.CharacterVisuals = getBinaryReferenceData(targetVisualsTable.header.tableId, nextRecord);

  targetRecord.GenericHeadAssetName = typeof genericHead !== 'undefined' ? genericHead : "";

  targetRecord.CharacterBodyType = FranchiseUtils.approximateBodyType(jsonData);

}

async function validateFiles() {
  const franchiseTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.franchiseTable);

  await FranchiseUtils.readTableRecords([franchiseTable]);

  if (!FranchiseUtils.isReferenceColumn(franchiseTable.records[0],'DraftClassPlayers')) {
    console.error("Error: Target file does not have Draft Class Scouting active. This is active during anytime besides the Preseason.");
    FranchiseUtils.EXIT_PROGRAM();

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

sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    if (await FranchiseUtils.hasMultiplePlayerTables(sourceFranchise)) {
      await FranchiseUtils.fixPlayerTables(sourceFranchise);
    }
    
    validateFiles();

    const draftTableArrayId = await FranchiseUtils.deleteCurrentDraftClass(targetFranchise);

    if (draftTableArrayId === null) {
      console.error("Error deleting current draft class from target file. There is no found array table to hold draft player records.");
      FranchiseUtils.EXIT_PROGRAM();
    }

    const sourcePlayerTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
    const targetPlayerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable)
    const draftPlayerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.draftClassTable);
    const draftPlayerArray = targetFranchise.getTableById(draftTableArrayId);
    const seasonInfoTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.seasonInfoTable);
  
    await FranchiseUtils.readTableRecords([sourcePlayerTable,targetPlayerTable,seasonInfoTable,draftPlayerTable,draftPlayerArray]);

    const draftPlayerNumMembers = draftPlayerArray.header.numMembers;

    // Get source DC players
    const playersToTransfer = sourcePlayerTable.records.filter(record => !record.isEmpty && record.ContractStatus === FranchiseUtils.CONTRACT_STATUSES.DRAFT)

    if (draftPlayerNumMembers < MAX_DRAFT_PLAYERS) {
      console.log(`Warning: This Franchise File can only handle a maximum of ${draftPlayerNumMembers} Draft Players. This is likely due to someone changing the Draft Class limit.`)
      console.log("Please note that this could result in not retrieving all desired players.");
    }

    const sortedPlayers = playersToTransfer.sort((a, b) => {
      if (a.PLYR_DRAFTROUND !== b.PLYR_DRAFTROUND) {
        // If the DRAFT_ROUND is different, sort by DRAFT_ROUND in ascending order
        return a.PLYR_DRAFTROUND - b.PLYR_DRAFTROUND;
      } else {
        // If DRAFT_ROUND is the same, sort by DRAFTPICK in ascending order
        return a.PLYR_DRAFTPICK - b.PLYR_DRAFTPICK;
      }
    }).slice(0, draftPlayerNumMembers);  

    if (sortedPlayers.length === 0) {
      console.log(`Error: No Draft players to transfer from source file.`);
      FranchiseUtils.EXIT_PROGRAM();
    }

    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      const targetRecord = FranchiseUtils.addRecordToTable(player, targetPlayerTable, { zeroColumns: ZERO_PLAYER_COLUMNS });
      await handleCharacterVisuals(player,targetRecord,FranchiseUtils.TABLE_NAMES.PLAYER); // Transfer visuals

      const draftTableRow = await FranchiseUtils.addDraftPlayer(draftPlayerTable,targetPlayerTable,targetRecord, i);

      if (draftTableRow !== null) {
        FranchiseUtils.addToArrayTable(draftPlayerArray,getBinaryReferenceData(draftPlayerTable.header.tableId, draftTableRow));
      }
    }
      
    console.log("Successfully transferred Draft Class to the target file.");

    await FranchiseUtils.saveFranchiseFile(targetFranchise);
    FranchiseUtils.EXIT_PROGRAM();
})});



