const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');
const path = require('path');
const allPlayerVisuals = JSON.parse(fs.readFileSync(path.join(__dirname, 'playerVisualsLookup.json'), 'utf8'));
const basePlayerVisualJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'basePlayerVisualLookup.json'), 'utf8'));
const allCoachVisuals = JSON.parse(fs.readFileSync(path.join(__dirname, 'coachVisualsLookup.json'), 'utf8'));
const baseCoachVisualJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseCoachVisualLookup.json'), 'utf8'));
const ZERO_REF = '00000000000000000000000000000000';


async function bin2Dec(binary) {
  return parseInt(binary, 2);
};



async function getPlayerHeadValues(playerTable, row,allPlayerVisuals) {
  let genericHeadName = playerTable.records[row]["PLYR_GENERICHEAD"];
  let genericHead = allPlayerVisuals["genericHead"][genericHeadName] || allPlayerVisuals["genericHead"]["DefaultValue"];
  let skinTone;
  // Check if the first character is a number
  if (!isNaN(parseInt(genericHeadName.charAt(0)))) {
    skinTone = parseInt(genericHeadName.charAt(0));
  } else {
    // Default to 1 if the first character is not a number
    skinTone = 1;
  }
  genericHeadName = "gen_" + genericHeadName;



  return [genericHeadName,genericHead,skinTone];
}

async function getPlayerMorphValues(playerTable, row) {

  const attributes = [
    "MetaMorph_ArmsBase",
    "MetaMorph_ArmsBarycentric",
    "MetaMorph_CalfsBase",
    "MetaMorph_CalfsBarycentric",
    "MetaMorph_ChestBase",
    "MetaMorph_ChestBarycentric",
    "MetaMorph_FeetBase",
    "MetaMorph_FeetBarycentric",
    "MetaMorph_GluteBase",
    "MetaMorph_GluteBarycentric",
    "MetaMorph_GutBase",
    "MetaMorph_GutBarycentric",
    "MetaMorph_ThighsBase",
    "MetaMorph_ThighsBarycentric",
  ];

  const values = await Promise.all(
    attributes.map((attribute) => playerTable.records[row][attribute])
  );

  // Format the values with up to 6 decimal places
  const formattedValues = values.map((value) => {
    if (typeof value === 'number') {
      return value.toFixed(6); // Format to 6 decimal places
    } else {
      return value; // Handle non-numeric values (e.g., if the value is not a number)
    }
  });

  return formattedValues;
}

async function updateMorphValues(characterVisualsKey,baseMorph,barycentricMorph,jsonToUpdate) {

    // Find the Base category and slotType we need to update
    const baseCategory = jsonToUpdate.loadouts.find(loadout => loadout.loadoutCategory === "Base");
    const slotToUpdate = baseCategory.loadoutElements.find(element => element.slotType === characterVisualsKey);

    // Update the blends directly
    slotToUpdate.blends[0].baseBlend = baseMorph;
    slotToUpdate.blends[0].barycentricBlend = barycentricMorph;
    return jsonToUpdate;

}

async function getCoachValues(coachTable, i) {
  const { //Smart way to get all of the columns we need dynamically
    AssetName: assetName,
    FaceShape: genericHeadName,
    FirstName: firstName,
    LastName: lastName,
    Height: height,
    SkinTone: skinToneValue,
  } = coachTable.records[i];

  const lastDigit = Number.parseInt(skinToneValue.slice(-1), 10); // Try to get the last digit from skinToneValue
  const skinTone = !isNaN(lastDigit) ? lastDigit : 1; //If it's a digit, keep the value, else default to skin tone 1

  return [assetName, genericHeadName, firstName, lastName, height, skinTone];
};

