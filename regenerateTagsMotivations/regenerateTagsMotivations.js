// Requirements
const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const PLAYER_TABLE = 1612938518;
const gamePrompt = '24';
const autoUnempty = false;
const franchise = FranchiseUtils.selectFranchiseFile(gamePrompt,autoUnempty);

console.log("This program will will regenerate the player Motivations to make them more realistic by using a formula along with a variety of factors including overall, age and position to dynamically generate motivations. This tool can be ran at any time but should only be ran once per season. It's recommended to run this tool AFTER running the Progression Tool in MyFranchise, ideally doing both in Preseason Week 1. If you are using StartToday, it's recommended to run this tool during Staff week or Resign week. Please follow the prompts below and read carefully!\n\n")

async function generatePlayerMotivations(franchise, excludeSchemeFit, includeCurrent) {
  console.log("Doing the stuff...")
  const playerTable = franchise.getTableByUniqueId(PLAYER_TABLE);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    if (!playerTable.records[i].isEmpty) {
      var player = {
        pos: playerTable.records[i]['Position'],
        age: playerTable.records[i]['Age'],
        ovr: playerTable.records[i]['OverallRating'],
        yrs: playerTable.records[i]['YearsPro']
      };

      var currentMotivations = []
      if (includeCurrent){
        currentMotivations = [
          playerTable.records[i]['Motivation1'],
          playerTable.records[i]['Motivation2'],
          playerTable.records[i]['Motivation3']
        ]
      }

      const motivationsArray = await buildMotivationsArray(player, excludeSchemeFit, currentMotivations, player.yrs > 1);

      var needsTopDepthChart = false;
      needsTopDepthChart = await determineNeedTopDepthChart(player, motivationsArray);

      // Player hits the overall threshold for their position, assign ToptheDepthChart as their top motivation then use top 2 motivations for #2 and #3
      if (needsTopDepthChart === true){
        playerTable.records[i]['Motivation1'] = "ToptheDepthChart";

        // Ensure they don't have ToptheDepthChart as one of their top 2 motivations before assigning them
        if (motivationsArray[0] === "ToptheDepthChart") {
          playerTable.records[i]['Motivation2'] = motivationsArray[1];
          playerTable.records[i]['Motivation3'] = motivationsArray[2];
        }
        else if (motivationsArray[1] === "ToptheDepthChart") {
          playerTable.records[i]['Motivation2'] = motivationsArray[0];
          playerTable.records[i]['Motivation3'] = motivationsArray[2];
        }
        else {
          playerTable.records[i]['Motivation2'] = motivationsArray[0];
          playerTable.records[i]['Motivation3'] = motivationsArray[1];
        }
      }
      // Player doesn't hit overall threshold for their position, continue as normal
      else {
        playerTable.records[i]['Motivation1'] = motivationsArray[0];
        playerTable.records[i]['Motivation2'] = motivationsArray[1];
        playerTable.records[i]['Motivation3'] = motivationsArray[2];
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

// Based on their position and overall, determine if they should have TopDepthChart be their #1 motivation or not
async function determineNeedTopDepthChart(player) {
  switch (player.pos) {
    case 'QB':
      return player.ovr >= 75;
    case 'HB':
      return player.ovr >= 80;
    case 'WR':
      return player.ovr >= 88;
    case 'TE':
      return player.ovr >= 76;
    case 'LT':
      return player.ovr >= 74;
    case 'LG':
    case 'C':
    case 'RG':
    case 'RT':
      return player.ovr >= 72;
    case 'LE':
    case 'RE':
      return player.ovr >= 75;
    case 'DT':
      return player.ovr >= 82;
    case 'LOLB':
    case 'ROLB':
      return player.ovr >= 74;
    case 'MLB':
      return player.ovr >= 82;
    case 'CB':
      return player.ovr >= 88;
    case 'FS':
    case 'SS':
      return player.ovr >= 77;
    case 'K':
    case 'P':
      return player.ovr >= 72;
    default:
      return false;
  }
}

async function buildMotivationsArray(player, excludeSchemeFit, currentMotivations, playerIsNotRookieOrProspect) {
  var schemeFitWeight = 6;
  if (excludeSchemeFit) {
    schemeFitWeight = 0;
  }
  // Base motivation weights
  var motivationWeights = {
    'HighestOffer': 25,
    'ChampionshipContender': 15,
    'HeadCoachHistoricRecord': 10,
    'TeamHasFranchiseQB': 10,
    'CloseToHome': 10,
    'ToptheDepthChart': 6,
    'BigMarket': 6,
    'WarmWeatherState': 6,
    'TeamPrestige': 6,
    'MentoratPosition': 3,
    'NoIncomeTax': 3,
    'SchemeFit': schemeFitWeight
  };

  // User chose to consider the current motivations, do so if the player is not a rookie or draft class prospect
  if (!currentMotivations.isEmpty && playerIsNotRookieOrProspect) {
    for (let i = 0; i < currentMotivations.length; i++) {
      const value = currentMotivations[i];
      motivationWeights[value] = 40;
    }
  }

  // QB, remove TeamHasFranchiseQB
  if (player.pos === 'QB'){
    motivationWeights['TeamHasFranchiseQB'] = 0;
  }

  // Overall below 70, remove ToptheDepthChart
  if (player.ovr < 70) {
    motivationWeights['ToptheDepthChart'] = 0;
  }

  // WR or TE, boost TeamHasFranchiseQB
  if (player.pos === 'WR' || player.pos === 'TE'){
    motivationWeights['TeamHasFranchiseQB'] *= 4;
  }

  // Overall above 80, boost several motivations and reduce/remove others
  if (player.ovr > 79) {
    motivationWeights['HighestOffer'] *= 4;
    motivationWeights['ChampionshipContender'] *= 2;
    motivationWeights['BigMarket'] *= 2;
    motivationWeights['MentoratPosition'] = 0;
  }

  // Age 29 and above, boost several motivations and reduce/remove others
  if (player.age > 28) {
    motivationWeights['ChampionshipContender'] *= 3;
    motivationWeights['CloseToHome'] *= 2;
    motivationWeights['MentoratPosition'] = 0;
  }

  // Special handling for K and P
  if (player.pos === 'K' || player.pos === 'P'){
    motivationWeights['SchemeFit'] = 0;
    motivationWeights['MentoratPosition'] = 0;
    motivationWeights['TeamHasFranchiseQB'] = 0;
    motivationWeights['HighestOffer'] *= 2;
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

  // Sort by value
  // let selectedValuesSorted = sortDictionaryByValueDescending(selectedValues);

  // Extract only the values without weights
  const result = selectedValues.map(({ value }) => value);

  return result;
}

function sortDictionaryByValueDescending(inputArray) {
  inputArray.sort((a, b) => b.weight - a.weight);

  return inputArray;
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
      var excludeSchemeFit = false;
      var includeCurrent = false;
      
      while (true) {
        console.log("\nDo you want to remove Scheme Fit from being a player Motivation? Due to most people using the Progression Tool instead of the in-game XP system and the in-game Schemes & Archetypes system not being the best, it's recommended to exclude Scheme Fit. Type 'exclude' if you want to exclude Scheme Fit from showing as a Motivation, or 'includeschemefit' if you want to keep it.");
        let finalPrompt = prompt().trim();
        if (finalPrompt.toUpperCase() === 'EXCLUDE') {
          excludeSchemeFit = true;
            break;
        } else if (finalPrompt.toUpperCase() === 'INCLUDESCHEMEFIT') {
          excludeSchemeFit = false;
            break;
        } else {
            console.log("\nInvalid input. Please enter 'exclude' or 'includeschemefit' to continue (don't include the quotes).\n");
        }
      }
      console.log("\n")

      while (true) {
        console.log("Do you want to factor in each player's current motivations to the formulas or wipe them completely? If this is your first time running this tool for the current franchise, its recommended to wipe them to ensure a good foundation. If you are running this on the same franchise but a different league year, you should include them. Note: Rookies will always be completely regnerated in order to properly apply the formulas and so you'll be able to include their generated motivations in subsequent seasons. Type 'include' to include each player's current motivations in the calculations, or 'wipecurrent' to wipe all current motivations for all players completely.");
        let finalPrompt = prompt().trim();
        if (finalPrompt.toUpperCase() === 'INCLUDE') {
            includeCurrent = true;
            break;
        } else if (finalPrompt.toUpperCase() === 'WIPECURRENT') {
            includeCurrent = false;
            break;
        } else {
            console.log("\nInvalid input. Please enter 'include' or 'wipecurrent' to continue (don't include the quotes).\n");
        }
      }
      console.log("\n")

      await generatePlayerMotivations(franchise, excludeSchemeFit, includeCurrent);
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