// Requirements
const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const PLAYER_TABLE = 1612938518;

const playerMotivationsM24 = [
  "NoIncomeTax",
  "WarmWeatherState",
  "BigMarket",
  "ChampionshipContender",
  "TeamPrestige",
  "SchemeFit",
  "ToptheDepthChart",
  "TeamHasFranchiseQB",
  "MentoratPosition",
  "HeadCoachHistoricRecord",
  "CloseToHome",
  "HighestOffer",
];


console.log("This program will remove all Player Tags and regenerate all Player Motivations in your Madden 24 Franchise File. Player Tags regenerate once you enter the Regular Season. You will be prompted to choose if you wish to remove player tags or not and if you want to regenerate motivations for all players or just for rookies.\n\n")
const gamePrompt = '24';
const autoUnempty = false;
const franchise = FranchiseUtils.selectFranchiseFile(gamePrompt,autoUnempty);

async function generatePlayerMotivations(franchise, removeTags, allPlayers, excludeSchemeFit) {
  console.log("Doing the stuff...")
  const playerTable = franchise.getTableByUniqueId(PLAYER_TABLE);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    if (!playerTable.records[i].isEmpty) {
      var player = {
        pos: playerTable.records[i]['Position'],
        age: playerTable.records[i]['Age'] ,
        ovr: playerTable.records[i]['OverallRating'],
        yrs: playerTable.records[i]['YearsPro']
      };

      if (!allPlayers && player.yrs > 1) {
        continue;
      }

      const motivationsArray = await buildMotivationsArray(player, excludeSchemeFit);

      playerTable.records[i]['Motivation1'] = motivationsArray[0];
      playerTable.records[i]['Motivation2'] = motivationsArray[1];
      playerTable.records[i]['Motivation3'] = motivationsArray[2];

      if (removeTags) {
        playerTable.records[i]['Tag1'] = 'NoRole';
        playerTable.records[i]['Tag2'] = 'NoRole';
      }
    }
  }
  console.log("\nDone!\n")
}

// Function to shuffle an array (Fisher-Yates algorithm)
async function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function buildMotivationsArray(player, excludeSchemeFit) {
  var schemeFitWeight = 10;
  if (excludeSchemeFit) {
    schemeFitWeight = 0;
  }
  var motivationWeights = {
    'HighestOffer': 20,
    'ChampionshipContender': 20,
    'TeamHasFranchiseQB': 10,
    'CloseToHome': 10,
    'HeadCoachHistoricRecord': 10,
    'BigMarket': 5,
    'ToptheDepthChart': 5,
    'NoIncomeTax': 5,
    'WarmWeatherState': 5,
    'MentoratPosition': 5,
    'TeamPrestige': 5,
    'SchemeFit': schemeFitWeight
  };

  // QB, remove TeamHasFranchiseQB
  if (player.pos === 'QB'){
    motivationWeights['TeamHasFranchiseQB'] = 0;
  }

  // Overall below 75, remove ToptheDepthChart
  if (player.ovr < 75) {
    motivationWeights['ToptheDepthChart'] = 0;
  }

  // WR or TE, boost TeamHasFranchiseQB
  if (player.pos === 'WR' || player.pos === 'TE'){
    motivationWeights['TeamHasFranchiseQB'] *= 4;
  }

  // Overall above 80, boost several motivations and reduce/remove others
  if (player.ovr > 79) {
    motivationWeights['HighestOffer'] *= 3;
    motivationWeights['ChampionshipContender'] *= 2;
    motivationWeights['BigMarket'] *= 2;
    motivationWeights['HeadCoachHistoricRecord'] *= 2;
    motivationWeights['MentoratPosition'] = 0;
  }

  // Age 28 and above, boost several motivations and reduce/remove others
  if (player.age > 27) {
    motivationWeights['ChampionshipContender'] *= 3;
    motivationWeights['CloseToHome'] *= 2;
    motivationWeights['MentoratPosition'] = 0;
  }

  // Special handling for K and P
  if (player.pos === 'K' || player.pos === 'P'){
    motivationWeights['SchemeFit'] = 0;
    motivationWeights['MentoratPosition'] = 0;
    motivationWeights['ToptheDepthChart'] = 0;
    motivationWeights['TeamHasFranchiseQB'] = 0;
    motivationWeights['HighestOffer'] *= 2;
  }

  // Special handling for higher rated QBs to want to be the starter
  if (player.pos === 'QB' && player.ovr > 74) {
    motivationWeights['ToptheDepthChart'] *= 40;
  }

  // Randomly pick the motivations based on the weights
  // Don't pick more than 1 location based motivation to avoid weird situations like getting CloseToHome and WarmWeatherState but the player is from Michigan
  const locationMotivations = ['CloseToHome','WarmWeatherState','NoIncomeTax'];
  const chosenEntries = selectThreeValues(motivationWeights, locationMotivations);

  return chosenEntries;
}