async function updateCoachVisuals(coachValues, allCoachVisuals, jsonToUpdate,visualMorphKeys, size = "N/A") {
  const [assetName, genericHeadName, firstName, lastName, height, skinTone] = coachValues;

  // Get lookup values if they exist for this coach, OR get the default lookup values
  const visualsLookup = allCoachVisuals[assetName] || allCoachVisuals["DefaultValue"];

  if (assetName === "") { // If no asset name, we can delete it from the json
    delete jsonToUpdate.assetName;
  } else {
    jsonToUpdate.assetName = assetName;
  }
  jsonToUpdate.genericHeadName = genericHeadName;
  jsonToUpdate.firstName = firstName;
  jsonToUpdate.lastName = lastName;
  jsonToUpdate.heightInches = height;
  jsonToUpdate.skinTone = skinTone;
  jsonToUpdate.containerId = visualsLookup['containerId'];

  // Get the generic head value or the default value if we can't find it
  const genericHead = allCoachVisuals["genericHead"][genericHeadName] || allCoachVisuals["genericHead"]["DefaultValue"];
  jsonToUpdate.genericHead = genericHead;

  const coachOnFieldLoadout = jsonToUpdate.loadouts.find(loadout => loadout.loadoutType === "CoachOnField");

  const loadoutSlotTypesToUpdate = [ 
    "LeftShoe",
    "RightShoe",
    "JerseyStyle",
    "PantsGear",
    "Hat",
    "Headset"
  ];


  for (const slotType of loadoutSlotTypesToUpdate) { //Iterate through coach equipment and update them
    coachOnFieldLoadout.loadoutElements.find(element => element.slotType === slotType).itemAssetName = visualsLookup[slotType];
  }


  // Get the base loadout and iterate through the morphs
  const baseLoadout = jsonToUpdate.loadouts.find(loadout => loadout.loadoutType === "Base");

  for (const morph of visualMorphKeys) {
    const element = baseLoadout.loadoutElements.find(element => element.slotType === morph);
  
    if (size === 'Thin') {
      element.blends[0].barycentricBlend = 0.0;
      element.blends[0].baseBlend = 0.0;
    } else if (size === 'Base') {
      element.blends[0].barycentricBlend = 1.0;
      element.blends[0].baseBlend = 1.0;
    } else if (size === 'Heavy') {
      element.blends[0].barycentricBlend = 2.0;
      element.blends[0].baseBlend = 2.0;
    } else {
      element.blends[0].barycentricBlend = parseFloat(visualsLookup[`${morph}BarycentricBlend`]);
      element.blends[0].baseBlend = parseFloat(visualsLookup[`${morph}BaseBlend`]);
    }
  }
  return jsonToUpdate;
}

async function getPlayerGearValues(playerTable, row) {
  // Get all of the headers from the player table for equipment
  const attributes = [
    'PLYR_LEFTARMSLEEVE',
    'PLYR_RIGHTARMSLEEVE',
    'PLYR_GRASSLEFTELBOW',
    'PLYR_GRASSRIGHTELBOW',
    'PLYR_GRASSLEFTHAND',
    'PLYR_GRASSRIGHTHAND',
    'PLYR_HANDWARMER',
    'PLYR_FACEMASK',
    'PLYR_HELMET',
    'PLYR_EYEPAINT',
    'PLYR_VISOR',
    'PLYR_JERSEYSLEEVE',
    'PLYR_MOUTHPIECE',
    'PLYR_NECKPAD',
    'PLYR_LEFTSHOE',
    'PLYR_RIGHTSHOE',
    'PLYR_SOCK_HEIGHT',
    'PLYR_LEFTSPAT',
    'PLYR_RIGHTSPAT',
    'PLYR_TOWEL',
    'PLYR_GRASSLEFTWRIST',
    'PLYR_GRASSRIGHTWRIST',
    'PLYR_LEFTTHIGH',
    'PLYR_RIGHTTHIGH',
    'PLYR_LEFTKNEE',
    'PLYR_RIGHTKNEE',
    'PLYR_FLAKJACKET',
    'PLYR_BACKPLATE'
  ];

  // Get all of the values for the attributes
  const values = await Promise.all(attributes.map(attribute => playerTable.records[row][attribute]));

  const [leftArmSleeve, rightArmSleeve, leftElbowGear, rightElbowGear, leftHandgear, rightHandgear,
    handWarmer, facemask, helmet, facePaint, visor, jerseyStyle, mouthPiece, neckPad, leftShoe, rightShoe,
    sockHeight, leftSpat, rightSpat, towel, leftWristGear, rightWristGear, leftThighGear, rightThighGear,
    leftKneeGear, rightKneeGear, flakJacket,backPlate] = values;

  let thighGear; // For thigh/knee gear, if one of them is large, set to large
  if (leftThighGear === 'Large' || rightThighGear === 'Large') {
    thighGear = 'Large';
  } else {
    thighGear = 'Small';
  }

  let kneeGear;
  if (leftKneeGear === 'Large' || rightKneeGear === 'Large') {
    kneeGear = 'Large';
  } else {
    kneeGear = 'Small';
  }

  const shoulderPads = 'DefaultValue'; // There is no shoulder pads value in the player table

  return [leftArmSleeve, rightArmSleeve, leftElbowGear, rightElbowGear, leftHandgear, rightHandgear,
    handWarmer, facemask, helmet, facePaint, visor, jerseyStyle, mouthPiece, neckPad, leftShoe, rightShoe,
    sockHeight, leftSpat, rightSpat, towel, leftWristGear, rightWristGear, thighGear, kneeGear, flakJacket, backPlate, shoulderPads];
}

