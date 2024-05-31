const Franchise = require('madden-franchise');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const path = require('path');
const os = require('os');
const fs = require('fs');
const prompt = require('prompt-sync')();


/***************************************************
 *              GLOBAL CONSTANTS                   *
 * Any const variable that is not class specific   *
 * should be placed in this file.                  *
 ***************************************************/

const ZERO_REF = '00000000000000000000000000000000';
const BASE_FILE_INIT_KWD = 'CAREER';
const FTC_FILE_INIT_KWD = 'franchise-';

const NFL_CONFERENCES = ['AFC', 'NFC'];

const OFFENSIVE_SKILL_POSITIONS = ['QB', 'HB', 'FB', 'WR', 'TE'];
const OLINE_POSITIONS = ['LT','LG','C','RG','RT'];
const DEFENSIVE_LINE_POSITIONS = ['DT','LE','RE'];
const LINEBACKER_POSITIONS = ['MLB','LOLB','ROLB'];
const DEFENSIVE_BACK_POSITIONS = ['CB','FS','SS'];
const SPECIAL_TEAM_POSITIONS = ['K','P'];

const COACH_SKIN_TONES = ['SkinTone1', 'SkinTone2', 'SkinTone3', 'SkinTone4', 'SkinTone5', 'SkinTone6', 'SkinTone7'];
const COACH_APPAREL = ['Facility1', 'Facility2', 'Practice1', 'Practice2', 'Practice3', 'Staff1', 'Staff2', 'Staff3', 'Staff4'];

function selectFranchiseFile(gameYear,isAutoUnemptyEnabled = false, isFtcFile = false) {
  const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
  const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
  let default_path = documentsDir; // Set to default dir first
  let franchise;
  let filePrefix;
  if (isFtcFile) {
    filePrefix = FTC_FILE_INIT_KWD;
  }
  else {
    filePrefix = BASE_FILE_INIT_KWD;
  }
  
  if (fs.existsSync(documentsDir)) {
      default_path = documentsDir;
  } else if (fs.existsSync(oneDriveDir)) {
      default_path = oneDriveDir;
  } else {
      console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
  }

  while (true) {
      try {
          console.log("Please enter the name of your franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder.");
          let fileName = prompt();
          fileName = fileName.trim(); // Remove leading/trailing spaces
          
          if (fileName.startsWith(filePrefix)) {
              franchise = new Franchise(path.join(default_path, fileName), {'autoUnempty': isAutoUnemptyEnabled});
          } else {
              franchise = new Franchise(fileName.replace(new RegExp('/', 'g'), '\\'), {'autoUnempty': isAutoUnemptyEnabled});
          }

          return franchise;
      } catch (e) {
          console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
          continue;
      }
  }
};

async function selectFranchiseFileAsync(gameYear,isAutoUnemptyEnabled = false, isFtcFile = false) {
    const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
    const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
    let default_path = documentsDir; // Set to default dir first
    let franchise;
    let filePrefix;

    if (isFtcFile) {
        filePrefix = FTC_FILE_INIT_KWD;
    }
    else {
        filePrefix = BASE_FILE_INIT_KWD;
    }
    
    if (fs.existsSync(documentsDir)) {
        default_path = documentsDir;
    } else if (fs.existsSync(oneDriveDir)) {
        default_path = oneDriveDir;
    } else {
        console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
    }
  
    while (true) {
        try {
            console.log("Please enter the name of your franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder.");
            let fileName = prompt();
            fileName = fileName.trim(); // Remove leading/trailing spaces
            
            if (fileName.startsWith(filePrefix)) {
                franchise = await Franchise.create(path.join(default_path, fileName), {'autoUnempty': isAutoUnemptyEnabled});
            } else {
                franchise = await Franchise.create(fileName.replace(new RegExp('/', 'g'), '\\'), {'autoUnempty': isAutoUnemptyEnabled});
            }
  
            return franchise;
        } catch (e) {
            console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
            continue;
        }
    }
};

