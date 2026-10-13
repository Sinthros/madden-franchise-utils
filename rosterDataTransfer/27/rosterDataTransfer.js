// Required modules
const FranchiseUtils = require('../../Utils/FranchiseUtils');
const path = require('path');
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');
const fs = require('fs');

const bodyTypeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/bodyTypeLookup.json'), 'utf8'));
const positionLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/PPOSLookup.json'), 'utf8'));
const newSlotLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/slotsLookup.json'), 'utf8'));

console.log("This tool will allow you to transfer your Madden 26 roster file's player data into a Madden 27 roster file. It is advised that you use the latest official EA roster as the target roster.\n");

const sourceRosterPath = FranchiseUtils.getSaveFilePath(FranchiseUtils.YEARS.M26, FranchiseUtils.SAVE_TYPES.ROSTER);
const targetRosterPath = FranchiseUtils.getSaveFilePath(FranchiseUtils.YEARS.M27, FranchiseUtils.SAVE_TYPES.ROSTER);

const sourceRoster = new MaddenRosterHelper();
const targetRoster = new MaddenRosterHelper();

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

async function handlePlayerRecords(sourcePlayerTable, targetPlayerTable, sourceVisualsTable, targetVisualsTable, targetContractsTable) {
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

    if(sourcePlayer.TGID !== 1009)
      await handleContractRecord(i, targetPlayerTable.records[i].PGID, sourcePlayer, targetContractsTable);

    
    const bodyType = bodyTypeLookup[generateBodyType(targetPlayerTable.records[i], 27)];

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
  /*
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
  */

  targetVisuals.fields['LOUT'].value = sourceVisuals.fields['LOUT'].value;
}

async function handleTeamRecords(sourceTeamTable, targetTeamTable) {
  const fieldsToSkip = [];

  for (let i = 0; i < sourceTeamTable.records.length; i++) {
    const sourceTeam = sourceTeamTable.records[i];
    const targetTeam = targetTeamTable.records[i];

    // Iterate through every field in the source team record
    for (const field of Object.keys(sourceTeam.fields)) {
      // Skip over certain fields we don't want to copy
      if (fieldsToSkip.includes(field)) continue;

      if (Object.keys(targetTeam.fields).includes(field)) {
        targetTeam.fields[field].value = sourceTeam.fields[field].value;
      }
    }
  }
}

async function handleContractRecord(index, targetPGID, sourcePlayer, targetContractsTable) {
  if(index >= targetContractsTable.records.length) {
    targetContractsTable.addRecord(targetContractsTable.records[0].deepCopyRecord(null, new WeakMap(), true));
    index = targetContractsTable.records.length - 1; // Update index to point to the newly added record
  }
  
  const targetContract = targetContractsTable.records[index];
  targetContract.PGID = targetPGID;

  for (const field of Object.keys(targetContract.fields)) {
    if(field === 'PGID') continue;

    if (Object.keys(sourcePlayer.fields).includes(field)) {
      targetContract.fields[field].value = sourcePlayer.fields[field].value;
    }
  }

  targetContract.CNTC = 0;
  targetContract.CTVY = 0;
  targetContract.CSGY = 0;

  targetContract.CTCY = Math.max(0, sourcePlayer.PVCO);
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

async function clearAllDna(dnaTable) {
  const numRecords = dnaTable.numEntries;

  for (let i = numRecords - 1; i >= 0; i--) {
    //dnaTable.removeRecord(i);
    dnaTable.records[i].PGID = 0;
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

  const sourceTeamTable = sourceRoster.file.TEAM;
  const targetTeamTable = targetRoster.file.TEAM;

  const sourceVisualsTable = sourceRoster.file.BLOB.records[0].BLBM;
  const targetVisualsTable = targetRoster.file.BLOB.records[0].BLBM;

  const targetContractsTable = targetRoster.file.PLCT;

  const sourcePlayerCount = sourcePlayerTable.records.length;
  const targetPlayerCount = targetPlayerTable.records.length;

  if (targetRoster.file.INJY) {
    await clearAllInjuries(targetRoster.file.INJY);
  }

  if(targetRoster.file.PRSN) {
    await clearAllDna(targetRoster.file.PRSN);
  }

  if (sourcePlayerCount > targetPlayerCount) {
    const playersToAdd = sourcePlayerCount - targetPlayerCount;

    await addRosterPlayers(targetPlayerTable, targetVisualsTable, playersToAdd);
  }
  else if (targetPlayerCount > sourcePlayerCount) {
    const playersToRemove = targetPlayerCount - sourcePlayerCount;

    await removeRosterPlayers(targetPlayerTable, targetVisualsTable, playersToRemove);
  }

  await handlePlayerRecords(sourcePlayerTable, targetPlayerTable, sourceVisualsTable, targetVisualsTable, targetContractsTable);

  await handleTeamRecords(sourceTeamTable, targetTeamTable);

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