async function updateGearVisuals(characterVisualsKey, playerTableValue, allPlayerVisuals, jsonToUpdate, morphVal = 0) {
  // Get the current lookup value OR the default value if we can't find it
  const lookupValue = allPlayerVisuals[characterVisualsKey][playerTableValue] || allPlayerVisuals[characterVisualsKey]["DefaultValue"];

  if (lookupValue === 'DELETE_FROM_JSON') { // If DELETE_FROM_JSON, remove it
    jsonToUpdate = await removePlayerVisualValue(characterVisualsKey, jsonToUpdate);
  } else {
    // Get PlayerOnField loadout and slotType
    const playerOnFieldLoadout = jsonToUpdate.loadouts.find(loadout => loadout.loadoutType === 'PlayerOnField');
    const slotElement = playerOnFieldLoadout.loadoutElements.find(element => element.slotType === characterVisualsKey);

    if (characterVisualsKey === 'FlakJacket' || characterVisualsKey === 'Backplate') { // Set morphs IF Flakjacket/Backplate
      slotElement.blends = [{ barycentricBlend: morphVal, baseBlend: morphVal }];
    }

    // If a backwards HandWarmer, we add a new modifier to tell the game to make it backwards
    if (playerTableValue === 'Backwards' && characterVisualsKey === 'HandWarmer') {
      playerOnFieldLoadout.loadoutElements.push({
        itemAssetName: 'HandwarmerStyle_Back',
        slotType: 'HandWarmerMod'
      });
    }

    slotElement.itemAssetName = lookupValue; // Set the value
  }

  return jsonToUpdate;
};

async function removePlayerVisualValue(characterVisualsKey,jsonToUpdate) {
   //Remove the element with the specified slotType
   jsonToUpdate.loadouts.find(loadout => loadout.loadoutType === "PlayerOnField").loadoutElements = jsonToUpdate.loadouts
   .find(loadout => loadout.loadoutType === "PlayerOnField").loadoutElements.filter(element => element.slotType !== characterVisualsKey);

   return jsonToUpdate;

};

async function removeEmptyCoachBlends(jsonToUpdate) {
  // Iterate through loadouts to find "Base" loadoutCategory
  for (const loadout of jsonToUpdate.loadouts) {
    if (loadout.loadoutCategory === "Base") {
      // Iterate through loadoutElements
      for (const loadoutElement of loadout.loadoutElements) {
        // Check if the slotType is one of the specified types (I don't think this is actually needed?)
        const allowedSlotTypes = ["ArmSize", "CalfBlend", "Chest", "Feet", "Glute", "Gut", "Thighs"];
        if (allowedSlotTypes.includes(loadoutElement.slotType)) {
          // Check if baseBlend and barycentricBlend are both 0
          if (loadoutElement.blends[0].baseBlend === 0 && loadoutElement.blends[0].barycentricBlend === 0) {
            // Remove the blends key from loadoutElement
            delete loadoutElement.blends;
          } else {
            // Remove baseBlend if it's 0
            if (loadoutElement.blends[0].baseBlend === 0) {
              delete loadoutElement.blends[0].baseBlend;
            }
            
            // Remove barycentricBlend if it's 0
            if (loadoutElement.blends[0].barycentricBlend === 0) {
              delete loadoutElement.blends[0].barycentricBlend;
            }
          }
        }
      }
    }
  }
  return jsonToUpdate;
}
async function removeEmptyPlayerBlends(jsonToUpdate) {
  for (const loadout of jsonToUpdate.loadouts) {
    if (loadout.loadoutCategory === "Base") {
      // Iterate through loadoutElements
      for (const loadoutElement of loadout.loadoutElements) {
        // Check if baseBlend and barycentricBlend are both 0
        if (loadoutElement.blends[0].baseBlend === 0 && loadoutElement.blends[0].barycentricBlend === 0) {
          // Remove the blends key from loadoutElement
          delete loadoutElement.blends;
        } else {
          // Remove baseBlend if it's 0
          if (loadoutElement.blends[0].baseBlend === 0) {
            delete loadoutElement.blends[0].baseBlend;
          }
          
          // Remove barycentricBlend if it's 0
          if (loadoutElement.blends[0].barycentricBlend === 0) {
            delete loadoutElement.blends[0].barycentricBlend;
          }
        }
      }
    }
  }

  return jsonToUpdate;
}