async function saveFranchiseFile(franchise) {
    while (true) {
        console.log("Would you like to save your changes? Enter yes to save your changes, or no to quit without saving.");
        const finalPrompt = prompt().trim();
    
        if (finalPrompt.toUpperCase() === 'YES') {
            await franchise.save();
            console.log("Franchise file successfully saved!");
            break;
        } else if (finalPrompt.toUpperCase() === 'NO') {
            console.log("Your Franchise File has not been saved.");
            break;
        } else {
            console.log("Invalid input. Please enter 'yes' to save or 'no' to not save.");
        }
    }
};


/*
  tablesList: List of tables you want to read. For example, if you have playerTable and coachTable,
  you'd pass through [playerTable, coachTable].

  continueIfError: Boolean. If true, the program will continue if there's an error reading the records for a table.
  In most cases, leave this as false; you usually don't want the program to proceed if there's an error loading a table.
  This was designed for the franchiseDataTransfer class, which loads ALL tables from FranchiseTableId.
  In this specific scenario, a few tables in that list only exist in M22 or M24. We want to continue over
  those when they don't load properly since they aren't used in the script by the source/target franchise objects.

*/

async function readTableRecords(tablesList, continueIfError = false) {
    for (const table of tablesList) {
      try {
        await table.readRecords();
      } catch (error) {
        if (!continueIfError) {
          throw error;
        } else { // If continueIfError = true, continue (This is not typically recommended!)
            continue;
        }
      }
    }
  }

function getGameYear(validGameYears) {
    let gameYear;

    while (true) {
        console.log(`Select the version of Madden your franchise file uses. Valid inputs are ${validGameYears.join(', ')}`);
        gameYear = prompt();

        if (validGameYears.includes(gameYear)) {
            break;
        } else {
            console.log("Invalid option. Please try again.");
        }
    }

    return gameYear;
};

// Function to calculate the Best Overall and Best Archetype for a player
// This takes in a player record object; For example, if you're iterating through the player table and are working
// with row i, pass through playerTable.records[i]
// Call it exactly like this:
// const player = playerTable.records[i];
// const {newOverall, newArchetype} = FranchiseUtils.calculateBestOverall(player);

// Afterwards, you can set the overall/archetype like this:
// playerTable.records[i]['OverallRating;] = newOverall;
// playerTable.records[i]['PlayerType'] = newArchetype;

// If you use this function, you HAVE to include ovrweights/ovrweightsPosMap in your included files when compiling to an exe
function calculateBestOverall(player) {

    const ovrWeights = JSON.parse(fs.readFileSync(path.join(__dirname, 'JsonLookups/ovrweights.json'), 'utf8'));
    const ovrWeightsPosMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'JsonLookups/ovrweightsPosMap.json'), 'utf8'));
    
    let newOverall = 0;
    let newArchetype = "";

    const position = ovrWeightsPosMap[player.Position]; //Get position
    for (const archetype of ovrWeights) { // Iterate to find the highest archetype
        if (archetype.Pos === position) {
            const ovrObj = ovrWeights.find(weight => weight.Archetype == archetype.Archetype);
            let sum = 0;
            const properties = archetype ? Object.keys(archetype).slice(4,55) : null;

            if (properties.length > 0) {
                if (player.fields != null) {
                    for (const attr in player.fields) {
                        if (properties.includes(attr)) {
                            const attrValue = ((player[attr] - ovrObj.DesiredLow) / (ovrObj.DesiredHigh - ovrObj.DesiredLow)) * (ovrObj[attr] / ovrObj.Sum);
                            sum += attrValue;
                        }
                    }
                } else {
                    for (const attr in player) {
                        if (properties.includes(attr)) {
                            const attrValue = ((player[attr] - ovrObj.DesiredLow) / (ovrObj.DesiredHigh - ovrObj.DesiredLow)) * (ovrObj[attr] / ovrObj.Sum);
                            sum += attrValue;
                        }
                    }
                }
            }

            const overall = Math.round(Math.min(sum * 99, 99));

            if (overall > newOverall) {
                newOverall = overall;
                newArchetype = archetype.Archetype;
            }
        }
    }

    // Return the highest overall/archetype
    return { newOverall, newArchetype };
};

