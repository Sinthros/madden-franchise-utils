// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const path = require('path');
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');
const fs = require('fs');

const bodyTypeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/26/bodyTypeLookup.json'), 'utf8'));
const positionLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/26/PPOSLookup.json'), 'utf8'));
const newSlotLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/26/slotsLookup.json'), 'utf8'));

console.log("This tool will allow you to transfer your Madden 25 roster file's player data into a Madden 26 roster file. It is advised that you use the latest official EA roster as the target roster.\n");

const sourceRosterPath = FranchiseUtils.getSaveFilePath(FranchiseUtils.YEARS.M25, FranchiseUtils.SAVE_TYPES.ROSTER);
const targetRosterPath = FranchiseUtils.getSaveFilePath(FranchiseUtils.YEARS.M26, FranchiseUtils.SAVE_TYPES.ROSTER);

const sourceRoster = new MaddenRosterHelper();
const targetRoster = new MaddenRosterHelper();

const oldToNewSlotMap = {
  1: 0, // Facemask to facemask
  64: 142, // ThighGear to LeftThighWear
  31: 108, // Undershirt to InnerShirt
  4: 125, // JerseyStyle to OuterShirt
  22: 114, // LeftHandgear to LeftHandWear
  23: 115, // RightHandgear to RightHandWear
  21: 120, // LeftWristGear to LeftWristWear
  53: 121, // RightWristGear to RightWristWear
  19: 117, // RightElbowGear to RightElbowWear
  20: 116, // LeftElbowGear to LeftElbowWear
  13: 112, // LeftCalf to LeftCalfWear 
  14: 113, // RightCalf to RightCalfWear
  16: 110, // LeftArm to LeftArmWear
  17: 111, // RightArm to RightArmWear
  27: 127, // Handwarmer to WaistWear
  28: 101, // HandwarmerMod to WaistWearOverride
  61: 106, // GearHelmet to HeadWear
  5: 122, // Mouthpiece to MouthWear
  8: 109, // GearSocks to InnerSocks
  60: 118, // KneeItem to KneeWear
  52: 103, // NoseStrip to EyeWear
  63: 107, // BottomBase to InnerPants
}

async function addRosterPlayers(rosterPlayerTable, rosterVisualsTable, numToAdd) {
  const newPGID = getHighestPGID(rosterPlayerTable) + 1;

  for (let i = 0; i < numToAdd; i++) {
    const newPlayer = rosterPlayerTable.records[0].deepCopyRecord(null, new WeakMap(), true);
    //console.log(`Duped player table record ${i}`);
    const newVisuals = rosterVisualsTable.records[0].deepCopyRecord(null, new WeakMap(), true);
    //console.log(`Duped visuals table record ${i}`);
    newPlayer.PGID = newPGID + i;
    newPlayer.POID = newPGID + i;
    newVisuals.index = newPGID + i;

    rosterPlayerTable.addRecord(newPlayer);
    rosterVisualsTable.addRecord(newVisuals);
  }
}

function getHighestPGID(rosterPlayerTable) {
  let highestPGID = 0;

  for (let i = 0; i < rosterPlayerTable.records.length; i++) {
    const currPlayer = rosterPlayerTable.records[i];
    if (currPlayer.PGID > highestPGID) {
      highestPGID = currPlayer.PGID;
    }
  }

  return highestPGID;
}

