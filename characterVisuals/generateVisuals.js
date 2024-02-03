const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');
const ZERO_REF = '00000000000000000000000000000000';
const playerContractStatusIgnore = ['None','Deleted']; //If the player has either of these statuses, don't generate visuals

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
  "Shoulderpads",
  "JerseyState"
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

const allPlayerVisuals = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/playerVisualsLookup.json', 'utf8')); //Get the JSONs we need and parse them
const basePlayerVisualJson = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/basePlayerVisualLookup.json', 'utf8'));
const allCoachVisuals = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/coachVisualsLookup.json', 'utf8'));
const baseCoachVisualJson = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/baseCoachVisualLookup.json', 'utf8'));

const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');

console.log("This program will regenerate Character Visuals for ALL players and coaches. This is only applicable for Madden 24 Franchise Files.")
const gameYear = '24';
const autoUnempty = true;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);


franchise.on('ready', async function () {

    //THIS IS HOW WE CAN TELL WHAT GAME WE'RE WORKING WITH
    const gameYear = franchise.schema.meta.gameYear;

    if (gameYear !== 24) {
      console.log("FATAL ERROR! Selected franchise file is NOT a Madden 24 Franchise File. Enter anything to exit.");
      prompt();
      process.exit(0);
    }

    // This entire block is pretty gross and can probably be optimized...

    const mainCharacterVisualsTable = franchise.getTableByUniqueId(1429178382); //Grab the tables we need and read them
    const playerTable = franchise.getTableByUniqueId(1612938518);
    const coachTable = franchise.getTableByUniqueId(1860529246);
    await mainCharacterVisualsTable.readRecords();
    await playerTable.readRecords();
    await coachTable.readRecords();

    const mainCharacterVisualsId = mainCharacterVisualsTable.header.tableId;
    
    for (let i = 0; i < coachTable.header.recordCapacity;i++) {
      // If empty OR empty offensive playbook/defensive playbook (not a real coach), don't set visuals
      if (coachTable.records[i].isEmpty || (coachTable.records[i]['OffensivePlaybook'] === ZERO_REF && coachTable.records[i]['DefensivePlaybook'] === ZERO_REF )) {
        continue
      };

      let jsonToUpdate = JSON.parse(JSON.stringify(baseCoachVisualJson)); // Get our current base JSON

      const coachValues = await characterVisualFunctions.getCoachValues(coachTable, i);
      jsonToUpdate = await characterVisualFunctions.updateCoachVisuals(coachValues,allCoachVisuals,jsonToUpdate,visualMorphKeys)
      jsonToUpdate = await characterVisualFunctions.removeEmptyCoachBlends(jsonToUpdate)

      const { currentCharacterVisualsTable, characterVisualsRow, characterVisualsTableId } = await characterVisualFunctions.getCharacterVisualsTable(franchise,coachTable,mainCharacterVisualsTable,i)
      if (characterVisualsTableId !== mainCharacterVisualsId) { // If a different table besides the main one, we need to read it
        await currentCharacterVisualsTable.readRecords();
      }
  
      currentCharacterVisualsTable.records[characterVisualsRow]['RawData'] = jsonToUpdate; //Set the RawData of the CharacterVisuals row = our updated JSON

      //Uncomment this if you want to print out the json
      //test = JSON.parse(JSON.stringify(characterVisuals.records[characterVisualsRow]['RawData'])); // Get our current base JSON
      //console.log(test)
    }
    console.log("Successfully generated Character Visuals for all coaches.");


    for (let i = 0; i < playerTable.header.recordCapacity;i++ ) { // Iterate through the player table

      if (playerTable.records[i].isEmpty === true || playerContractStatusIgnore.includes(playerTable.records[i]['ContractStatus'])) { //If empty or invalid contract status, continue
        continue
      }

      //This is a roundabout way to get a unique version of the base player JSON for each player, since we'll be editing it
      let jsonToUpdate = JSON.parse(JSON.stringify(basePlayerVisualJson));
      const gearValues = await characterVisualFunctions.getPlayerGearValues(playerTable, i); //Get all the gear values for this player

      for (let j = 0; j < visualGearKeys.length; j++) { //Iterate over the keys of the visual gear
        if (visualGearKeys[j] === 'FlakJacket') { //If it's FlakJacket or BackPlate, we have to utilize an optional parameter for its morph
          const flakJacketAmount = parseFloat(playerTable.records[i]['MetaMorph_FlakJacketAmount'].toFixed(2)); //In the player table it can be several digits, but here we only want 2 digits
          jsonToUpdate = await characterVisualFunctions.updateGearVisuals(visualGearKeys[j], gearValues[j], allPlayerVisuals, jsonToUpdate, flakJacketAmount);
        }
        else if (visualGearKeys[j] === 'Backplate') {
          const backPlateAmount = parseFloat(playerTable.records[i]['MetaMorph_BackPlateAmount'].toFixed(2));
          jsonToUpdate = await characterVisualFunctions.updateGearVisuals(visualGearKeys[j], gearValues[j], allPlayerVisuals, jsonToUpdate, backPlateAmount);
        }
        else { //Otherwise, update the gear normally
          jsonToUpdate = await characterVisualFunctions.updateGearVisuals(visualGearKeys[j], gearValues[j], allPlayerVisuals, jsonToUpdate);
        }
        
      }

      const [genericHeadName,genericHead,skinTone] = await characterVisualFunctions.getPlayerHeadValues(playerTable, i,allPlayerVisuals); //Get head name/head/skin tone dynamically
      jsonToUpdate.genericHeadName = genericHeadName; //Setting these is very simple in the JSON
      jsonToUpdate.genericHead = genericHead;
      jsonToUpdate.skinTone = skinTone;

      const morphValues = await characterVisualFunctions.getPlayerMorphValues(playerTable,i) //Now we need to get the morph values

      for (let j = 0; j < visualMorphKeys.length; j++) { //Iterate over the visual morph keys
        const characterVisualsKey = visualMorphKeys[j]; 
        const baseMorph = morphValues[j * 2]; //Each morph key has 2 values back to back - This logic allows us to get both
        const barycentricMorph = morphValues[j * 2 + 1];
      
        // Update the morphs in the JSON
        jsonToUpdate = await characterVisualFunctions.updateMorphValues(characterVisualsKey, baseMorph, barycentricMorph, jsonToUpdate);
      }

      jsonToUpdate = await characterVisualFunctions.removeEmptyPlayerBlends(jsonToUpdate);

      const { currentCharacterVisualsTable, characterVisualsRow, characterVisualsTableId } = await characterVisualFunctions.getCharacterVisualsTable(franchise,playerTable,mainCharacterVisualsTable,i)
      if (characterVisualsTableId !== mainCharacterVisualsId) {
        await currentCharacterVisualsTable.readRecords();
      }
      currentCharacterVisualsTable.records[characterVisualsRow]['RawData'] = jsonToUpdate; //Set the RawData of the CharacterVisuals row = our updated JSON
    }
    console.log("Successfully generated Character Visuals for all players");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("Enter anything to exit.");
    prompt();

});  