async function emptyHistoryTables(franchise, tables) {
    const historyEntryArray = franchise.getTableByUniqueId(tables.historyEntryArray);
    const historyEntry = franchise.getTableByUniqueId(tables.historyEntry);
    const transactionHistoryArray = franchise.getTableByUniqueId(tables.transactionHistoryArray);
    const transactionHistoryEntry = franchise.getTableByUniqueId(tables.transactionHistoryEntry);
    await readTableRecords([historyEntryArray,historyEntry,transactionHistoryArray,transactionHistoryEntry]);
  
    for (let i = 0; i < historyEntryArray.header.recordCapacity;i++) {
        if (!historyEntryArray.records[i].isEmpty) {
            for (let j = 0; j < historyEntryArray.header.numMembers;j++) {
            historyEntryArray.records[i][`HistoryEntry${j}`] = ZERO_REF;

            }
        }
     }
  
    for (let i = 0; i < transactionHistoryArray.header.recordCapacity;i++) {
        if (!transactionHistoryArray.records[i].isEmpty) {
            for (let j = 0; j < transactionHistoryArray.header.numMembers;j++) {
            transactionHistoryArray.records[i][`TransactionHistoryEntry${j}`] = ZERO_REF;

            }
        }
     }
  
    for (let i = 0; i < transactionHistoryEntry.header.recordCapacity;i++) {
        if (!transactionHistoryEntry.records[i].isEmpty) {
        const record = transactionHistoryEntry.records[i];
        record.OldTeam = ZERO_REF;
        record.NewTeam = ZERO_REF;
        record.SeasonYear = 0;
        record.TransactionId = 0;
        record.SeasonStage = 'PreSeason';
        record.ContractStatus = 'Drafted';
        record.OldContractStatus = 'Drafted';
        record.SeasonWeek = 0;
        record.FifthYearOptionCapHit = 0;
        record.ContractLength = 0;
        record.ContractTotalSalary = 0;
        record.CapSavingsThisYear = 0;
        record.ContractBonus = 0;
        record.ContractSalary = 0;
        record.empty();
        }
     }
    // I wouldn't recommend using this part - It shouldn't be necessary and has over 65k rows
    /*for (let i = 0; i < historyEntry.header.recordCapacity;i++) {
        if (!historyEntry.records[i].isEmpty) {
            const record = historyEntry.records[i];
            record.Person = ZERO_REF;
            record.IsSchemeFit = false;
            record.CurrentStage = 'NFLSeason';
            record.LegacyValue = 0;
            record.ExperienceValue = 0;
            record.CurrentYear = 0;
            record.BaseExperience = 0;
            record.BonusExperience = 0;
            record.DynamicDevValue = 0;
            record.ProgressionValue = 0;
            record.MiscValue = 0;
            record.ConfidenceValue = 0;
            record.CurrentWeek = 0;
            record.DynamicDevValue = 0;
            record.empty();
        }
    }*/
};

// Empties the Character Visuals table entirely
// franchise: Your franchise object
// tables: The tables object from FranchiseTableId
async function emptyCharacterVisualsTable(franchise, tables) {
    const characterVisuals = franchise.getTableByUniqueId(tables.characterVisualsTable);
    await characterVisuals.readRecords();
  
    for (let i = 0; rows < characterVisuals.header.recordCapacity;i++) {
      const record = characterVisuals.records[i];
        if (!record.isEmpty) {
          record['RawData'] = {};
          record.empty();
        }
    }
};