async function handlePlayerRecords(sourcePlayerTable, targetPlayerTable, sourceVisualsTable, targetVisualsTable) {
  const fieldsToSkip = ['PGID', 'POID'];

  for (let i = 0; i < sourcePlayerTable.records.length; i++) {
    const sourcePlayer = sourcePlayerTable.records[i];

    // Iterate through every field in the source player record
    for (const field of Object.keys(sourcePlayer.fields)) {
      // Skip over certain fields we don't want to copy
      if (fieldsToSkip.includes(field)) continue;

      if (Object.keys(targetPlayerTable.records[i].fields).includes(field)) {
        targetPlayerTable.records[i].fields[field].value = sourcePlayer.fields[field].value;
      }
    }

    await handleVisualsRecord(sourcePlayer.POID, targetPlayerTable.records[i].POID, sourceVisualsTable, targetVisualsTable);

    const bodyType = bodyTypeLookup[generateBodyType(targetPlayerTable.records[i], 26)];

    targetPlayerTable.records[i].PCBT = bodyType;
    const visualsRecord = targetVisualsTable.records.find(record => record.index === targetPlayerTable.records[i].POID);
    if (visualsRecord) {
      visualsRecord.BTYP = bodyType;
    }
  }
}

async function handleVisualsRecord(sourcePOID, targetPOID, sourceVisualsTable, targetVisualsTable) {
  const sourceVisuals = sourceVisualsTable.records.find(record => record.index === sourcePOID);
  const targetVisuals = targetVisualsTable.records.find(record => record.index === targetPOID);

  if (!sourceVisuals || !targetVisuals) return;

  const fieldsToTransfer = ['ASNM', 'BTYP', 'CFNM', 'CJNO', 'CLNM', 'GENR', 'GNHD', 'HINC', 'SKNT', 'WLBS'];

  for (const field of fieldsToTransfer) {
    if (!Object.keys(sourceVisuals.fields).includes(field) || !Object.keys(targetVisuals.fields).includes(field)) {
      continue;
    }
    targetVisuals.fields[field].value = sourceVisuals.fields[field].value;
  }

  for(let i = targetVisuals.fields['LOUT'].value.numEntries - 1; i >= 0; i--)
  {
    targetVisuals.fields['LOUT'].value.removeRecord(i);
  }

  for(let i = 0; i < sourceVisuals.fields['LOUT'].value.numEntries; i++)
  {
    const newLoadout = sourceVisuals.fields['LOUT'].value.records[i];
    targetVisuals.fields['LOUT'].value.addRecord(newLoadout);
  }

  // Fix slot types for M26
  await fixSlotTypes(targetVisuals.fields['LOUT'].value);
}

async function fixSlotTypes(loadouts) {
  for (let i = loadouts.numEntries - 1; i >= 0; i--) {
    const loadout = loadouts.records[i];
    if (loadout.fields.hasOwnProperty('PINS')) {
      for (let j = loadout.fields['PINS'].value.numEntries - 1; j >= 0; j--) {        
        let pin = loadout.fields['PINS'].value.records[j];
        if (oldToNewSlotMap.hasOwnProperty(pin.SLOT)) {          
          pin.SLOT = oldToNewSlotMap[pin.SLOT];
        }

        if(pin.fields.hasOwnProperty('SLOT') && !newSlotLookup.hasOwnProperty(pin.SLOT)) {
          loadout.fields['PINS'].value.removeRecord(j);
        }
      }
    }
  }
}