function selectThreeValues(x1, locationMotivations) {
  // Convert the dictionary values into an array of [key, weight] pairs
  const entries = Object.entries(x1);

  // Filter out entries with weight 0
  const nonZeroEntries = entries.filter(([, weight]) => weight > 0);

  // Calculate the total weight for non-zero entries
  const totalWeight = nonZeroEntries.reduce((sum, [, weight]) => sum + weight, 0);

  // Select three unique values based on their weights
  const selectedValues = [];
  var hasUsedLocation = false;

  while (selectedValues.length < 3) {
    let cumulativeWeight = 0;
    const randomThreshold = Math.random() * totalWeight;

    for (const [value, weight] of nonZeroEntries) {
      cumulativeWeight += weight;

      // If the value is in the locationMotivations array and has been used before, skip
      if (hasUsedLocation && locationMotivations.includes(value)) {
        continue;
      }

      if (cumulativeWeight >= randomThreshold && !selectedValues.some((v) => v.value === value)) {
        selectedValues.push({ value, weight });

        // If the value is in the locationMotivations array, mark as used
        if (locationMotivations.includes(value)) {
          hasUsedLocation = true;
        }

        break;
      }
    }
  }

  // Extract only the values without weights
  const result = selectedValues.map(({ value }) => value);

  return result;
}

franchise.on('ready', async function () {

    const gameYear = franchise.schema.meta.gameYear // Get the game year of the source file
    if (gameYear !== 24) {
      console.log("******************************************************************************************")
      console.log("ERROR! Target franchise isn't a Madden 24 Franchise File. Exiting program.");
      console.log("******************************************************************************************")
      prompt()
      process.exit(0);
    }
    
    try {
      var removeTags = false;
      var allPlayers = false;
      var excludeSchemeFit = false;

      while (true) {
        console.log("\nDo you want to remove all player Tags? This will negatively effect resigning players and free agency signings and is therefore generally not recommended. Type 'remove' if you want to continue removing all tags for all players or 'skip' if not.");
        let finalPrompt = prompt().trim();
        if (finalPrompt.toUpperCase() === 'REMOVE') {
            removeTags = true;
            break;
        } else if (finalPrompt.toUpperCase() === 'SKIP') {
            removeTags = false;
            break;
        } else {
            console.log("\nInvalid input. Please enter 'remove' or 'skip' to continue (don't include the quotes).\n");
        }
      }
      console.log("\n")
      
      while (true) {
        console.log("Do you want to remove Scheme Fit from being a player Motivation? Due to most people using the Progression Tool instead of the in-game XP system and the in-game Schemes and Archetypes system not being very good overall, it's recommended to exclude Scheme Fit. Type 'exclude' if you want to exclude Scheme Fit from showing as a Motivation and 'include' if you want to keep it.");
        let finalPrompt = prompt().trim();
        if (finalPrompt.toUpperCase() === 'EXCLUDE') {
          excludeSchemeFit = true;
            break;
        } else if (finalPrompt.toUpperCase() === 'INCLUDE') {
          excludeSchemeFit = false;
            break;
        } else {
            console.log("\nInvalid input. Please enter 'exclude' or 'include' to continue (don't include the quotes).\n");
        }
      }
      console.log("\n")

      while (true) {
        console.log("Do you want to regenerate motivations for all players or just for rookies and the current draft class? If this is your first time running the tool in your current franchise, its recommended to do it for all players. If youve already ran this tool in your current franchise, its recommended to only do it for the rookie class. For all players, type 'all' or for just rookies and the current draft class, type 'rookies'.");
        let finalPrompt = prompt().trim();
        if (finalPrompt.toUpperCase() === 'ALL') {
            allPlayers = true;
            break;
        } else if (finalPrompt.toUpperCase() === 'ROOKIES') {
            allPlayers = false;
            break;
        } else {
            console.log("\nInvalid input. Please enter 'all' or 'rookies' to continue (don't include the quotes).\n");
        }
      }
      console.log("\n")

      await generatePlayerMotivations(franchise, removeTags, allPlayers, excludeSchemeFit);
    } catch (e) {
      console.log("******************************************************************************************")
      console.log(`FATAL ERROR!! Please report this message to Sinthros IMMEDIATELY - ${e}`)
      console.log("Exiting program.")
      console.log("******************************************************************************************")
      prompt();
      process.exit(0);

    }

    
  console.log("Successfully deleted all Player Tags (if chosen) and regenerated Player Motivations based on previous responses.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit the program.");

  prompt();
});