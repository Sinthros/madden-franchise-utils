const Franchise = require('madden-franchise');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const { tables, tablesM25 } = require('./FranchiseTableId');
const path = require('path');
const os = require('os');
const fs = require('fs');
const prompt = require('prompt-sync')();


/*******************************************************
 *                  GLOBAL CONSTANTS                   *
 *                                                     *
 *   Any constant variable that is not class-specific  *
 *   should be placed in this file.                    *
 *******************************************************/


const ZERO_REF = '00000000000000000000000000000000';
const BASE_FILE_INIT_KWD = 'CAREER';
const FTC_FILE_INIT_KWD = 'franchise-';
const YES_KWD = "YES";
const NO_KWD = "NO";

// GAME YEARS
const YEARS = {
  M19: 19,
  M20: 20,
  M21: 21,
  M22: 22,
  M23: 23,
  M24: 24,
  M25: 25
};

const CONTRACT_STATUSES = {
  SIGNED: 'Signed',
  FREE_AGENT: 'FreeAgent',
  PRACTICE_SQUAD: 'PracticeSquad',
  DRAFT: 'Draft',
  DRAFTED: 'Drafted',
  RETIRED: 'Retired',
  CREATED: 'Created',
  EXPIRING: 'Expiring',
  DELETED: 'Deleted',
  NONE: 'None'

}

const NFL_CONFERENCES = ['AFC', 'NFC'];

const OFFENSIVE_SKILL_POSITIONS = ['QB', 'HB', 'FB', 'WR', 'TE'];
const OLINE_POSITIONS = ['LT','LG','C','RG','RT'];
const DEFENSIVE_LINE_POSITIONS = ['DT','LE','RE'];
const LINEBACKER_POSITIONS = ['MLB','LOLB','ROLB'];
const DEFENSIVE_BACK_POSITIONS = ['CB','FS','SS'];
const SPECIAL_TEAM_POSITIONS = ['K','P'];

const COACH_SKIN_TONES = ['SkinTone1', 'SkinTone2', 'SkinTone3', 'SkinTone4', 'SkinTone5', 'SkinTone6', 'SkinTone7'];
const COACH_APPAREL = ['Facility1', 'Facility2', 'Practice1', 'Practice2', 'Practice3', 'Staff1', 'Staff2', 'Staff3', 'Staff4'];

// Default FULL_CONTROL settings
const USER_CONTROL_SETTINGS = [
  {label: 'Trades and Free Agency', name: 'IsTradeAndFreeAgencyEnabled', value: true},
  {label: 'Scout College Players', name: 'IsScoutCollegePlayersEnabled', value: true},
  {label: 'League Advancement', name: 'IsManualAdvancementEnabled', value: true},
  {label: 'Manage Practice Reps', name: 'IsManagePracticeRepsEnabled', value: true},
  {label: 'Injury Management', name: 'IsInjuryManagementEnabled', value: true},
  {label: 'Offseason FA Bidding', name: 'IsCPUSignOffseasonFAEnabled', value: true},
  {label: 'Contract Negotiations', name: 'IsCPUReSignPlayersEnabled', value: true},
  {label: 'Preseason Cut Days', name: 'IsCPUCutPlayersEnabled', value: true},
  {label: 'Tutorial Pop-ups', name: 'IsTutorialPopupEnabled', value: false},
  {label: 'Auto Progress Talents', name: 'IsCPUProgressTalentsEnabled', value: false},
  {label: 'Auto Progress Players', name: 'IsCPUProgressPlayersEnabled', value: false},
  {label: 'Fill Roster', name: 'IsCPUFillRosterEnabled', value: false},
  {label: 'Manual Depth Chart', name: 'IsManualReorderDepthChartEnabled', value: true},
  {label: 'Season Experience', name: 'SeasonExperience', value: 'FULL_CONTROL'},
];

// Default SIMPLE settings
const CPU_CONTROL_SETTINGS = [
  {label: 'Trades and Free Agency', name: 'IsTradeAndFreeAgencyEnabled', value: false},
  {label: 'Scout College Players', name: 'IsScoutCollegePlayersEnabled', value: false},
  {label: 'League Advancement', name: 'IsManualAdvancementEnabled', value: false},
  {label: 'Manage Practice Reps', name: 'IsManagePracticeRepsEnabled', value: false},
  {label: 'Injury Management', name: 'IsInjuryManagementEnabled', value: false},
  {label: 'Offseason FA Bidding', name: 'IsCPUSignOffseasonFAEnabled', value: false},
  {label: 'Contract Negotiations', name: 'IsCPUReSignPlayersEnabled', value: false},
  {label: 'Preseason Cut Days', name: 'IsCPUCutPlayersEnabled', value: false},
  {label: 'Tutorial Pop-ups', name: 'IsTutorialPopupEnabled', value: false},
  {label: 'Auto Progress Talents', name: 'IsCPUProgressTalentsEnabled', value: true},
  {label: 'Auto Progress Players', name: 'IsCPUProgressPlayersEnabled', value: true},
  {label: 'Fill Roster', name: 'IsCPUFillRosterEnabled', value: true},
  {label: 'Manual Depth Chart', name: 'IsManualReorderDepthChartEnabled', value: false},
  {label: 'Season Experience', name: 'SeasonExperience', value: 'SIMPLE'},
];