// Regenerates all marketing tables based on top player personalities in the file
// franchise: Your franchise object
// tables: The tables object from FranchiseTableId
async function regenerateMarketingTables(franchise, tables) {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    const marketingTable = franchise.getTableByUniqueId(tables.marketedPlayersArrayTable);
    const topMarketedPlayers = franchise.getTableByUniqueId(tables.topMarketedPlayers);
    const playerMerchTable = franchise.getTableByUniqueId(tables.playerMerchTable);
    await readTableRecords([playerTable, teamTable, marketingTable, topMarketedPlayers, playerMerchTable]);
  
    for (let i = 0; i < teamTable.header.recordCapacity; i++) {
      const teamRecord = teamTable.records[i];
      if (teamRecord.isEmpty) {
        continue;
      }
      let bestPersonalityArray = [];
  
      const teamIndex = teamRecord.TeamIndex;
      const marketedPlayersRow = await bin2Dec(teamRecord.MarketedPlayers.slice(15));
      const filteredRecords = playerTable.records.filter(record => !record.isEmpty); // Filter for where the rows aren't empty
      const bestPersonalityPlayers = filteredRecords.filter(record => record.ContractStatus === 'Signed' && record.TeamIndex === teamIndex); // Filter nonempty players for where they're signed
  
      // Sort the bestPersonalityPlayers array based on PersonalityRating and then OverallRating
      const top5Players = bestPersonalityPlayers.sort((a, b) => {
        // First, compare by PersonalityRating
        if (a.PersonalityRating !== b.PersonalityRating) {
          return b.PersonalityRating - a.PersonalityRating; // Sort by PersonalityRating in descending order
        }
        // If PersonalityRating is the same, compare by OverallRating
        return b.OverallRating - a.OverallRating; // Sort by OverallRating in descending order
      }).slice(0, marketingTable.header.numMembers);
  
      for (const record of top5Players) {
        const rowIndex = playerTable.records.indexOf(record);
        const currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);
        bestPersonalityArray.push(currentBin);
      }
  
      // Set the marketingTable binary = bestPersonalityArray
      bestPersonalityArray.forEach((val, index) => {
        marketingTable.records[marketedPlayersRow].fieldsArray[index].value = val;
      });
    }
  
    let bestPersonalityArray = [];
    let filteredRecords = playerTable.records.filter(record => !record.isEmpty && record.ContractStatus === 'Signed'); // Filter for where the rows aren't empty
    
    // Sort the filteredRecords array based on PersonalityRating and then OverallRating
    const topTen = filteredRecords.sort((a, b) => {
      // First, compare by PersonalityRating
      if (a.PersonalityRating !== b.PersonalityRating) {
        return b.PersonalityRating - a.PersonalityRating; // Sort by PersonalityRating in descending order
      }
      // If PersonalityRating is the same, compare by OverallRating
      return b.OverallRating - a.OverallRating; // Sort by OverallRating in descending order
    }).slice(0, topMarketedPlayers.header.numMembers);
    
    for (const record of topTen) {
      const rowIndex = playerTable.records.indexOf(record); 
      const currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);
      bestPersonalityArray.push(currentBin);
    }
    
    bestPersonalityArray.forEach((val, index) => { topMarketedPlayers.records[0].fieldsArray[index].value = val; });
  
    bestPersonalityArray = [];
  
    filteredRecords = playerTable.records.filter(record => !record.isEmpty && record.ContractStatus === 'Signed'); // Filter for where the rows aren't empty
    
    const topPlayers = filteredRecords.sort((a, b) => {
      return b.OverallRating - a.OverallRating; // Sort by OverallRating in descending order
    }).slice(0, playerMerchTable.header.recordCapacity);
  
    for (const record of topPlayers) {
      const rowIndex = playerTable.records.indexOf(record); 
      const currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);
      const jerseyNum = playerTable.records[rowIndex]['JerseyNum'];
      const teamIndex = playerTable.records[rowIndex]['TeamIndex'];
      let presentationId = 0;
  
      const teamRecord = teamTable.records.find(team => team.TeamIndex === teamIndex);
  
      if (teamRecord) {
        presentationId = teamRecord.PresentationId;
      }
  
      bestPersonalityArray.push({playerValue: currentBin, jerseyNumber: jerseyNum, presentationId: presentationId});
    }
  
    for (let i = 0; i < bestPersonalityArray.length; i++) {
      const currentPlayer = bestPersonalityArray[i];
      const merchRecord = playerMerchTable.records[i];
  
      merchRecord.Player = currentPlayer.playerValue;
      merchRecord.MerchandiseType = 'Jersey';
      merchRecord.JerseyNumber = currentPlayer.jerseyNumber;
      merchRecord.TeamPresentationId = currentPlayer.presentationId;
    }
};