function generateBodyType(playerRecord, gameYear = YEARS.M25) {
  // Find key with value of PPOS value
  const position = Object.keys(positionLookup).find(key => positionLookup[key] === playerRecord.PPOS);
  const height = playerRecord.PHGT;
  const weight = playerRecord.PWGT + 160;

  if (gameYear >= FranchiseUtils.YEARS.M26 && weight <= 180) {
    return FranchiseUtils.BODY_TYPES.LEAN;
  }

  if (FranchiseUtils.SPECIAL_TEAM_POSITIONS.includes(position)) {
    return FranchiseUtils.BODY_TYPES.STANDARD;
  }

  if (position === 'QB' || position === 'WR') {
    if (weight >= 210 && height <= 71) {
      return FranchiseUtils.BODY_TYPES.MUSCULAR;
    }
    else if (height >= 76) {
      return FranchiseUtils.BODY_TYPES.THIN;
    }

    return FranchiseUtils.BODY_TYPES.STANDARD;
  }

  if (FranchiseUtils.OLINE_POSITIONS.includes(position)) {
    if (weight >= 300) {
      return FranchiseUtils.BODY_TYPES.HEAVY;
    }

    return FranchiseUtils.BODY_TYPES.MUSCULAR;
  }

  if (FranchiseUtils.LINEBACKER_POSITIONS.includes(position) || position === 'TE' || position === 'FB') {
    return FranchiseUtils.BODY_TYPES.MUSCULAR;
  }

  if (FranchiseUtils.DEFENSIVE_LINE_POSITIONS.includes(position)) {
    if (weight >= 275) {
      return FranchiseUtils.BODY_TYPES.HEAVY;
    }

    return FranchiseUtils.BODY_TYPES.MUSCULAR;
  }

  if (position === 'HB') {
    if (weight >= 220) {
      return FranchiseUtils.BODY_TYPES.MUSCULAR;
    }
    else if (weight >= 180) {
      return FranchiseUtils.BODY_TYPES.STANDARD;
    }

    return FranchiseUtils.BODY_TYPES.THIN;
  }

  if (FranchiseUtils.DEFENSIVE_BACK_POSITIONS.includes(position)) {
    if (weight >= 180) {
      return FranchiseUtils.BODY_TYPES.STANDARD;
    }

    return FranchiseUtils.BODY_TYPES.THIN;
  }
  return FranchiseUtils.BODY_TYPES.STANDARD;
}

async function clearAllInjuries(injuryTable) {
  const numRecords = injuryTable.numEntries;

  for (let i = 0; i < numRecords; i++) {
    injuryTable.records[i].PGID = 0;
    injuryTable.records[i].TGID = 0;
  }
}

async function removeRosterPlayers(rosterPlayerTable, rosterVisualsTable, numToRemove) {
  for (let i = 0; i < numToRemove; i++) {
    const playerToRemove = rosterPlayerTable.records[rosterPlayerTable.records.length - 1];
    rosterVisualsTable.removeRecord(playerToRemove.POID);
    rosterPlayerTable.removeRecord(rosterPlayerTable.records.length - 1);
  }
}

sourceRoster.load(sourceRosterPath).then(async () => {
  await targetRoster.load(targetRosterPath);

  console.log("\nBeginning transfer...");

  const sourcePlayerTable = sourceRoster.file.PLAY;
  const targetPlayerTable = targetRoster.file.PLAY;

  const sourceVisualsTable = sourceRoster.file.PLEX;
  const targetVisualsTable = targetRoster.file.BLOB.records[0].BLBM;

  const sourcePlayerCount = sourcePlayerTable.records.length;
  const targetPlayerCount = targetPlayerTable.records.length;

  if (targetRoster.file.INJY) {
    await clearAllInjuries(targetRoster.file.INJY);
  }

  if (sourcePlayerCount > targetPlayerCount) {
    const playersToAdd = sourcePlayerCount - targetPlayerCount;

    await addRosterPlayers(targetPlayerTable, targetVisualsTable, playersToAdd);
  }
  else if (targetPlayerCount > sourcePlayerCount) {
    const playersToRemove = targetPlayerCount - sourcePlayerCount;

    await removeRosterPlayers(targetPlayerTable, targetVisualsTable, playersToRemove);
  }

  await handlePlayerRecords(sourcePlayerTable, targetPlayerTable, sourceVisualsTable, targetVisualsTable);

  console.log("\nRoster transferred successfully.");
  console.log("\nIMPORTANT: Please note that you will have to manually reorder the depth chart in-game for each team before using the roster. Otherwise, you may run into crashes/other issues.\n");

  await saveRosterFile(targetRoster);
  FranchiseUtils.EXIT_PROGRAM();

});

async function saveRosterFile(roster) {
  const save = FranchiseUtils.getYesOrNo("Would you like to save the converted roster? Enter yes or no.");

  if (save) {
    await roster.save();
    console.log("Roster saved successfully.");
  }
  else {
    console.log("Roster not saved.");
  }
}