/*******************************************************
 *                  GLOBAL FUNCTIONS                   *
 *                                                     *
 *   Any function that is not class-specific should    *
 *   be placed in this file.                           *
 *******************************************************/


/**
 * Init function which handles selecting the franchise file and validating it
 * 
 * @param {number|string|Array<number|string>} validGameYears - A valid game year or an array of valid game years.
 *
 * @param {boolean} [isAutoUnemptyEnabled=false] - If true, rows will always be unemptied upon editing.
 *                                                 If you aren't sure, leave this as false.
 * @param {boolean} [isFtcFile=false] - Whether the file is an FTC file. You can almost always leave this as false.
 * @returns {Object} - The selected Franchise object.
 */

function init(validGameYears, isAutoUnemptyEnabled = false, isFtcFile = false, promptForBackup = true) {
  const gameYear = getGameYear(validGameYears);
  const franchise = selectFranchiseFile(gameYear, isAutoUnemptyEnabled, isFtcFile);
  validateGameYears(franchise, validGameYears);

  if (promptForBackup) {
    const backupMessage = "Would you like to make a backup of your franchise file before running this program? Enter yes or no.";
    const saveBackupFile = getYesOrNo(backupMessage);
  
    if (saveBackupFile) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Replace characters that aren't allowed in filenames
      const backupFilePath = `${franchise._filePath}_${timestamp}`;
  
      try {
        fs.copyFileSync(franchise._filePath, backupFilePath);
        console.log(`Backup saved to ${backupFilePath}`);
      } catch (error) {
        console.error('Error saving backup file:', error);
      }
    }
  }

  return franchise;
}

/**
 * Selects a franchise file based on the provided game year and options.
 *
 * @param {number|string} gameYear - The Madden game year of the Franchise File object.
 * @param {boolean} [isAutoUnemptyEnabled=false] - If true, rows will always be unemptied upon editing.
 *                                                 If you aren't sure, leave this as false.
 * @param {boolean} [isFtcFile=false] - Whether the file is an FTC file. You can almost always leave this as false.
 * @returns {Object} - The selected Franchise object.
 */
function selectFranchiseFile(gameYear, isAutoUnemptyEnabled = false, isFtcFile = false) {
  const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
  const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
  const filePrefix = isFtcFile ? FTC_FILE_INIT_KWD : BASE_FILE_INIT_KWD;
  
  let defaultPath;

  if (fs.existsSync(documentsDir)) {
    defaultPath = documentsDir;
  } else if (fs.existsSync(oneDriveDir)) {
    defaultPath = oneDriveDir;
  } else {
    console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
  }

  while (true) {
    try {
      console.log(`Please enter the name of your Madden ${gameYear} franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder. Or, enter 0 to exit.`);
      let fileName = prompt().trim(); // Remove leading/trailing spaces

      if (fileName === "0") {
        EXIT_PROGRAM();
      }

      const franchisePath = fileName.startsWith(filePrefix) ? path.join(defaultPath, fileName) : fileName.replace(new RegExp('/', 'g'), '\\');
      
      const franchise = new Franchise(franchisePath, {'autoUnempty': isAutoUnemptyEnabled});
      return franchise;
    } catch (e) {
      console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
    }
  }
};

/**
 * Selects a franchise file based on the provided game year and options.
 *
 * @param {number|string} gameYear - The Madden game year of the Franchise File object.
 * @param {boolean} [isAutoUnemptyEnabled=false] - If true, rows will always be unemptied upon editing.
 *                                                 If you aren't sure, leave this as false.
 * @param {boolean} [isFtcFile=false] - Whether the file is an FTC file. You can almost always leave this as false.
 * @returns {Object} - The selected Franchise object.
 */
async function selectFranchiseFileAsync(gameYear, isAutoUnemptyEnabled = false, isFtcFile = false) {
    const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
    const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
    const filePrefix = isFtcFile ? FTC_FILE_INIT_KWD : BASE_FILE_INIT_KWD;
    
    let defaultPath;
    if (fs.existsSync(documentsDir)) {
        defaultPath = documentsDir;
    } else if (fs.existsSync(oneDriveDir)) {
        defaultPath = oneDriveDir;
    } else {
        console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
    }
  
    while (true) {
        try {
            console.log("Please enter the name of your franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder. Or, enter 0 to exit.");
            let fileName = prompt().trim(); // Remove leading/trailing spaces

            if (fileName === "0") {
              EXIT_PROGRAM();
            }

            const franchisePath = fileName.startsWith(filePrefix) ? path.join(defaultPath, fileName) : fileName.replace(new RegExp('/', 'g'), '\\');
            const franchise = await Franchise.create(franchisePath, {'autoUnempty': isAutoUnemptyEnabled});
  
            return franchise;
        } catch (e) {
            console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
            continue;
        }
    }
};

/**
 * Prompts the user to save the franchise file, optionally using a custom message.
 *
 * @param {Object} franchise - Your Franchise object.
 * @param {string} [customMessage=null] - Optional custom message to replace the default save prompt message.
 * @param {string} [filePath=null] - Optional file path to save the franchise file to.
 * @returns {Promise<void>}
 */