// Empties the acquisition array tables
async function emptyAcquisitionTables(franchise,tables) {
    const playerAcquisitionEvaluation = franchise.getTableByUniqueId(tables.playerAcquisitionEvaluationTable);
    const playerAcquisitionEvaluationArray = franchise.getTableByUniqueId(tables.playerAcquisitionEvaluationArrayTable);
  
    await playerAcquisitionEvaluation.readRecords();
    await playerAcquisitionEvaluationArray.readRecords();
  
    for (let i = 0; i < playerAcquisitionEvaluation.header.recordCapacity;i++) {
      if (playerAcquisitionEvaluation.records[i].isEmpty) {
        continue;
      }

      const record = playerAcquisitionEvaluation.records[i];
      record.Player = ZERO_REF;
      record.IsPlayerSuperstar = false;
      record.IsPlayerXFactor = false;
      record.AddedValue = 0;
      record.DevelopmentValue = 0;
      record.Value = 0;
      record.FreeAgentComparisonValue = 0;
      record.ImportanceValue = 0;
      record.TeamSchemeOverallValue = 0;
      record.TeamTradePhilosophyValue = 0;
      record.AcquisitionType = "Signed";
      record.Rank = 0;
      record.BestSchemeOverallValue = 0;
      record.CoachTradeInfluenceValue = 0;
      record.ContractValue = 0;
      record.IsPlayerHidden = false;
      record.empty();
    }
  
    for (let i = 0; i < playerAcquisitionEvaluationArray.header.recordCapacity;i++) {
      if (playerAcquisitionEvaluationArray.records[i].isEmpty) {
        continue;
      }
      for (j = 0; j < playerAcquisitionEvaluationArray.header.numMembers;j++) {
        playerAcquisitionEvaluationArray.records[i][`PlayerAcquisitionEvaluation${j}`] = ZERO_REF;
      }
    }
  
}
  
// This function empties the resign table/resign array table
async function emptyResignTable(franchise,tables) {
    const resignTable = franchise.getTableByUniqueId(tables.reSignTable);
    const resignArrayTable = franchise.getTableByUniqueId(tables.reSignArrayTable)
    await resignTable.readRecords();
    await resignArrayTable.readRecords();

    for (let i = 0; i < resignTable.header.recordCapacity; i++) {
        //Iterate through resign table and set default values

        const resignRecord = resignTable.records[i];
        resignRecord.Team = ZERO_REF;
        resignRecord.Player = ZERO_REF;
        resignRecord.ActiveRequestID = "-2147483648";
        resignRecord.NegotiationWeek = 0;
        resignRecord.TeamReSignInterest = 0;
        resignRecord.ContractSalary = 0;
        resignRecord.NegotiationCount = 0;
        resignRecord.PlayerReSignInterest = 0;
        resignRecord.ContractBonus = 0;
        resignRecord.PreviousOfferedContractBonus = 0;
        resignRecord.PreviousOfferedContractSalary = 0;
        resignRecord.FairMarketContractBonus = 0;
        resignRecord.FairMarketContractSalary = 0;
        resignRecord.ActualDesiredContractBonus = 0;
        resignRecord.ActualDesiredContractSalary = 0;
        resignRecord.LatestOfferStage = "PreSeason";
        resignRecord.ContractLength = 0;
        resignRecord.FairMarketContractLength = 0;
        resignRecord.PreviousOfferedContractLength = 0;
        resignRecord.PreviousReSignStatus = "Invalid";
        resignRecord.ReSignStatus = "NotReady";
        resignRecord.LatestOfferWeek = 0;
        resignRecord.PlayerPreviousReSignInterest = 0;
        resignRecord.InitialContract = false;
        resignRecord.NegotiationsEnded = false;
        resignRecord.ActualDesiredContractLength = 0;
        


        //This results in every row being emptied
        if (!resignRecord.isEmpty) {
            resignRecord.empty();
        }

    }

    //Iterate through the resign array table and zero everything out
    for (let i = 0; i < resignArrayTable.header.numMembers; i++) {
        resignArrayTable.records[0][`PlayerReSignNegotiation${i}`] = ZERO_REF;
    }
  
};

