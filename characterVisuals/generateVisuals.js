const prompt = require('prompt-sync')();

const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

console.log("This program will regenerate Character Visuals for ALL players and coaches. This is only applicable for Madden 24 Franchise Files.")
const gameYear = FranchiseUtils.YEARS.M24;
const autoUnempty = true;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);

franchise.on('ready', async function () {

    //THIS IS HOW WE CAN TELL WHAT GAME WE'RE WORKING WITH
    const gameYear = franchise.schema.meta.gameYear;
    
    if (gameYear !== FranchiseUtils.YEARS.M24) {
      console.log("FATAL ERROR! Selected franchise file is NOT a Madden 24 Franchise File.");
      FranchiseUtils.EXIT_PROGRAM();
    }

    const mainCharacterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable); //Grab the tables we need and read them
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const coachTable = franchise.getTableByUniqueId(tables.coachTable);
    await mainCharacterVisualsTable.readRecords();
    await playerTable.readRecords();
    await coachTable.readRecords();

    let playerContractStatusIgnore = ['None']; //If the player a status in here, don't regenerate

    let regenerateUpdatedPlayers = false;
    let regenerateDeletedPlayers = false;

    const regeneratePlayerVisuals = FranchiseUtils.getYesOrNo("Would you like to regenerate Player Visuals? Enter YES or NO.");

    if (regeneratePlayerVisuals) {
      regenerateUpdatedPlayers = FranchiseUtils.getYesOrNo("Would you like to regenerate visuals for players who've had in-game edits? Enter YES or NO.");
      regenerateDeletedPlayers = FranchiseUtils.getYesOrNo("Would you like to regenerate visuals for retired players? This is useful if you plan on ever unretiring them with the MyFranchise Tool. Enter YES or NO.");

      if (!regenerateDeletedPlayers) {
        playerContractStatusIgnore.push('Deleted');
      }
    }

    const regenerateCoachVisuals = FranchiseUtils.getYesOrNo("Would you like to regenerate Coach Visuals? Enter YES or NO.");

    if (!regeneratePlayerVisuals && !regenerateCoachVisuals) {
      console.log("Visuals not generated for players or coaches.");
      FranchiseUtils.EXIT_PROGRAM();
    }

    if (regenerateCoachVisuals) {
      for (let i = 0; i < coachTable.header.recordCapacity;i++) {
        // If empty OR empty offensive playbook/defensive playbook (not a real coach), don't set visuals
        if (coachTable.records[i].isEmpty || (coachTable.records[i].OffensivePlaybook === FranchiseUtils.ZERO_REF && coachTable.records[i].DefensivePlaybook === FranchiseUtils.ZERO_REF )) {
          continue
        };
        await characterVisualFunctions.regenerateCoachVisual(franchise,coachTable,mainCharacterVisualsTable,i);
  
      }
      console.log("Successfully generated Character Visuals for all coaches.");
    }

    if (regeneratePlayerVisuals) {
      for (let i = 0; i < playerTable.header.recordCapacity;i++ ) { // Iterate through the player table

        if (playerTable.records[i].isEmpty === true || playerContractStatusIgnore.includes(playerTable.records[i].ContractStatus)) { //If empty or invalid contract status, continue
          continue
        }
  
        await characterVisualFunctions.regeneratePlayerVisual(franchise,playerTable,mainCharacterVisualsTable,i,regenerateUpdatedPlayers);
      }
      console.log("Successfully generated Character Visuals for all players");
    }
    
    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
});  