async function saveFranchiseFile(franchise, customMessage = null, filePath = null) {
  const message = customMessage || "Would you like to save your changes? Enter yes to save your changes, or no to quit without saving.";
  const saveFile = getYesOrNo(message);
  const destination = filePath ? filePath : franchise._filePath;

  if (!saveFile) {
      console.log("Your Franchise File has not been saved.");
      return;
  }

  await franchise.save(destination);
  console.log("Franchise file successfully saved!");
};


/**
 * Reads records from a list of tables and handles errors based on the continueIfError flag.
 *
 * @param {Array<Object>} tablesList - List of tables to read. For example, if you have playerTable and coachTable,
 *                                     you'd pass through [playerTable, coachTable].
 * @param {boolean} [continueIfError=false] - If true, the program will continue if there's an error reading the records for a table.
 *                                            In most cases, leave this as false; you usually don't want the program to proceed
 *                                            if there's an error loading a table.
 * @param {Object} [franchise=null] - Optional Franchise Object. If provided and one of the tables being read is the main player table,
 *                                    the program will check if the franchise file has multiple player tables and attempt to
 *                                    merge them if there are multiple. The user will have the option to decline merging the tables.
 * @returns {Promise<void>}
 */

async function readTableRecords(tablesList, continueIfError = false, franchise = null) {
  let tables = null;
  if (franchise) {
    tables = getTablesObject(franchise);
  }

  for (const table of tablesList) {
    try {
      await table.readRecords();
      
      if (tables && table.header.uniqueId === tables.playerTable) {
        if (await hasMultiplePlayerTables(franchise)) {
          await fixPlayerTables(franchise);
        }
      }
    } catch (error) {
      if (!continueIfError) {
        throw error;
      }
      //console.error(`Error reading records for table ${table.header.uniqueId}: ${error.message}`);
    }
  }
};

/**
 * Takes a list of valid game years and has the user select one.
 * If the user passes through a string/int instead of a list, it's returned immediately.
 *
 * @param {number|string|Array<number|string>} validGameYears - A valid game year or an array of valid game years.

 * @returns {number} - Returns the selected gameYear
 */
function getGameYear(validGameYears) {
    // If we didn't pass through an array, simply return the value
    if (!Array.isArray(validGameYears)) {
        return parseInt(validGameYears);
    }

    if (validGameYears.length === 1) {
      return parseInt(validGameYears[0]); // Return the integer value directly
    }

    let gameYear;
    const validGameYearsStr = validGameYears.map(String);

    while (true) {
        console.log(`Select the version of Madden your franchise file uses. Valid inputs are ${validGameYears.join(', ')}`);
        gameYear = prompt();

        if (validGameYearsStr.includes(String(gameYear))) {
            break;
        } else {
            console.log("Invalid option. Please try again.");
        }
    }

    return parseInt(gameYear);
};

/**
 * Returns the correct tables object from FranchiseTableId depending on the GameYear of your franchise file.
 * If Madden 24 or before, 'tables' will be returned.
 * If Madden 25, tablesM25 will be returned.
 *
 * @param {Object} [franchise] - Franchise Object. We get the gameYear value from this object and 
 *                               return the proper tables object.
 * @returns {Object}
 */
function getTablesObject(franchise) {
  const fileGameYear = Number(franchise.schema.meta.gameYear);

  switch (true) {
    case fileGameYear <= 24:
      return tables;
    case fileGameYear === 25:
      return tablesM25;
    default:
      return tables;
  }
}

// Function to calculate the Best Overall and Best Archetype for a player
// This takes in a player record object; For example, if you're iterating through the player table and are working
// with row i, pass through playerTable.records[i]
// Call it exactly like this:
// const player = playerTable.records[i];
// const {newOverall, newArchetype} = FranchiseUtils.calculateBestOverall(player);

// Afterwards, you can set the overall/archetype like this:
// player.OverallRating = newOverall;
// player.PlayerType = newArchetype;

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

/**
 * Empties the history tables entirely.

 * @param {Object} [franchise] - Your Franchise File object.
 * @returns {Promise<void>}
 */
