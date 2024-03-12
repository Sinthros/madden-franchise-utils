const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const fs = require('fs');
const ZERO_REF = '00000000000000000000000000000000';
const playerContractStatusIgnore = ['None','Deleted']; //If the player has either of these statuses, don't generate visuals
const allPlayerVisuals = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/playerVisualsLookup.json', 'utf8')); //Get the JSONs we need and parse them
const basePlayerVisualJson = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/basePlayerVisualLookup.json', 'utf8'));
const allCoachVisuals = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/coachVisualsLookup.json', 'utf8'));
const baseCoachVisualJson = JSON.parse(fs.readFileSync('../lookupFunctions/characterVisualsLookups/baseCoachVisualLookup.json', 'utf8'));

const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

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

    const mainCharacterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable); //Grab the tables we need and read them
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const coachTable = franchise.getTableByUniqueId(tables.coachTable);
    await mainCharacterVisualsTable.readRecords();
    await playerTable.readRecords();
    await coachTable.readRecords();
    
    for (let i = 0; i < coachTable.header.recordCapacity;i++) {
      // If empty OR empty offensive playbook/defensive playbook (not a real coach), don't set visuals
      if (coachTable.records[i].isEmpty || (coachTable.records[i]['OffensivePlaybook'] === ZERO_REF && coachTable.records[i]['DefensivePlaybook'] === ZERO_REF )) {
        continue
      };
      await characterVisualFunctions.regenerateCoachVisual(franchise,coachTable,mainCharacterVisualsTable,i);

    }
    console.log("Successfully generated Character Visuals for all coaches.");


    for (let i = 0; i < playerTable.header.recordCapacity;i++ ) { // Iterate through the player table

      if (playerTable.records[i].isEmpty === true || playerContractStatusIgnore.includes(playerTable.records[i]['ContractStatus'])) { //If empty or invalid contract status, continue
        continue
      }

      await characterVisualFunctions.regeneratePlayerVisual(franchise,playerTable,mainCharacterVisualsTable,i);
    }
    console.log("Successfully generated Character Visuals for all players");
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("Enter anything to exit.");
    prompt();

});  