// This function will remove a binary value from an array table
// It will iterate through each row and look for the binary. If multiple rows/columns
// contain the target binary, they will all be removed.
// table: The table passed through to remove the binary from
// binaryToRemove: The binary we're removing from the table
async function removeFromTable(table, binaryToRemove) {
    const numMembers = table.header.numMembers;
    const recordCapacity = table.header.recordCapacity;

    for (let i = 0; i < recordCapacity; i++) { // Iterate through the table
      let allBinary = []; // This will become all of our binary for the row EXCEPT the binaryToRemove

      const currentRecord = table.records[i];
      if (currentRecord.isEmpty) {
        continue; // This almost never gets triggered for array tables
      }
      
      currentRecord.fieldsArray.forEach(field => {
        allBinary.push(field.value)
      })

      // Filter out the binaryToRemove from allBinary
      allBinary = allBinary.filter((bin) => bin !== binaryToRemove);

      while (allBinary.length < numMembers) {
        allBinary.push(ZERO_REF);
      }

      // Set the new binary for the row
      allBinary.forEach((val, index) => {
        table.records[i].fieldsArray[index].value = val;
      });
    }
}

async function recalculateRosterSizes(playerTable, teamTable) {

  const invalidStatuses = ['Draft','Retired','Deleted','None','Created','PracticeSquad'];

  for (let i = 0; i < teamTable.header.recordCapacity; i++) {
    let activeRosterSize = 0; // Current active players
    let salCapRosterSize = 0; // Total rostered players, including IR (but not PS)
    let salCapNextYearRosterSize = 0; // Players slated to be rostered next season

    const teamRecord = teamTable.records[i];

    if (teamRecord.isEmpty || NFL_CONFERENCES.includes(teamRecord.DisplayName) || !teamRecord.TEAM_VISIBLE) {
      continue;
    }

    const currentTeamIndex = teamRecord.TeamIndex;

    const filteredPlayerRecords = playerTable.records.filter(playerRecord => 
      !playerRecord.isEmpty &&
      !invalidStatuses.includes(playerRecord.ContractStatus) &&
      playerRecord.TeamIndex === currentTeamIndex
    );

    filteredPlayerRecords.forEach(playerRecord => {
      salCapRosterSize++;

      if (!playerRecord.IsInjuredReserve) {
        activeRosterSize++;
      }

      if (playerRecord.ContractLength > 1) {
        salCapNextYearRosterSize++;
      }
    });

    teamRecord.ActiveRosterSize = activeRosterSize;
    teamRecord.SalCapRosterSize = salCapRosterSize;
    teamRecord.SalCapNextYearRosterSize = salCapNextYearRosterSize;
  }
}

async function bin2Dec(binary) {
    return parseInt(binary, 2);
};

function dec2bin(dec) {
    return (dec >>> 0).toString(2);
};

async function hasNumber(myString) {
    return /\d/.test(myString);
};
  


module.exports = {
    selectFranchiseFile,
    selectFranchiseFileAsync,
    saveFranchiseFile,
    getGameYear,
    bin2Dec,
    dec2bin,
    hasNumber,
    readTableRecords,
    calculateBestOverall,
    emptyHistoryTables,
    removeFromTable,
    emptyCharacterVisualsTable,
    regenerateMarketingTables,
    emptyAcquisitionTables,
    emptyResignTable,
    recalculateRosterSizes,
    ZERO_REF,
    NFL_CONFERENCES,
    OFFENSIVE_SKILL_POSITIONS,
    OLINE_POSITIONS,
    DEFENSIVE_LINE_POSITIONS,
    LINEBACKER_POSITIONS,
    DEFENSIVE_BACK_POSITIONS,
    SPECIAL_TEAM_POSITIONS,
    COACH_SKIN_TONES,
    COACH_APPAREL
  };