async function emptyHistoryTables(franchise) {
    const tables = getTablesObject(franchise);
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


async function formatHeaders(table) {
  if (table.offsetTable) {
      if (this.showHeaderTypes) {
          return table.offsetTable.map((offset) => {
              return `${offset.name} <div class="header-type">${offset.type}</div>`;
          });
      } else {
          return table.offsetTable.map((offset) => {
              return offset.name;
          });
      }
  } else {
      return [];
  }
};

/**
 * Empties the Character Visuals table entirely.
 *
 * @param {Object} franchise - Your Franchise object.
 * @returns {Promise<void>}
 */
async function emptyCharacterVisualsTable(franchise) {
    const tables = getTablesObject(franchise);
    const characterVisuals = franchise.getTableByUniqueId(tables.characterVisualsTable);
    await characterVisuals.readRecords();
  
    for (let i = 0; i < characterVisuals.header.recordCapacity;i++) {
      const record = characterVisuals.records[i];
        if (!record.isEmpty) {
          record.RawData = {};
          record.empty();
        }
    }
};

// Regenerates all marketing tables based on top player personalities in the file
// franchise: Your franchise object
// tables: The tables object from FranchiseTableId
async function regenerateMarketingTables(franchise) {
    const tables = getTablesObject(franchise);
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
      const jerseyNum = playerTable.records[rowIndex].JerseyNum;
      const teamIndex = playerTable.records[rowIndex].TeamIndex;
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
async function emptyAcquisitionTables(franchise) {
    const tables = getTablesObject(franchise);
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
  
};
  
// This function empties the resign table/resign array table
async function emptyResignTable(franchise) {
    const tables = getTablesObject(franchise);
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
};

async function recalculateRosterSizes(playerTable, teamTable) {

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
      isValidPlayer(playerRecord, {includePracticeSquad: false, includeFreeAgents: false}) &&
      playerRecord.TeamIndex === currentTeamIndex
    )

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
};

// Returns true if there any extra player tables exist with non emptied data
// Returns false otherwise
async function hasMultiplePlayerTables(franchise) {
  const tables = getTablesObject(franchise);
  const allPlayerTables = franchise.getAllTablesByName('Player');

  for (const playerTable of allPlayerTables) {
    await playerTable.readRecords();

    // Skip the main player table
    if (playerTable.header.uniqueId === tables.playerTable) {
      continue;
    }

    // Check if the current player table's record is empty or not
    // To clarify, these extra tables only ever have 1 row
    if (!playerTable.records[0].isEmpty) {
      return true;
    }
  }

  // Otherwise, return false
  return false;
};


// This function iterates through each extra player table and adds the player to the main player table if not empty
// If we reach the limit of the main player table, the program will exit.
// I will likely come back and clean this function up eventually but it should work fine for now
async function fixPlayerTables(franchise) {

  console.log("IMPORTANT: We've detected that this file has multiple player tables, which should not happen.");
  const message = "Would you like to attempt to merge the extra player tables into the main table? This is HEAVILY recommended. Enter yes or no.";
  const mergeTables = getYesOrNo(message);

  if (!mergeTables) {
    console.log("Continuing program without merging player tables.");
    return;
  }

  const tables = getTablesObject(franchise);
  
  
  const allPlayerTables = franchise.getAllTablesByName('Player'); // All player tables
  const mainPlayerTable = franchise.getTableByUniqueId(tables.playerTable); //Get our main player table
  await mainPlayerTable.readRecords();

  //Iterate through all the extra player tables
  for (let tableIndex = 0; tableIndex < allPlayerTables.length;tableIndex++) {
    const nextPlayerRecord = mainPlayerTable.header.nextRecordToUse;

    //If we've run out of rows, we can't transfer the file over
    if (nextPlayerRecord === mainPlayerTable.header.recordCapacity) {
      console.log("********************************************************************************************")
      console.log("ERROR! Your file has too many total players and CANNOT be merged into the main player table.");
      console.log("********************************************************************************************");
      EXIT_PROGRAM();
    }

    const currentTable = allPlayerTables[tableIndex];
    await currentTable.readRecords();
    if (currentTable.header.uniqueId === tables.playerTable) {
      continue;
    }
    const referencedRow = franchise.getReferencesToRecord(currentTable.header.tableId,0);
    if (referencedRow.length === 0) {
      continue;
    }

    const originalPlayerBin = getBinaryReferenceData(currentTable.header.tableId,0);
    const newPlayerBin = getBinaryReferenceData(mainPlayerTable.header.tableId,nextPlayerRecord);
    
    const columnHeaders = await formatHeaders(currentTable) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      mainPlayerTable.records[nextPlayerRecord][currentCol] = currentTable.records[0][currentCol];
    }

    for (const table of referencedRow) {
      const currentTableId = table.tableId;
      const currentRelatedTable = franchise.getTableById(currentTableId);
      await currentRelatedTable.readRecords();

      const currentRelatedHeaders = await formatHeaders(currentRelatedTable) //Get the headers from the table


      try {
        for (let n = 0; n < currentRelatedHeaders.length;n++) {
          for (let row = 0; row < currentRelatedTable.header.recordCapacity; row++) { // Iterate through the table rows
              let currentCol = currentRelatedHeaders[n];
              if (currentRelatedTable.records[row].fields[currentCol]["isReference"]) {
                if (currentRelatedTable.records[row][currentCol] === originalPlayerBin) {
                  currentRelatedTable.records[row][currentCol] = newPlayerBin;
                  //console.log(`${currentCol} ${currentRelatedTable.header.name} ${currentTableId} ${row}`)
                }
              }
          }
       }
      } catch (e) { // If there's an error, it's okay to just continue
        continue;
      }
    }
  }

  console.log("Successfully merged all extra player tables into the main player table.");
};

/**
 * Grants user control to the specified team.
 *
 * @param {string} teamRow - The row of the team in the Team table.
 * @param {Object} franchise - Franchise Object.
 * @param {string} controlLevel - The level of control to grant ('None', 'Commissioner').
 * @param {Array<Object>} controlSettings - Array of control settings. 
 *                                          Reference USER_CONTROL_SETTINGS/CPU_CONTROL_SETTINGS in FranchiseUtils for the structure
 * @param {boolean} setAsDefault - Whether to set this user as the 'Owner' user.
 * @returns {Promise<void>}
 */
