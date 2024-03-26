const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const ZERO_REF = '00000000000000000000000000000000';

const characterVisualFunctions = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');

function handleInput(message) {
  while (true) {
      console.log(message);
      const input = prompt().trim().toUpperCase();

      if (input === 'YES') {
          return true;
      } else if (input === 'NO') {
          return false;
      } else {
          console.log("Invalid input. Please enter YES or NO.");
      }
  }
}

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

    const mainCharacterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable); //Grab the tables we need and read them
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const coachTable = franchise.getTableByUniqueId(tables.coachTable);
    await mainCharacterVisualsTable.readRecords();
    await playerTable.readRecords();
    await coachTable.readRecords();

    let playerContractStatusIgnore = ['None']; //If the player a status in here, don't regenerate

    let regenerateUpdatedPlayers = false;
    let regenerateDeletedPlayers = false;

    const regeneratePlayerVisuals = handleInput("Would you like to regenerate Player Visuals? Enter YES or NO.");

    if (regeneratePlayerVisuals) {
      regenerateUpdatedPlayers = handleInput("Would you like to regenerate visuals for players who've had in-game edits? Enter YES or NO.");
      regenerateDeletedPlayers = handleInput("Would you like to regenerate visuals for retired players? This is useful if you plan on ever unretiring them with the MyFranchise Tool. Enter YES or NO.");

      if (!regenerateDeletedPlayers) {
        playerContractStatusIgnore.push('Deleted');
      }
    }

    const regenerateCoachVisuals = handleInput("Would you like to regenerate Coach Visuals? Enter YES or NO.");

    if (!regeneratePlayerVisuals && !regenerateCoachVisuals) {
      console.log("Visuals not generated for players or coaches. Enter anything to exit the program.");
      prompt();
      process.exit(0);
    }

    if (regenerateCoachVisuals) {
      for (let i = 0; i < coachTable.header.recordCapacity;i++) {
        // If empty OR empty offensive playbook/defensive playbook (not a real coach), don't set visuals
        if (coachTable.records[i].isEmpty || (coachTable.records[i]['OffensivePlaybook'] === ZERO_REF && coachTable.records[i]['DefensivePlaybook'] === ZERO_REF )) {
          continue
        };
        await characterVisualFunctions.regenerateCoachVisual(franchise,coachTable,mainCharacterVisualsTable,i);
  
      }
      console.log("Successfully generated Character Visuals for all coaches.");
    }

    if (regeneratePlayerVisuals) {
      for (let i = 0; i < playerTable.header.recordCapacity;i++ ) { // Iterate through the player table

        if (playerTable.records[i].isEmpty === true || playerContractStatusIgnore.includes(playerTable.records[i]['ContractStatus'])) { //If empty or invalid contract status, continue
          continue
        }
  
        await characterVisualFunctions.regeneratePlayerVisual(franchise,playerTable,mainCharacterVisualsTable,i,regenerateUpdatedPlayers);
      }
      console.log("Successfully generated Character Visuals for all players");
    }
    
    await FranchiseUtils.saveFranchiseFile(franchise);
    console.log("Enter anything to exit.");
    prompt();

});  