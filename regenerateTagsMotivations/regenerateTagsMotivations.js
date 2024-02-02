




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


console.log("This program will remove all Player Tags and regenerate all Player Motivations in your Madden 24 Franchise File. Player Tags regenerate once you enter the Regular Season.")
const gamePrompt = '24';
const franchise = FranchiseUtils.selectFranchiseFile(gamePrompt);


async function generatePlayerMotivations(franchise) {
  console.log("Regenerating all Player Motivations...")
  const playerTable = franchise.getTableByUniqueId(PLAYER_TABLE);
  await playerTable.readRecords();

  for (let i = 0; i < playerTable.header.recordCapacity; i++) {
    if (!playerTable.records[i].isEmpty) {
      const motivationsCopy = [...playerMotivationsM24];
      if (playerTable.records[i]['Position'] === 'QB') {
        // If the position is QB, remove 'TeamHasFranchiseQB' from a copy of the array
        const qbIndex = motivationsCopy.indexOf('TeamHasFranchiseQB');
        if (qbIndex !== -1) {
          motivationsCopy.splice(qbIndex, 1);
        }
      }

      if (playerTable.records[i]['OverallRating'] < 75) {
        // If bad overall, remove 'ToptheDepthChart' from a copy of the array
        const topDepthChartIndex = motivationsCopy.indexOf('ToptheDepthChart');
        if (topDepthChartIndex !== -1) {
          motivationsCopy.splice(topDepthChartIndex, 1);
        }
      }
      
      await shuffleArray(motivationsCopy);

      // Take the first three elements (they will be random and unique)
      const randomMotivations = motivationsCopy.slice(0, 3);

      playerTable.records[i]['Motivation1'] = randomMotivations[0];
      playerTable.records[i]['Motivation2'] = randomMotivations[1];
      playerTable.records[i]['Motivation3'] = randomMotivations[2];
      playerTable.records[i]['Tag1'] = 'NoRole';
      playerTable.records[i]['Tag2'] = 'NoRole';
    }
  }
}

// Function to shuffle an array (Fisher-Yates algorithm)
async function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
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
      await generatePlayerMotivations(franchise);
    } catch (e) {
      console.log("******************************************************************************************")
      console.log(`FATAL ERROR!! Please report this message to Sinthros IMMEDIATELY - ${e}`)
      console.log("Exiting program.")
      console.log("******************************************************************************************")
      prompt();
      process.exit(0);

    }

    
  console.log("Successfully deleted all Player Tags and regenerated Player Motivations.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit the program.");

  prompt();
});