async function takeControl(teamRow, franchise, controlLevel, controlSettings, setAsDefault) {
  const tables = getTablesObject(franchise);
  const franchiseUserTable = franchise.getTableByUniqueId(tables.franchiseUserTable);
  const franchiseUsersArray = franchise.getTableByUniqueId(tables.franchiseUsersArray);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const coachTable = franchise.getTableByUniqueId(tables.coachTable);
  const ownerTable = franchise.getTableByUniqueId(tables.ownerTable);
  const teamSettingTable = franchise.getTableByUniqueId(tables.teamSettingTable);
  await readTableRecords([franchiseUserTable,franchiseUsersArray,teamTable,coachTable,ownerTable,teamSettingTable]);

  const teamRecord = teamTable.records[teamRow];
  const teamBinary = getBinaryReferenceData(teamTable.header.tableId, teamRow);

  let franchiseOwnerBinary;
  let franchiseBinary;

  // Remove False Records
  // Basically, remove records where they're unemptied in the franchise user table but not included in the associated array table
  //const currentRecords = franchiseUserTable.records.filter(record => !record.isEmpty);
  //const currentUsers = franchiseUsersArray.records[0].fieldsArray.filter(field => field.value !== ZERO_REF).map(field => field.referenceData.rowNumber);
  //currentRecords.forEach(record => {
  //    if (currentUsers.includes(record.index)) return;
  //    const fakeTeam = {
  //       value: record.Team.value
  //    }
  //    removeControl(fakeTeam, franchise);
  //});

  let currTeamRecord = franchiseUserTable.records.find(record => record.Team === teamBinary);
  let row = null;
  
  if (currTeamRecord == undefined) {
      row = franchiseUserTable.records.filter(record => record.isEmpty)[0].index;
      //console.log(row)
      franchiseUserTable.records[row].TeamSetting = teamRecord.TeamSettingRef;
      franchiseUserTable.records[row].Team = teamBinary;
      let userBinary = null;

      // Check if the current team has a Head Coach
      const coachRecord = coachTable.records.find(record => 
          record.Position === 'HeadCoach' &&
          record.ContractStatus === 'Signed' &&
          !record.isEmpty &&
          record.TeamIndex === teamRecord.TeamIndex
      );
      
      if (coachRecord) {
          userBinary = getBinaryReferenceData(coachTable.header.tableId,coachRecord.index);
          coachRecord.IsUserControlled = true;
      } else {
          // Else, get the current teams default Owner
          const defaultOwnerRow = teamRecord.fields.DefaultOwner.referenceData.rowNumber;
          userBinary = getBinaryReferenceData(ownerTable.header.tableId,defaultOwnerRow);
          ownerTable.records[defaultOwnerRow].IsUserControlled = true;
      }

      franchiseUserTable.records[row].UserEntity = userBinary;
      franchiseUserTable.records[row].AdminLevel = controlLevel == 'None' ? 'None' : 'Commissioner';

      teamRecord.UserCharacter = userBinary;

      const ownerRecord = franchiseUserTable.records.find(record => record.AdminLevel === 'Owner');

      // We'll need this binary when setting up the Request tables
      franchiseOwnerBinary = getBinaryReferenceData(franchiseUserTable.header.tableId, ownerRecord.index);
      
      franchiseUserTable.records[row].UserIdLower = ownerRecord.UserIdLower;
      franchiseUserTable.records[row].UserIdUpper = ownerRecord.UserIdLower + row;
      franchiseUserTable.records[row].DefaultRequestActionTimeout = ownerRecord.DefaultRequestActionTimeout;
      
      franchiseUserTable.records[row].PersonalityTeamPlayerRating = 50;
      franchiseUserTable.records[row].PersonalityLeaderRating = 50;
      franchiseUserTable.records[row].PersonalityIntenseRating = 50;
      franchiseUserTable.records[row].PersonalityEntertainerRating = 50;
      franchiseUserTable.records[row].ReadyToAdvance = false;
      
      franchiseUserTable.records[row].NonRepeatableArcsTriggeredArray = ZERO_REF;
      franchiseUserTable.records[row].DifficultyLevelPlayerWeeklyGoalsArray = ZERO_REF;
      franchiseUserTable.records[row].FirstTimeAchievement = ZERO_REF;
        

      // Franchise Users Array
      franchiseBinary = getBinaryReferenceData(franchiseUserTable.header.tableId,row);
      const currentUsers = franchiseUsersArray.records[0].fieldsArray.filter(field => field.value != ZERO_REF);
      franchiseUsersArray.records[0].fieldsArray.forEach((field, index) => {
          if (index < currentUsers.length) {
              field.value = currentUsers[index].value;
          } else if (index == currentUsers.length) {
              field.value = franchiseBinary;
          } else {
              field.value = ZERO_REF;
          }
      });
  } else {
      row = currTeamRecord.index;
  } 
  
  // Set As Default Owner
  if (setAsDefault) {
    // Find current owner and set a level down
    const currentOwner = franchiseUserTable.records.find(record => record.AdminLevel === 'Owner');
    if (currentOwner) {
      currentOwner.AdminLevel = 'Commissioner';
    }
    // Set new record to be owner of franchise file
    franchiseUserTable.records[row].AdminLevel = 'Owner';
  }

  // Team Control Settings
  const currRecord = teamSettingTable.records[franchiseUserTable.records[row].fields.TeamSetting.referenceData.rowNumber];    

  currRecord.IsTutorialPopupEnabled = controlSettings.find(setting => setting.name === 'IsTutorialPopupEnabled').value;
  currRecord.IsTradeAndFreeAgencyEnabled = controlSettings.find(setting => setting.name === 'IsTradeAndFreeAgencyEnabled').value;
  currRecord.IsScoutCollegePlayersEnabled = controlSettings.find(setting => setting.name === 'IsScoutCollegePlayersEnabled').value;
  currRecord.IsManualAdvancementEnabled = controlSettings.find(setting => setting.name === 'IsManualAdvancementEnabled').value;
  currRecord.IsManagePracticeRepsEnabled = controlSettings.find(setting => setting.name === 'IsManagePracticeRepsEnabled').value;
  currRecord.IsInjuryManagementEnabled = controlSettings.find(setting => setting.name === 'IsInjuryManagementEnabled').value;
  currRecord.IsCPUSignOffseasonFAEnabled = controlSettings.find(setting => setting.name === 'IsCPUSignOffseasonFAEnabled').value;
  currRecord.IsCPUReSignPlayersEnabled = controlSettings.find(setting => setting.name === 'IsCPUReSignPlayersEnabled').value;
  currRecord.IsCPUProgressTalentsEnabled = controlSettings.find(setting => setting.name === 'IsCPUProgressTalentsEnabled').value;
  currRecord.IsCPUProgressPlayersEnabled = controlSettings.find(setting => setting.name === 'IsCPUProgressPlayersEnabled').value;
  currRecord.IsCPUFillRosterEnabled = controlSettings.find(setting => setting.name === 'IsCPUFillRosterEnabled').value;
  currRecord.IsCPUCutPlayersEnabled = controlSettings.find(setting => setting.name === 'IsCPUCutPlayersEnabled').value;
  currRecord.IsManualReorderDepthChartEnabled = controlSettings.find(setting => setting.name === 'IsManualReorderDepthChartEnabled').value;
  currRecord.SeasonExperience = controlSettings.find(setting => setting.name === 'SeasonExperience').value;
  
  
}