async function updateAllCharacterVisuals(franchise) {
  // This entire block is pretty gross and can probably be optimized...

  const characterVisuals = franchise.getTableByUniqueId(1429178382); //Grab the tables we need and read them
  const playerTable = franchise.getTableByUniqueId(1612938518);
  const coachTable = franchise.getTableByUniqueId(1860529246);
  await characterVisuals.readRecords();
  await playerTable.readRecords();
  await coachTable.readRecords();
  const visualsRecordCapcity = characterVisuals.header.recordCapacity;


  // Visual keys for gear (for players) and morphs
  const visualGearKeys = [
    "LeftArm",
    "RightArm",
    "LeftElbowGear",
    "RightElbowGear",
    "LeftHandgear",
    "RightHandgear",
    "HandWarmer",
    "Facemask",
    "GearHelmet",
    "FacePaint",
    "Visor",
    "JerseyStyle",
    "Mouthpiece",
    "Neckpad",
    "LeftShoe",
    "RightShoe",
    "GearSocks",
    "LeftSpat",
    "RightSpat",
    "Towel",
    "LeftWristGear",
    "RightWristGear",
    "ThighGear",
    "KneeItem",
    "FlakJacket",
    "Backplate",
    "Shoulderpads"
  ];

  // Visual morph keys for players and coaches
  const visualMorphKeys = [
    "ArmSize",
    "CalfBlend",
    "Chest",
    "Feet",
    "Glute",
    "Gut",
    "Thighs"
  ];

  const playerContractStatusIgnore = ['None','Deleted']; //If the player has either of these statuses, don't generate visuals
  
  for (let i = 0; i < coachTable.header.recordCapacity;i++) {
    // If empty OR empty offensive playbook/defensive playbook (not a real coach), don't set visuals
    if (coachTable.records[i].isEmpty === true || (coachTable.records[i]['OffensivePlaybook'] === ZERO_REF && coachTable.records[i]['DefensivePlaybook'] === ZERO_REF )) {
      continue
    }

    let jsonToUpdate = JSON.parse(JSON.stringify(baseCoachVisualJson)); // Get our current base JSON

    const coachValues = await getCoachValues(coachTable, i);

    jsonToUpdate = await updateCoachVisuals(coachValues,allCoachVisuals,jsonToUpdate,visualMorphKeys)

    jsonToUpdate = await removeEmptyCoachBlends(jsonToUpdate)

    
    let characterVisualsRef = coachTable.records[i]['CharacterVisuals'];
    let characterVisualsRow = await bin2Dec(characterVisualsRef.slice(15));

    if (characterVisualsRef === ZERO_REF) { // If it's all zeroes, we need to set a new reference
      characterVisualsRow = characterVisuals.header.nextRecordToUse; // Get the first empty row
      if (characterVisualsRow >= visualsRecordCapcity) {
        console.log("ERROR - The CharacterVisuals table has run out of space. Your changes have not been saved.");
        console.log(`This means that the amount of players + coaches in your Franchise File exceeds ${visualsRecordCapcity}. Enter anything to exit.`)
        prompt();
        process.exit(0);
      }
      characterVisualsRef = getBinaryReferenceData(characterVisuals.header.tableId,characterVisualsRow); //Convert to binary
      coachTable.records[i]['CharacterVisuals'] = characterVisualsRef;
    }
    else { //Else, simply convert the binary ref to the row number value
      characterVisualsRow = await bin2Dec(characterVisualsRef.slice(15));
    }

    characterVisuals.records[characterVisualsRow]['RawData'] = jsonToUpdate; //Set the RawData of the CharacterVisuals row = our updated JSON
    
  }


  for (let i = 0; i < playerTable.header.recordCapacity;i++ ) { // Iterate through the player table
    if (playerTable.records[i].isEmpty === true || playerContractStatusIgnore.includes(playerTable.records[i]['ContractStatus'])) { //If empty or invalid contract status, continue
      continue
    }

    let position = playerTable.records[i]['Position'];




    //This is a roundabout way to get a unique version of the base player JSON for each player, since we'll be editing it
    let jsonToUpdate = JSON.parse(JSON.stringify(basePlayerVisualJson));
    const gearValues = await getPlayerGearValues(playerTable, i); //Get all the gear values for this player

    for (let j = 0; j < visualGearKeys.length; j++) { //Iterate over the keys of the visual gear
      if (visualGearKeys[j] === 'FlakJacket') { //If it's FlakJacket or BackPlate, we have to utilize an optional parameter for its morph
        const flakJacketAmount = parseFloat(playerTable.records[i]['MetaMorph_FlakJacketAmount'].toFixed(2)); //In the player table it can be several digits, but here we only want 2 digits
        jsonToUpdate = await updateGearVisuals(visualGearKeys[j], gearValues[j], allPlayerVisuals, jsonToUpdate, flakJacketAmount);
      }
      else if (visualGearKeys[j] === 'Backplate') {
        const backPlateAmount = parseFloat(playerTable.records[i]['MetaMorph_BackPlateAmount'].toFixed(2));
        jsonToUpdate = await updateGearVisuals(visualGearKeys[j], gearValues[j], allPlayerVisuals, jsonToUpdate, backPlateAmount);
      }
      else { //Otherwise, update the gear normally
        jsonToUpdate = await updateGearVisuals(visualGearKeys[j], gearValues[j], allPlayerVisuals, jsonToUpdate);
      }
      
    }

    const [genericHeadName,genericHead,skinTone] = await getPlayerHeadValues(playerTable, i,allPlayerVisuals); //Get head name/head/skin tone dynamically
    jsonToUpdate.genericHeadName = genericHeadName; //Setting these is very simple in the JSON
    jsonToUpdate.genericHead = genericHead;
    jsonToUpdate.skinTone = skinTone;

    const morphValues = await getPlayerMorphValues(playerTable,i) //Now we need to get the morph values

    for (let j = 0; j < visualMorphKeys.length; j++) { //Iterate over the visual morph keys
      const characterVisualsKey = visualMorphKeys[j]; 
      const baseMorph = morphValues[j * 2]; //Each morph key has 2 values back to back - This logic allows us to get both
      const barycentricMorph = morphValues[j * 2 + 1];
    
      // Update the morphs in the JSON
      jsonToUpdate = await updateMorphValues(characterVisualsKey, baseMorph, barycentricMorph, jsonToUpdate);
    }

    jsonToUpdate = await removeEmptyPlayerBlends(jsonToUpdate);

    let characterVisualsRef = playerTable.records[i]['CharacterVisuals']; //Next, get the current row reference to the Charactervisuals table
    let characterVisualsRow;
    
    if (characterVisualsRef === ZERO_REF) { // If it's all zeroes, we need to set a new reference
      characterVisualsRow = characterVisuals.header.nextRecordToUse; // Get the first empty rowc

      if (characterVisualsRow >= visualsRecordCapcity) {
        console.log("ERROR - The CharacterVisuals table has run out of space. Your changes have not been saved.");
        console.log(`This means that the amount of players + coaches in your Franchise File exceeds ${visualsRecordCapcity}. Enter anything to exit.`)
        prompt();
        process.exit(0);
      }
      characterVisualsRef = getBinaryReferenceData(characterVisuals.header.tableId,characterVisualsRow); //Convert to binary
      playerTable.records[i]['CharacterVisuals'] = characterVisualsRef;
    }

    else { //Else, simply convert the binary ref to the row number value
      characterVisualsRow = await bin2Dec(characterVisualsRef.slice(15));
    }

    characterVisuals.records[characterVisualsRow]['RawData'] = jsonToUpdate; //Set the RawData of the CharacterVisuals row = our updated JSON
  }
}

module.exports = {
  getPlayerHeadValues,
  getPlayerMorphValues,
  updateMorphValues,
  getCoachValues,
  updateCoachVisuals,
  getPlayerGearValues,
  updateGearVisuals,
  removePlayerVisualValue,
  removeEmptyCoachBlends,
  removeEmptyPlayerBlends,
  updateAllCharacterVisuals,
  baseCoachVisualJson,
  allCoachVisuals

};
