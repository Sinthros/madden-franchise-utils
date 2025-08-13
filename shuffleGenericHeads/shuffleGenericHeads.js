// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const characterVisualFunctions = require('../Utils/characterVisualsLookups/characterVisualFunctions');
const path = require('path');
const fs = require('fs');

// Print tool header message
console.log("\nThis tool will shuffle the generic heads and portraits (ie game generated and not real face scans or real player portraits) for players. Most people shouldn't have a need to run this tool unless you are using the NCAA > Madden draft class converter or have another reason for needing to do so. Please follow the instructions below and read carefully!");

// Set up franchise file
const validGames = [
	FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
  FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = franchise.schema.meta.gameYear;
const genericHeadLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/genericHeadLookup.json'), 'utf-8'));


async function shuffleHeads(franchise, draftClassOnly) 
{
  console.log("Shuffling heads...")

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const mainCharacterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
  const json = genericHeadLookup["PLYR_GENERICHEAD"];

  const tablesList = [playerTable, mainCharacterVisualsTable];

  await FranchiseUtils.readTableRecords(tablesList);

  for (let i = 0; i < playerTable.header.recordCapacity; i++) 
  {
    if(!FranchiseUtils.isValidPlayer(playerTable.records[i], {
        includeSignedPlayers: !draftClassOnly,
        includeFreeAgents: !draftClassOnly,
        includeExpiringPlayers: !draftClassOnly, 
        includePracticeSquad: !draftClassOnly, 
        includeDraftPlayers: true}))
    {
      continue;
    }

    let existingHead = gameYear == FranchiseUtils.YEARS.M24 ? playerTable.records[i]['PLYR_GENERICHEAD'] : playerTable.records[i]['GenericHeadAssetName'].replace("gen_", "");
    let existingPortrait = playerTable.records[i]['PLYR_PORTRAIT'];

    // Player has a real portrait/face, don't change it
    if(!isValueInJSON(json, existingPortrait))
    {
      continue;
    }

    // Player has a generic portrait, select a different one randomly based on their skin color
    const startingLetter = existingHead.charAt(0).toUpperCase();
    const keysWithStartingLetter = Object.keys(json).filter(key => key.startsWith(startingLetter));
    let newHead = existingHead;
    let newPortrait = existingPortrait;
    if (keysWithStartingLetter.length > 0) {
        var randomKey = getRandomElement(keysWithStartingLetter);
        var noPortrait = json[randomKey] == 0;
        // If the player's generic head has no portrait assigned, choose a different one
        while (noPortrait){
          // Player's generic head is not set properly, just grab a random one
          if (existingHead.includes("NoHead") || existingHead.includes("DefaultValue")){
            randomKey = getRandomElement(Object.keys(json));
          }
          else {
            randomKey = getRandomElement(keysWithStartingLetter);
          }
          noPortrait = json[randomKey] == 0;
        }
        // Set the new head and new portrait
        newHead = randomKey;
        newPortrait = json[randomKey];
      
        // Change the head and portrait, then update the player visuals (if it's M24) so the head and mesh get updated properly
        playerTable.records[i]['PLYR_GENERICHEAD'] = newHead;
        if(gameYear >= FranchiseUtils.YEARS.M25)
        {
          playerTable.records[i]['GenericHeadAssetName'] = "gen_" + newHead;
        }

        playerTable.records[i]['PLYR_PORTRAIT'] = newPortrait;

        if(gameYear == FranchiseUtils.YEARS.M24)
        {
          await characterVisualFunctions.regeneratePlayerVisual(franchise,playerTable,mainCharacterVisualsTable,i);
        }
    } 
    else 
    {
        console.log("There was an issue shuffling the head for player: ", player);
    }
  }
  console.log("\nDone!\n");
}

// Function to get a random element from an array
function getRandomElement(array) 
{
  return array[Math.floor(Math.random() * array.length)];
}

// Function to check if a specific value exists in the JSON object
function isValueInJSON(json, value) 
{
  for (const key in json) 
  {
    if (json.hasOwnProperty(key)) 
    {
      if (json[key] === value) 
      {
        return true;
      }
    }
  }
  return false;
}

franchise.on('ready', async function () {    
    try 
    {
      let draftClassOnly = false;

      draftClassOnly = FranchiseUtils.getYesOrNo("\nDo you want to only run this tool for the current draft class? Enter 'yes' to run it for the current draft class only, or enter 'no' to run it for ALL players.");
      console.log("\n")
      await shuffleHeads(franchise, draftClassOnly);
    } 
    catch (e) 
    {
      console.log("******************************************************************************************")
      console.log(`FATAL ERROR!! Please report this message to Keet IMMEDIATELY - ${e}`)
      console.log("Exiting program.")
      console.log("******************************************************************************************")
      FranchiseUtils.EXIT_PROGRAM();
    }
    
  console.log("Successfully shuffled player heads!");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});