/**
 * Removes user control from the specified team
 *
 * @param {string} teamRow - The row of the team in the Team table.
 * @param {Object} franchise - Franchise Object.
 * @returns {Promise<void>}
 */
async function removeControl(teamRow, franchise) {
  const tables = getTablesObject(franchise);
  const franchiseUserTable = franchise.getTableByUniqueId(tables.franchiseUserTable);
  const franchiseUsersArray = franchise.getTableByUniqueId(tables.franchiseUsersArray);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const teamSettingTable = franchise.getTableByUniqueId(tables.teamSettingTable);
  await readTableRecords([franchiseUserTable,franchiseUsersArray,teamTable,teamSettingTable]);
  
  const teamRecord = teamTable.records[teamRow];
  const teamBinary = getBinaryReferenceData(teamTable.header.tableId, teamRow);

  const currTeamRecord = franchiseUserTable.records.find(record => record.Team == teamBinary);

  if (!currTeamRecord) {
    return;
  }
  
  let row = currTeamRecord.index;
  const franchiseBinary = getBinaryReferenceData(franchiseUserTable.header.tableId, row);

  // Our row could either be from the Coach table or Owner table. We'll read the table dynamically to be safe
  const coachOwnerRow = currTeamRecord.fields.UserEntity.referenceData.rowNumber;
  const userBinary = currTeamRecord.UserEntity;
  const coachOwnerTableId = await bin2Dec(userBinary.slice(0,15));

  // Team Control Settings
  const currRecord = teamSettingTable.records[currTeamRecord.fields.TeamSetting.referenceData.rowNumber];    

  currRecord.IsTutorialPopupEnabled = false;
  currRecord.IsTradeAndFreeAgencyEnabled = false;
  currRecord.IsScoutCollegePlayersEnabled = false;
  currRecord.IsManualAdvancementEnabled = false;
  currRecord.IsManagePracticeRepsEnabled = false;
  currRecord.IsInjuryManagementEnabled = false;
  currRecord.IsCPUSignOffseasonFAEnabled = false;
  currRecord.IsCPUReSignPlayersEnabled = false;
  currRecord.IsCPUProgressTalentsEnabled = true;
  currRecord.IsCPUProgressPlayersEnabled = true;
  currRecord.IsCPUFillRosterEnabled = true;
  currRecord.IsCPUCutPlayersEnabled = false;
  currRecord.IsManualReorderDepthChartEnabled = false;
  currRecord.SeasonExperience = 'SIMPLE';

  // Remove Control         
  currTeamRecord.TeamSetting = ZERO_REF;
  currTeamRecord.Team = ZERO_REF;
  currTeamRecord.StorySideActivityContext = ZERO_REF;
  currTeamRecord.RewardEntries = ZERO_REF;
  currTeamRecord.UserEntity = ZERO_REF;
  currTeamRecord.BreakingNewsQueue = ZERO_REF;
  currTeamRecord.CrossArcDataArray = ZERO_REF;
  currTeamRecord.ObjectiveProgressArray = ZERO_REF;
  currTeamRecord.CurrentCompletedWeeklyGoalsArray = ZERO_REF;
  currTeamRecord.LastWeekCompletedWeeklyGoalsArray = ZERO_REF;
  currTeamRecord.PlayerSpecificDrill = ZERO_REF;
  currTeamRecord.DrillProgress = ZERO_REF;
  
  currTeamRecord.NonRepeatableArcsTriggeredArray = ZERO_REF;
  currTeamRecord.DifficultyLevelPlayerWeeklyGoalsArray = ZERO_REF;
  currTeamRecord.FirstTimeAchievement = ZERO_REF;
  
  currTeamRecord.PersonalityTeamPlayerRating = 0;
  currTeamRecord.PersonalityLeaderRating = 0;
  currTeamRecord.PersonalityIntenseRating = 0;
  currTeamRecord.PersonalityEntertainerRating = 0;  

  currTeamRecord.empty();

  // Set IsUserControlled = false in the Coach table or Owner table, depending on what the user is
  const coachOwnerTable = franchise.getTableById(coachOwnerTableId);
  await coachOwnerTable.readRecords();
  coachOwnerTable.records[coachOwnerRow].IsUserControlled = false;

  teamRecord.UserCharacter = ZERO_REF;
  await removeFromTable(franchiseUsersArray, franchiseBinary);

}

/**
 * Determines if a player is valid based on various criteria.
 *
 * @param {Object} playerRecord - The record to check. Can be passed through as playerTable.records[rowNum].
 * @param {Object} [options={}] - Options to include or exclude certain player statuses.
 * @param {boolean} [options.includeDraftPlayers=true] - Include draft players?
 * @param {boolean} [options.includeFreeAgents=true] - Include free agent players?
 * @param {boolean} [options.includePracticeSquad=true] - Include practice squad players?
 * @param {boolean} [options.includeRetiredPlayers=false] - Include retired players?
 * @param {boolean} [options.includeDeletedPlayers=false] - Include deleted players?
 * @param {boolean} [options.includeCreatedPlayers=false] - Include Created players? (Should likely always leave as false)
 * @param {boolean} [options.includeNoneTypePlayers=false] - Include None players? (Should likely always leave as false)
 * @param {boolean} [options.includeLegends=false] - Include legends? (We believe this is only used for Superstar mode - Keep as false if not sure)
 * @returns {boolean} - Returns `true` if the player is valid, `false` otherwise.
 */
function isValidPlayer(playerRecord, options = {}) {
  const {
    includeSignedPlayers = true,
    includeFreeAgents = true,
    includePracticeSquad = true,
    includeExpiringPlayers = true,
    includeDraftPlayers = false,
    includeRetiredPlayers = false,
    includeDeletedPlayers = false,
    includeCreatedPlayers = false,
    includeNoneTypePlayers = false,
    includeLegends = false
  } = options;

  const invalidStatuses = new Set([
    ...(!includeSignedPlayers ? [CONTRACT_STATUSES.SIGNED] : []),
    ...(!includeFreeAgents ? [CONTRACT_STATUSES.FREE_AGENT] : []),
    ...(!includePracticeSquad ? [CONTRACT_STATUSES.PRACTICE_SQUAD] : []),
    ...(!includeExpiringPlayers ? [CONTRACT_STATUSES.EXPIRING] : []),
    ...(!includeDraftPlayers ? [CONTRACT_STATUSES.DRAFT] : []),
    ...(!includeRetiredPlayers ? [CONTRACT_STATUSES.RETIRED] : []),
    ...(!includeDeletedPlayers ? [CONTRACT_STATUSES.DELETED] : []),
    ...(!includeCreatedPlayers ? [CONTRACT_STATUSES.CREATED] : []),
    ...(!includeNoneTypePlayers ? [CONTRACT_STATUSES.NONE] : []),
  ]);

  return !playerRecord.isEmpty && 
         !invalidStatuses.has(playerRecord.ContractStatus) && 
         (includeLegends || !playerRecord.IsLegend);
}


/**
 * Validates the game year of the franchise file against the valid game years for the program.
 *
 * @param {Object} franchise - Franchise Object used to get the game year of the selected Franchise File.
 * @param {number|string|Array<number|string>} validGameYears - A valid game year or an array of valid game years.
 */
function validateGameYears(franchise, validGameYears) {
  const fileGameYear = String(franchise.schema.meta.gameYear);

  // If not already an array, convert it to one
  const validGameYearsArray = Array.isArray(validGameYears) ? validGameYears : [validGameYears];
  const validGameYearsStr = validGameYearsArray.map(String);

  if (!validGameYearsStr.includes(fileGameYear)) {
    console.log(`Selected franchise file is not a Madden ${validGameYearsStr.join(', ')} Franchise File. You tried to use a Madden ${fileGameYear} Franchise File.`);
    EXIT_PROGRAM();
  }
};

/**
 * Exits the program.
 */
function EXIT_PROGRAM() {
  console.log("Enter anything to exit.");
  prompt();
  process.exit(0);
};

/**
 * Prompts the user with a message and returns a boolean based on their response.
 *
 * @param {string} message - The message to display to the user.
 * @returns {boolean} - Returns true if the user responds with YES_KWD, false if the user responds with NO_KWD.
 */
function getYesOrNo(message) {
  while (true) {
      console.log(message);
      const input = prompt().trim().toUpperCase();

      if (input === YES_KWD) {
          return true;
      } else if (input === NO_KWD) {
          return false;
      } else {
          console.log(`Invalid input. Please enter ${YES_KWD} or ${NO_KWD}.`);
      }
  }
};

/**
 * Prompts the user to choose between two valid values and returns the chosen value.
 *
 * @param {string} message - The message to display to the user.
 * @param {string} firstValue - The first valid value.
 * @param {string} secondValue - The second valid value.
 * @returns {string} - The value chosen by the user, either `firstValue` or `secondValue`.
 */
function getUserInput(message, firstValue, secondValue) {
  while (true) {
    console.log(message);
    const input = prompt().trim().toUpperCase();

    if (input === firstValue || input === secondValue) {
      return input;
    } else {
      console.log(`Invalid input. Please enter ${firstValue} or ${secondValue}.`);
    }
  }
};

/**
 * Prompts the user to choose a number within a specified range and returns the chosen number.
 *
 * @param {string} message - The message to display to the user.
 * @param {number} floor - The lower bound of the valid range (inclusive).
 * @param {number} ceiling - The upper bound of the valid range (inclusive).
 * @returns {number} - The number chosen by the user within the specified range.
 */
function getUserInputNumber(message, floor, ceiling) {
  floor = parseInt(floor);
  ceiling = parseInt(ceiling);

  while (true) {
    console.log(message);
    const input = parseInt(prompt().trim().toUpperCase());

    if (!isNaN(input) && input >= floor && input <= ceiling) {
      return input;
    } else {
      console.log(`Invalid input. Please enter a number between ${floor} and ${ceiling}.`);
    }
  }
};

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 *
 * @param {Array} array - The array to shuffle.
 * @returns {Promise<void>}
 */
async function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Generates a random integer between a specified floor and ceiling value (inclusive).
 *
 * @param {number} floor - The minimum value (inclusive) of the random number.
 * @param {number} ceiling - The maximum value (inclusive) of the random number.
 * @returns {number} - A random integer within the specified range.
 */
function getRandomNumber(floor, ceiling) {
  // Ensure that the floor and ceiling are integers
  floor = Math.floor(floor);
  ceiling = Math.floor(ceiling);

  // Generate a random number between 0 (inclusive) and 1 (exclusive)
  const randomFraction = Math.random();

  // Scale the random fraction to fit within the specified range
  const randomInRange = randomFraction * (ceiling - floor + 1) + floor;

  // Convert the result to an integer
  const result = Math.floor(randomInRange);

  return result;
}

/**
 * Converts a binary string to a decimal number.
 *
 * @param {string} binary - The binary string to convert to decimal.
 * @returns {Promise<number>} - The decimal representation of the binary string.
 */
async function bin2Dec(binary) {
  return parseInt(binary, 2);
};

/**
 * Converts a decimal number to a binary string.
 *
 * @param {number} dec - The decimal number to convert to binary.
 * @returns {string} - The binary representation of the decimal number.
 */
function dec2bin(dec) {
  return (dec >>> 0).toString(2);
};

/**
 * Checks if a string contains at least one numeric digit.
 *
 * @param {string} input - The string to check for numeric digits.
 * @returns {Promise<boolean>} - Returns true if the string contains at least one numeric digit, otherwise false.
 */
async function hasNumber(input) {
  return /\d/.test(input);
};
  


module.exports = {
    init,
    selectFranchiseFile, // FUNCTIONS
    selectFranchiseFileAsync,
    saveFranchiseFile,
    getGameYear,
    readTableRecords,
    getTablesObject,
    calculateBestOverall,
    emptyHistoryTables,
    removeFromTable,
    emptyCharacterVisualsTable,
    regenerateMarketingTables,
    emptyAcquisitionTables,
    emptyResignTable,
    recalculateRosterSizes,
    hasMultiplePlayerTables,
    fixPlayerTables,
    takeControl,
    removeControl,

    getYesOrNo, // UTILITY FUNCTIONS
    shuffleArray,
    getUserInput,
    getUserInputNumber,
    getRandomNumber,
    bin2Dec,
    dec2bin,
    hasNumber,
    isValidPlayer,
    validateGameYears,
    EXIT_PROGRAM,

    ZERO_REF, // CONST VARIABLES
    YEARS,
    BASE_FILE_INIT_KWD,
    FTC_FILE_INIT_KWD,
    YES_KWD,
    NO_KWD,
    NFL_CONFERENCES,
    OFFENSIVE_SKILL_POSITIONS,
    OLINE_POSITIONS,
    DEFENSIVE_LINE_POSITIONS,
    LINEBACKER_POSITIONS,
    DEFENSIVE_BACK_POSITIONS,
    SPECIAL_TEAM_POSITIONS,
    COACH_SKIN_TONES,
    COACH_APPAREL,
    CONTRACT_STATUSES,

    USER_CONTROL_SETTINGS, // VARIABLES FOR USER/CPU CONTROL
    CPU_CONTROL_SETTINGS,
  };