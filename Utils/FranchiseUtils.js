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
const EMPTY_STRING = "";
const BASE_FILE_INIT_KWD = 'CAREER';
const FTC_FILE_INIT_KWD = 'franchise-';
const YES_KWD = "YES";
const NO_KWD = "NO";
const FORCEQUIT_KWD = "FORCEQUIT"

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

const TABLE_NAMES = {
  PLAYER: 'Player',
  COACH: 'Coach',
  TEAM: 'Team',
  SEASON_INFO: 'SeasonInfo',
  SALARY_INFO: 'SalaryInfo',
  TEAM_ROADMAP: 'TeamRoadmap',
  COACH_TALENT_EFFECTS: 'CoachTalentEffects',
  STADIUM: 'Stadium'
}

const SEASON_STAGES = {
  PRESEASON: 'PreSeason',
  REGULAR_SEASON: 'RegularSeason',
  OFFSEASON: 'OffSeason'
}

const EXTRA_TEAM_NAMES = {
  AFC: 'AFC',
  NFC: 'NFC',
  FREE_AGENTS: 'Free Agents'
} 
const NFL_CONFERENCES = [EXTRA_TEAM_NAMES.AFC, EXTRA_TEAM_NAMES.NFC];

const OFFENSIVE_SKILL_POSITIONS = ['QB', 'HB', 'FB', 'WR', 'TE'];
const OLINE_POSITIONS = ['LT','LG','C','RG','RT'];
const DEFENSIVE_LINE_POSITIONS = ['DT','LE','RE'];
const LINEBACKER_POSITIONS = ['MLB','LOLB','ROLB'];
const DEFENSIVE_BACK_POSITIONS = ['CB','FS','SS'];
const ALL_DEFENSIVE_POSITIONS = [...DEFENSIVE_LINE_POSITIONS, ...LINEBACKER_POSITIONS, ...DEFENSIVE_BACK_POSITIONS];
const SPECIAL_TEAM_POSITIONS = ['K','P'];

const COACH_SKIN_TONES = ['SkinTone1', 'SkinTone2', 'SkinTone3', 'SkinTone4', 'SkinTone5', 'SkinTone6', 'SkinTone7'];
const COACH_APPAREL = ['Facility1', 'Facility2', 'Practice1', 'Practice2', 'Practice3', 'Staff1', 'Staff2', 'Staff3', 'Staff4'];

const BODY_MAP = {
	1: 'Thin',
	2: 'Muscular',
	3: 'Heavy' 
};

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
 * Initializes the franchise and optionally prompts for a backup.
 *
 * @param {number|string|Array<number|string>} validGameYears - A valid game year or an array of valid game years.
 * @param {Object} [options={}] - Options for initialization.
 * @param {boolean} [options.isAutoUnemptyEnabled=false] - If true, rows will always be unemptied upon editing. If you aren't sure, leave this as false.
 * @param {boolean} [options.isFtcFile=false] - Is the franchise file an FTC file?
 * @param {boolean} [options.promptForBackup=true] - Prompt the user to make a backup of their selected save file?
 * @param {boolean} [options.customYearMessage=null] - Custom message when selecting a valid year.
 * @param {boolean} [options.customFranchiseMessage=null] - Custom message when selecting a franchise file.
 * @returns {Object} - The Franchise object.
 */
function init(validGameYears, options = {}) {
  const {
    isAutoUnemptyEnabled = false,
    isFtcFile = false,
    promptForBackup = true,
    customYearMessage = null,
    customFranchiseMessage = null,
  } = options;

  const gameYear = getGameYear(validGameYears, customYearMessage);
  const franchise = selectFranchiseFile(gameYear, isAutoUnemptyEnabled, isFtcFile, customFranchiseMessage);
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
        console.error('Error saving backup file: ', error);
      }
    }
  }

  return franchise;
}

/**
 * Selects a franchise file based on the provided game year and options.
 *
 * @param {number|string} gameYear - The Madden game year of the Franchise File object.
 * @param {boolean} [isAutoUnemptyEnabled=false] - If true, rows will always be unemptied upon editing. If you aren't sure, leave this as false.
 *                                                 Keep in mind: Editing the first column of an empty row will ALWAYS unempty the row, even if this is false.
 * @param {boolean} [isFtcFile=false] - Whether the file is an FTC file. You can almost always leave this as false.
 * @returns {Object} - The selected Franchise object.
 */
function selectFranchiseFile(gameYear, isAutoUnemptyEnabled = false, isFtcFile = false, customMessage = null) {
  const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gameYear}\\saves\\`);
  const oneDriveDir = path.join(os.homedir(), `OneDrive\\Documents\\Madden NFL ${gameYear}\\saves\\`);
  const defaultPath = fs.existsSync(documentsDir) ? documentsDir : fs.existsSync(oneDriveDir) ? oneDriveDir : null;
  
  if (!defaultPath) {
    console.log(`IMPORTANT! Couldn't find the path to your Madden ${gameYear} save files. Checked: ${documentsDir}, ${oneDriveDir}`);
  }

  const filePrefix = isFtcFile ? FTC_FILE_INIT_KWD : BASE_FILE_INIT_KWD;
  let defaultMessage = `Please enter the name of your Madden ${gameYear} franchise file. Either give the full path of the file OR just give the file name (such as CAREER-BEARS) if it's in your Documents folder. Or, enter 0 to exit.`;
  if(!defaultPath)
  {
    defaultMessage = `Please enter the full path to your Madden ${gameYear} franchise file. Or, enter 0 to exit.`;
  }
  const message = customMessage || defaultMessage;

  while (true) {
    try {
      console.log(message);
      
      let fileName = prompt().trim().replace(/['"]/g, '');
      
      if (fileName === "0") {
        EXIT_PROGRAM();
      }

      // Attempt to load the franchise with the file name in uppercase first
      try {
        const upperCaseFileName = fileName.toUpperCase();
        const franchisePathUpper = upperCaseFileName.startsWith(filePrefix) ? path.join(defaultPath, upperCaseFileName) : upperCaseFileName.replace(new RegExp('/', 'g'), '\\');
        const franchise = new Franchise(franchisePathUpper, {'autoUnempty': isAutoUnemptyEnabled});
        return franchise;
      } catch (e) {
        const franchisePath = fileName.startsWith(filePrefix) ? path.join(defaultPath, fileName) : fileName.replace(new RegExp('/', 'g'), '\\');
        const franchise = new Franchise(franchisePath, {'autoUnempty': isAutoUnemptyEnabled});
        return franchise;
      }
    } catch (e) {
      console.log("Invalid franchise file name/path given. Please provide a valid name or path and try again.");
    }
  }
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
function getGameYear(validGameYears, customMessage = null) {
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
        const defaultMessage = `Select the version of Madden your franchise file uses. Valid inputs are ${validGameYears.join(', ')}. Or, enter 0 to exit.`;
        const message = customMessage !== null ? customMessage : defaultMessage;
        console.log(message);
        gameYear = prompt();

        if (gameYear === '0') {
          EXIT_PROGRAM();
        }

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
  
    clearArrayTable(historyEntryArray);
    clearArrayTable(transactionHistoryArray);

     const defaultColumns = {
      "OldTeam": ZERO_REF,
      "NewTeam": ZERO_REF,
      "SeasonYear": 0,
      "TransactionId": 0,
      "SeasonStage": "PreSeason",
      "ContractStatus": "Drafted",
      "OldContractStatus": "Drafted",
      "SeasonWeek": 0,
      "FifthYearOptionCapHit": 0,
      "ContractLength": 0,
      "ContractTotalSalary": 0,
      "CapSavingsThisYear": 0,
      "ContractBonus": 0,
      "ContractSalary": 0
    };

    emptyTable(transactionHistoryEntry, defaultColumns);
  
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


function getColumnNames(table) {
  if (table.offsetTable) {
    return table.offsetTable.map((offset) => {
      return offset.name;
    });
  } else if (table._offsetTable) {
    return table._offsetTable.map((offset) => {
      return offset.name;
    });
  } else {
    return [];
  }
}

/**
 * Empties the Character Visuals table entirely.
 *
 * @param {Object} franchise - Your Franchise object.
 * @returns {Promise<void>}
 */
async function emptyCharacterVisualsTable(franchise) {
    const tables = getTablesObject(franchise);
    const characterVisuals = franchise.getTableByUniqueId(tables.characterVisualsTable);
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const coachTable = franchise.getTableByUniqueId(tables.coachTable);
    await readTableRecords([characterVisuals,playerTable,coachTable]);

    for (const record of playerTable.records) {
      if (!record.isEmpty) {
        record.CharacterVisuals = ZERO_REF;
      }
    }

    for (const record of coachTable.records) {
      if (!record.isEmpty) {
        record.CharacterVisuals = ZERO_REF;
      }
    }

    emptyTable(characterVisuals, {"RawData": {}});
};

// Regenerates all marketing tables based on top player personalities in the file
// franchise: Your franchise object
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
      const marketedPlayersRow = bin2Dec(teamRecord.MarketedPlayers.slice(15));
      const filteredRecords = playerTable.records.filter(record => !record.isEmpty); // Filter for where the rows aren't empty
      const bestPersonalityPlayers = filteredRecords.filter(record => record.ContractStatus === CONTRACT_STATUSES.SIGNED && record.TeamIndex === teamIndex); // Filter nonempty players for where they're signed
  
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
    let filteredRecords = playerTable.records.filter(record => !record.isEmpty && record.ContractStatus === CONTRACT_STATUSES.SIGNED); // Filter for where the rows aren't empty
    
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
  
    filteredRecords = playerTable.records.filter(record => !record.isEmpty && record.ContractStatus === CONTRACT_STATUSES.SIGNED); // Filter for where the rows aren't empty
    
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

async function generateActiveAbilityPlayers(franchise) {
  const tables = getTablesObject(franchise);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await readTableRecords([teamTable,playerTable]);


  for (let i = 0; i < teamTable.header.recordCapacity; i++) {
    const record = teamTable.records[i];

    if (!record.isEmpty && record.OffenseActiveAbilitiesPlayers !== ZERO_REF) {
      const teamIndex = record.TeamIndex;
      const defenseAbilityRef = record.DefenseActiveAbilitiesPlayers;
      const offenseAbilityRef = record.OffenseActiveAbilitiesPlayers;

      const offenseTableId = bin2Dec(offenseAbilityRef.slice(0,15));
      const defenseTableId = bin2Dec(defenseAbilityRef.slice(0,15));
      
      const defenseRowNum = bin2Dec(defenseAbilityRef.slice(15));
      const offenseRowNum = bin2Dec(offenseAbilityRef.slice(15));

      const offenseTable = franchise.getTableById(offenseTableId);
      const defenseTable = franchise.getTableById(defenseTableId);

      await readTableRecords([offenseTable,defenseTable]);

      const offenseRecord = offenseTable.records[offenseRowNum];
      const defenseRecord = defenseTable.records[defenseRowNum];

      for (j = 0; j < offenseTable.header.numMembers; j++) {
        offenseRecord[`Player${j}`] = ZERO_REF;
        defenseRecord[`Player${j}`] = ZERO_REF;
      }

      const players = playerTable.records.filter(record => record.ContractStatus === 'Signed' && record.TeamIndex === teamIndex
        && record.TraitDevelopment === 'XFactor'
      );

      const offensivePlayers = players.filter(record => OFFENSIVE_SKILL_POSITIONS.includes(record.Position));
      const defensivePlayers = players.filter(record => ALL_DEFENSIVE_POSITIONS.includes(record.Position));

      // Sort and keep top 3 offensive players by OverallRating (descending)
      const topOffensivePlayers = offensivePlayers.sort((a, b) => b.OverallRating - a.OverallRating).slice(0, offenseTable.header.numMembers);

      // Sort and keep top 3 defensive players by OverallRating (descending)
      const topDefensivePlayers = defensivePlayers.sort((a, b) => b.OverallRating - a.OverallRating).slice(0, defenseTable.header.numMembers);

      // Iterate through the top offensive players using for...of with index
      for (const [i, player] of topOffensivePlayers.entries()) {
        const playerBinary = getBinaryReferenceData(playerTable.header.tableId,player.index);
        offenseRecord[`Player${i}`] = playerBinary;
      }

      // Iterate through the top defensive players using for...of with index
      for (const [i, player] of topDefensivePlayers.entries()) {
        const playerBinary = getBinaryReferenceData(playerTable.header.tableId,player.index);
        defenseRecord[`Player${i}`] = playerBinary;
      }
    }
  }
}

// Empties the acquisition array tables
async function emptyAcquisitionTables(franchise) {
    const tables = getTablesObject(franchise);
    const playerAcquisitionEvaluation = franchise.getTableByUniqueId(tables.playerAcquisitionEvaluationTable);
    const playerAcquisitionEvaluationArray = franchise.getTableByUniqueId(tables.playerAcquisitionEvaluationArrayTable);

    await readTableRecords([playerAcquisitionEvaluation, playerAcquisitionEvaluationArray]);

    const defaultColumns = {
      "Player": ZERO_REF,
      "IsPlayerSuperstar": false,
      "IsPlayerXFactor": false,
      "AddedValue": 0,
      "DevelopmentValue": 0,
      "Value": 0,
      "FreeAgentComparisonValue": 0,
      "ImportanceValue": 0,
      "TeamSchemeOverallValue": 0,
      "TeamTradePhilosophyValue": 0,
      "AcquisitionType": "Signed",
      "Rank": 0,
      "BestSchemeOverallValue": 0,
      "CoachTradeInfluenceValue": 0,
      "ContractValue": 0,
      "IsPlayerHidden": false
    };

    emptyTable(playerAcquisitionEvaluation, defaultColumns);
    clearArrayTable(playerAcquisitionEvaluationArray);
  
};
  
// This function empties the resign table/resign array table
async function emptyResignTable(franchise) {
    const tables = getTablesObject(franchise);
    const resignTable = franchise.getTableByUniqueId(tables.reSignTable);
    const resignArrayTable = franchise.getTableByUniqueId(tables.reSignArrayTable);
    await readTableRecords([resignTable,resignArrayTable]);
    
    const defaultColumns = {
      "Team": ZERO_REF,
      "Player": ZERO_REF,
      "ActiveRequestID": "-2147483648",
      "NegotiationWeek": 0,
      "TeamReSignInterest": 0,
      "ContractSalary": 0,
      "NegotiationCount": 0,
      "PlayerReSignInterest": 0,
      "ContractBonus": 0,
      "PreviousOfferedContractBonus": 0,
      "PreviousOfferedContractSalary": 0,
      "FairMarketContractBonus": 0,
      "FairMarketContractSalary": 0,
      "ActualDesiredContractBonus": 0,
      "ActualDesiredContractSalary": 0,
      "LatestOfferStage": "PreSeason",
      "ContractLength": 0,
      "FairMarketContractLength": 0,
      "PreviousOfferedContractLength": 0,
      "PreviousReSignStatus": "Invalid",
      "ReSignStatus": "NotReady",
      "LatestOfferWeek": 0,
      "PlayerPreviousReSignInterest": 0,
      "InitialContract": false,
      "NegotiationsEnded": false,
      "ActualDesiredContractLength": 0
    };

    emptyTable(resignTable, defaultColumns);
    clearArrayTable(resignArrayTable);
};

async function emptySignatureTables(franchise) {

  const tables = getTablesObject(franchise);

  const mainSignatureTable = franchise.getTableByUniqueId(tables.mainSigAbilityTable);
  const secondarySignatureTable = franchise.getTableByUniqueId(tables.secondarySigAbilityTable);
  const signatureArrayTable = franchise.getTableByUniqueId(tables.signatureArrayTable);
  await readTableRecords([mainSignatureTable,secondarySignatureTable,signatureArrayTable]);

  const defaultColumns = {
    "Player": ZERO_REF,
    "ActivationEnabled": false,
    "Active": false,
    "DeactivationEnabled": false,
    "StartActivated": false,
    "SlotIndex": 0
  };

  emptyTable(mainSignatureTable, defaultColumns);
  emptyTable(secondarySignatureTable, defaultColumns);
  clearArrayTable(signatureArrayTable);
};



/**
 * Empties all records in the input table and sets default values for specified columns.
 * You can view FranchiseUtils.emptyResignTable() for a full example of using this function
 *
 * @param {Object} table - The table object containing records to be emptied.
 * @param {Object} [defaultColumns={}] - An optional object where keys are column names and values are the default values to set.
 */
function emptyTable(table, defaultColumns = {}, rowsToIgnore = []) {
  const entries = Object.entries(defaultColumns);
  const tableColumns = getColumnNames(table);

  for (let i = 0; i < table.header.recordCapacity; i++) {
    const record = table.records[i];

    if (rowsToIgnore.includes(record.index)) continue;

    // Set default values for specified columns
    for (const [key, value] of entries) {
      if (tableColumns.includes(key)) {
        record[key] = value;
      }
    }

    // Empty the record if it's not already empty
    if (!record.isEmpty) {
      record.empty();
    }
  }
}

/**
 * Sets all valid records in the specified array table to ZERO_REF.
 * 
 * @param {Object} table - The table object containing records to be cleared.
 */
function clearArrayTable(table) {
  const tableColumns = getColumnNames(table);

  table.records.forEach(record => {
    if (!record.isEmpty) {
      tableColumns.forEach(column => {
        record[column] = ZERO_REF;
      });
    }
  });
}


/**
 * Adds a record to the targetTable by copying all values into the first empty row of the table.
 * This was created for the Franchise Transfer Tool.
 * If using this function, make SURE you set isAutoUnemptyEnabled = true
 *
 * @param {Object} record - The record to add to the targetTable. For example, this could be table.records[0].
 * @param {Object} [targetTable] - The table to add the record to.
 */
function addRecordToTable(record, targetTable, options = {}) {

  const {
    columnLookup = {},
    zeroColumns = [],
    keepColumns = [],
    ignoreColumns = [],
    useSameIndex = false,
  } = options;

  const isEmpty = record.isEmpty;
  const recordColumns = getColumnNames(record);
  const tableColumns = getColumnNames(targetTable);
  const recordIndex =  useSameIndex ? record.index : targetTable.header.nextRecordToUse;
  const targetTableRecord = targetTable.records[recordIndex];

  for (const column of recordColumns) {
    // Only update if the column is valid in the target table
    if (tableColumns.includes(column) && !ignoreColumns.includes(column) && (keepColumns.length === 0 || keepColumns.includes(column))) {
      const validColumns = columnLookup[column] || {};
      const value = record[column];
      // Check if validColumns is an object and has the value
      const finalValue = zeroColumns.includes(column) ? ZERO_REF : (validColumns && value in validColumns) ? validColumns[value] : value;
      targetTableRecord[column] = finalValue;
    }
  }

  if (isEmpty) {
    targetTableRecord.empty();
  }

  return targetTableRecord;
}

// This function will remove a binary value from an array table
// It will iterate through each row and look for the binary. If multiple rows/columns
// contain the target binary, they will all be removed.
// table: The table passed through to remove the binary from
// binaryToRemove: The binary we're removing from the table
async function removeFromTable(table, binaryToRemove) {
  const numMembers = table.header.numMembers;
  const recordCapacity = table.header.recordCapacity;

  for (let i = 0; i < recordCapacity; i++) {
      const currentRecord = table.records[i];
      
      if (currentRecord.isEmpty) continue;

      // Filter out binary to remove
      let filteredBinary = currentRecord.fieldsArray
          .map(field => field.value)
          .filter(value => value !== binaryToRemove);

      // Pad with ZERO_REF to maintain numMembers
      while (filteredBinary.length < numMembers) {
        filteredBinary.push(ZERO_REF);
      }

      // Apply the updated binaries back to the row
      filteredBinary.forEach((val, index) => {
          currentRecord.fieldsArray[index].value = val;
      });
  }
}

function addToArrayTable(table, binaryToAdd) {
  const record = table.records[0];
  const columns = getColumnNames(table);

  for (const column of columns) {
    if (record[column] === ZERO_REF) {
      record[column] = binaryToAdd;
      break;
    }
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
async function fixPlayerTables(franchise, forceFix = false) {

  if (!forceFix) {
    console.log("IMPORTANT: We've detected that this file has multiple player tables, which should not happen.");
    const message = "Would you like to attempt to merge the extra player tables into the main table? This is HEAVILY recommended.";
    const mergeTables = getYesOrNo(message);
  
    if (!mergeTables) {
      console.log("Continuing program without merging player tables.");
      return;
    }
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
    
    const columnHeaders = getColumnNames(currentTable) //Get the headers from the table
    for (let j = 0;j < columnHeaders.length;j++) {
      let currentCol = columnHeaders[j];
      mainPlayerTable.records[nextPlayerRecord][currentCol] = currentTable.records[0][currentCol];
    }

    for (const table of referencedRow) {
      const currentTableId = table.tableId;
      const currentRelatedTable = franchise.getTableById(currentTableId);
      await currentRelatedTable.readRecords();

      const currentRelatedHeaders = getColumnNames(currentRelatedTable) //Get the headers from the table


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
  const coachOwnerTableId = bin2Dec(userBinary.slice(0,15));

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

async function removePlayerVisuals(franchise,playerRecord) {
  const visualsBinary = playerRecord.CharacterVisuals;
  if (visualsBinary !== ZERO_REF && !visualsBinary.startsWith('1')) {
    const characterVisualsRow = bin2Dec(visualsBinary.slice(15));
    // Dynamically get the table ID for CharacterVisuals
    // This is required because if there's too many players/coaches, the game generates more Visuals tables
    // So instead of always calling the main one, we instead dynamically get the table ID through the binary.
    const characterVisualsTableId = bin2Dec(visualsBinary.slice(0,15));
    const characterVisualsTable = franchise.getTableById(characterVisualsTableId);
    await readTableRecords([characterVisualsTable]);

    // Then, get the record for the player and empty it
    const visualsRecord = characterVisualsTable.records[characterVisualsRow];
    //visualsRecord.RawData = {};
    visualsRecord.empty();

    playerRecord.CharacterVisuals = ZERO_REF;
  }
}

async function deletePlayer(franchise, playerBinary) {
  const gameYear = franchise.schema.meta.gameYear;
  
  const tables = getTablesObject(franchise);
  const playerData = getRowAndTableIdFromRef(playerBinary);

  const playerTable = franchise.getTableById(playerData.tableId);
  await playerTable.readRecords();

  const playerRecord = playerTable.records[playerData.row];
  await removePlayerVisuals(franchise,playerRecord);
  
  playerRecord.CareerStats = ZERO_REF;
  playerRecord.SeasonStats = ZERO_REF;
  playerRecord.GameStats = ZERO_REF;
  playerRecord.MorphHead = ZERO_REF;
  playerRecord.WeeklyGoals = ZERO_REF;
  playerRecord.College = ZERO_REF;
  playerRecord.SeasonalGoal = ZERO_REF;
  playerRecord.PLYR_ASSETNAME = EMPTY_STRING;
  playerRecord.ContractStatus = CONTRACT_STATUSES.DELETED;


  const tableIds = [ // Tables to remove player binary from
    tables.freeAgentTable, // Free agent array
    tables.rosterTable, // Roster array
    tables.depthChartPlayerTable, // Depth chart array
    tables.practiceSquadTable, // Practice squad array
    tables.draftedPlayersArrayTable, // Drafted players array
    tables.marketedPlayersArrayTable, // Marketed players array
    tables.topMarketedPlayers, // Top marketed players array
    tables.drillCompletedTable // Drill completed array
  ];

  if (gameYear >= YEARS.M25) {
    tableIds.push(
      tables.offenseActiveAbilityArrayTable, // Active abilities tables
      tables.defenseActiveAbilityArrayTable,
      tables.miniGameCompletedArrayTable, // Minicamp tables
      tables.focusTrainingTable, // Focus training tables
      tables.proBowlRosterTable // Pro bowl roster
    );
  }
  else if (gameYear === YEARS.M24) {
    tableIds.push(
      tables.afcRosterTable,
      tables.nfcRosterTable,
      tables.activeAbilityArrayTable
    )

    await clearPlayerRefFromTableByUniqueId(franchise,playerBinary, tables.poseTable,false,{});


  }

  const specialTables = {
    [tables.reSignTable]: tables.reSignArrayTable, // Resign records
    [tables.rookieStatTrackerTable]: tables.rookieStatTrackerArray, // Rookie tracking
    [tables.mainSigAbilityTable]: tables.signatureArrayTable, // Player abilities
    [tables.secondarySigAbilityTable]: tables.signatureArrayTable,
    [tables.playerAcquisitionEvaluationTable]: tables.playerAcquisitionEvaluationArrayTable, // Acquisition table
    [tables.retirementAppointmentTable]: tables.retirementAppointmentArrayTable // Retirement table
  };

  //playerMerchTable

  // Read all tables
  const tableArray = tableIds.map(id => franchise.getTableByUniqueId(id));
  await Promise.all(tableArray.map(table => table.readRecords()));

  // Remove player binary from each table
  await Promise.all(tableArray.map(table => removeFromTable(table, playerBinary)));

  for (const key in specialTables) {
    if (specialTables.hasOwnProperty(key)) {
      const keyTable = franchise.getTableByUniqueId(Number(key));
      const arrayTable = franchise.getTableByUniqueId(Number(specialTables[key]));

      try { // If we can't read the tables, they may dynamically generate and not exist at this time
        await readTableRecords([keyTable,arrayTable]);
      } catch (e) {
        continue;
      }

      const recordsToEmpty = keyTable.records.filter(record => record.Player === playerBinary);

      for (const record of recordsToEmpty) {
        record.Player = ZERO_REF;
        const binary = getBinaryReferenceData(keyTable.header.tableId,record.index);
        await removeFromTable(arrayTable,binary);
        record.empty();
      }

    }
  }

  await clearPlayerRefFromTableByName(franchise, playerBinary, "PlayerStatRecord", false, {});
  await clearPlayerRefFromTableByUniqueId(franchise,playerBinary, tables.transactionHistoryEntry,true,{"OldTeam": ZERO_REF,"NewTeam": ZERO_REF});
  await clearPlayerRefFromTableByUniqueId(franchise,playerBinary, tables.playerEditTransactionHistoryTable,true,{"OldTeam": ZERO_REF,"NewTeam": ZERO_REF});
  await clearPlayerRefFromTableByUniqueId(franchise,playerBinary, tables.playerPositionChangeHistoryTable,true,{"OldTeam": ZERO_REF,"NewTeam": ZERO_REF});

  // Finally, empty the record
  playerRecord.empty();

  // Debugging
  //console.log(`Index ${playerData.row}`);
  //referencedRow = franchise.getReferencesToRecord(playerData.tableId,playerData.row)
  
  //referencedRow.forEach((table) => {
  //  console.log(`${table.tableId}: ${table.name}: ${playerData.row}`)
  //})

}

async function clearPlayerRefFromTableByName(franchise, playerBinary, tableName, emptyRecord = true, defaultColumns = {}) {
  const tables = franchise.getAllTablesByName(tableName); 
  const entries = Object.entries(defaultColumns);

  for (const table of tables) {
    await table.readRecords();
    const tableColumns = getColumnNames(table);

    const playerRefCol = tableColumns.includes("Player") ? "Player" :
    tableColumns.includes("playerRef") ? "playerRef" :
    tableColumns.includes("PosedPlayer") ? "PosedPlayer" :
    null;
    
    if (!playerRefCol) continue;

    const records = table.records.filter(record => record[playerRefCol] === playerBinary && !record.isEmpty);

    for (const record of records) {
      for (const [key, value] of entries) {
        if (tableColumns.includes(key)) {
          record[key] = value;
        }
      }
      record[playerRefCol] = ZERO_REF;
      if (emptyRecord) record.empty();
    }
  }
}

async function clearPlayerRefFromTableByUniqueId(franchise, playerBinary, tableId, emptyRecord = true, defaultColumns = {}) {
  const table = franchise.getTableByUniqueId(tableId);
  await table.readRecords();
  const tableColumns = getColumnNames(table);
  const entries = Object.entries(defaultColumns);

  const playerRefCol = tableColumns.includes("Player") ? "Player" :
   tableColumns.includes("playerRef") ? "playerRef" :
   tableColumns.includes("PosedPlayer") ? "PosedPlayer" :
   null;

  if (!playerRefCol) return;

  const records = table.records.filter(record => record[playerRefCol] === playerBinary && !record.isEmpty);

  for (const record of records) {
    for (const [key, value] of entries) {
      if (tableColumns.includes(key)) {
        record[key] = value;
      }
    }
    record[playerRefCol] = ZERO_REF;
    if (emptyRecord) record.empty();
  }
}

async function deleteExcessFreeAgents(franchise, options = {}) {

  const {
    numPlayersToDelete = null,
    includeDraftPlayers = true
  } = options;

  const tables = getTablesObject(franchise);

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const freeAgentsTable = franchise.getTableByUniqueId(tables.freeAgentTable);
  const drillCompletedTable = franchise.getTableByUniqueId(tables.drillCompletedTable);

  await readTableRecords([playerTable,freeAgentsTable,drillCompletedTable]);

  const activePlayerRecords = playerTable.records.filter(record => 
    !record.isEmpty && 
    isValidPlayer(record, {
      includeDraftPlayers: includeDraftPlayers,
      includeFreeAgents: true,
      includePracticeSquad: true,
      includeSignedPlayers: true,
      includeExpiringPlayers: true,
      includeDeletedPlayers: false,
      includeCreatedPlayers: false,
      includeLegends: false,
      includeNoneTypePlayers: false
    })
  );
  
  const freeAgentRecords = activePlayerRecords.filter(record => record.ContractStatus === CONTRACT_STATUSES.FREE_AGENT) // Filter active players for where they're free agents

  let allFreeAgentsBinary = [];
  const worstFreeAgentsBinary = [];

  const numTotalPlayersDesired = freeAgentsTable.header.numMembers; //Max amount of free agents (this is relevant for a fantasy draft)
  const totalNumCurrentPlayers = activePlayerRecords.length; //Get the current number of players

  freeAgentRecords.forEach((freeAgentRecord) => {
    const rowIndex = playerTable.records.indexOf(freeAgentRecord);
    const currentBinary = getBinaryReferenceData(playerTable.header.tableId,rowIndex);
    allFreeAgentsBinary.push(currentBinary);
  });
  

  if (totalNumCurrentPlayers > numTotalPlayersDesired) { // If we're above 3500 total players...
    const numExtraPlayers = totalNumCurrentPlayers - numTotalPlayersDesired; // Calculate excess players

    // Determine the number of players to delete
    const playersToDelete = (numPlayersToDelete != null && 
                             Number.isInteger(numPlayersToDelete) && 
                             numPlayersToDelete > 0) 
                             ? numPlayersToDelete 
                             : Math.max(numExtraPlayers, 0); // Ensure non-negative value
    
    // Sort the free agents by OverallRating and slice the array safely
    const worstFreeAgents = freeAgentRecords
      .sort((a, b) => a.OverallRating - b.OverallRating)
      .slice(0, Math.min(playersToDelete, freeAgentRecords.length)); // Ensure we don't exceed the array length

    for (const freeAgentRecord of worstFreeAgents) {
      const currentBinary = getBinaryReferenceData(playerTable.header.tableId, freeAgentRecord.index);
      worstFreeAgentsBinary.push(currentBinary);
      await deletePlayer(franchise,currentBinary);
    }

    //Filter for where we aren't including the worstFreeAgentBin
    allFreeAgentsBinary = allFreeAgentsBinary.filter((bin) => !worstFreeAgentsBinary.includes(bin));
  
    while (allFreeAgentsBinary.length < numTotalPlayersDesired) { //Fill up the remainder with zeroed out binary
      allFreeAgentsBinary.push(ZERO_REF)
    }

    //One liner to set the FA table binary = our free agent binary
    allFreeAgentsBinary.forEach((val, index) => { freeAgentsTable.records[0].fieldsArray[index].value = val; })
  }
};

async function reorderTeams(franchise) {

  const tables = getTablesObject(franchise);
  const leagueTable = franchise.getTableByUniqueId(tables.leagueTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await readTableRecords([leagueTable,teamTable]);

  const sortedTeamsBinary = leagueTable.records[0].SortedTeams;

  const tableId = bin2Dec(sortedTeamsBinary.slice(0,15));  
  const rowNum = bin2Dec(sortedTeamsBinary.slice(15));

  const sortedTeamTable = franchise.getTableById(tableId);
  await sortedTeamTable.readRecords();

  // Get binary data for all non-empty rows in the teamTable, sorted by DisplayName
  const allRowBinaryData = teamTable.records
    .map((record, index) => ({ record, index })) // Create an array of objects with record and its index
    .filter(({ record }) => !record.isEmpty && !NFL_CONFERENCES.includes(record.DisplayName) && record.TEAM_VISIBLE ) // Filter out empty records
    .sort(({ record: a }, { record: b }) => { // Sort by DisplayName
      const displayNameA = a.DisplayName === '49ers' ? 'FortyNiners' : a.DisplayName;
      const displayNameB = b.DisplayName === '49ers' ? 'FortyNiners' : b.DisplayName;
      return displayNameA.localeCompare(displayNameB);
    })
    .map(({ record, index }) => getBinaryReferenceData(teamTable.header.tableId, index)); // Get the binary


  const record = sortedTeamTable.records[rowNum];

  // One-liner to set the record's fieldsArray values to allRowBinaryData
  allRowBinaryData.forEach((val, index) => { record.fieldsArray[index].value = val; });

}

// Function to approximate the body type based on the visuals JSON
function approximateBodyType(visualsObject) {
    // Find the morph loadout for the 'Base' category
    const morphLoadout = visualsObject.loadouts.find(loadout =>
        loadout.loadoutCategory === 'Base'
    );

    if (!morphLoadout || !morphLoadout.loadoutElements) {
        return 'Thin';
    }

    // Find the 'Gut' morph element
    const gutMorph = morphLoadout.loadoutElements.find(element =>
        element.slotType === 'Gut'
    );

    if (!gutMorph || !gutMorph.blends || gutMorph.blends.length === 0) {
        return 'Thin';
    }

    // Extract blend values
    const { baseBlend: gutBase, barycentricBlend: gutBarycentric } = gutMorph.blends[0];

    // Return the body type based on blend values
    if (gutBase <= 0.5) return 'Standard';
    if (gutBarycentric < 0.5) return 'Thin';
    if (gutBarycentric < 1.35) return 'Muscular';
    if (gutBarycentric < 2.70) return 'Heavy';
    if (gutBarycentric < 2.90) return 'Muscular';

    return 'Thin';
}

function getRowAndTableIdFromRef(binary) {
  const row = bin2Dec(binary.slice(15));
  const tableId = bin2Dec(binary.slice(0,15));

  return { row, tableId };
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
};

function isReferenceColumn(record, column, includeZeroRef = false, includeFtcRefs = false) {
  const field = record.fields[column];
  const currentValue = record[column];

  // Check if the field is a reference
  if (!field.isReference) return false;

  // Check if we should skip the ZERO_REF check
  if (!includeZeroRef && currentValue === ZERO_REF) return false;

  // Check if we should skip the FTC references check (those starting with '1')
  if (!includeFtcRefs && currentValue.startsWith('1')) return false;

  // If none of the conditions failed, return true
  return true;
};

function isFtcReference(record,column) {
  const field = record.fields[column];
  const currentValue = record[column];

  return field.isReference && currentValue.startsWith('1');
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
  process.exit(1);
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

function getYesNoForceQuit(message) {
  while (true) {
      console.log(message);
      const input = prompt().trim().toUpperCase();

      if (input === YES_KWD) {
          return YES_KWD;
      } else if (input === NO_KWD) {
          return NO_KWD;
      } else if (input === FORCEQUIT_KWD) {
        return FORCEQUIT_KWD;
      } else {
          console.log(`Invalid input. Please enter ${YES_KWD}, ${NO_KWD}, or ${FORCEQUIT_KWD} .`);
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

function removeKeyFromJson(jsonData, key) {
  if (jsonData.hasOwnProperty(key)) {
      delete jsonData[key];
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
function bin2Dec(binary) {
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
function hasNumber(input) {
  return /\d/.test(input);
};

function containsNonUTF8(value) {
  if (Buffer.isBuffer(value)) {
    for (const byte of value) {
      if (byte === 0 || (byte >= 0x80 && byte <= 0xbf)) {
        return true; // Value contains non-UTF-8 byte
      }
    }
    return false; // Value is valid UTF-8
  } else {
    return false; // Not a Buffer, so not applicable
  }
};

function removeNonUTF8(value) {
  // Normalize the string and remove diacritics (accents)
  let normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Remove all non-ASCII characters
  return normalized.replace(/[^\x00-\x7F]/g, '');
}

/**
 * Finds the key associated with a given value in an object.
 * 
 * @param {Object} obj - The object to search through.
 * @param {*} value - The value to find the associated key for.
 * @returns {string|null} - The key associated with the value, or null if not found.
 */
function findKeyByValue(obj, value) {
  for (const [key, val] of Object.entries(obj)) {
    if (val === value) {
      return key;
    }
  }
  return null;  // Return null if the value is not found
}

/**
 * Removes common suffixes (e.g., Jr., Sr., II, III, IV, V) from a name string.
 *
 * @param {string} name - The name string from which to remove suffixes.
 * @returns {string} - The name string without the suffix.
 */
function removeSuffixes(name) {
  // Remove periods from any part of the name
  let cleanName = name.replace(/\./g, '');

  // Remove common suffixes
  return cleanName.replace(/\s+(Jr|Sr|III|II|IV|V)$/g, '');
}
  


module.exports = {
    init,
    selectFranchiseFile, // FUNCTIONS
    selectFranchiseFileAsync,
    saveFranchiseFile,
    getGameYear,
    readTableRecords,
    getTablesObject,
    getColumnNames,
    calculateBestOverall,
    emptyHistoryTables,
    removeFromTable,
    addToArrayTable,
    emptyCharacterVisualsTable,
    regenerateMarketingTables,
    generateActiveAbilityPlayers,
    emptyAcquisitionTables,
    emptyResignTable,
    emptySignatureTables,
    emptyTable,
    clearArrayTable,
    addRecordToTable,
    recalculateRosterSizes,
    hasMultiplePlayerTables,
    fixPlayerTables,
    takeControl,
    removeControl,
    deleteExcessFreeAgents,
    deletePlayer,
    clearPlayerRefFromTableByName,
    clearPlayerRefFromTableByUniqueId,
    reorderTeams,
    removePlayerVisuals,
    approximateBodyType,
    getRowAndTableIdFromRef,

    getYesOrNo, // UTILITY FUNCTIONS
    getYesNoForceQuit,
    shuffleArray,
    removeKeyFromJson,
    getUserInput,
    getUserInputNumber,
    getRandomNumber,
    bin2Dec,
    dec2bin,
    hasNumber,
    removeNonUTF8,
    containsNonUTF8,
    findKeyByValue,
    removeSuffixes,
    isValidPlayer,
    isReferenceColumn,
    isFtcReference,
    validateGameYears,
    EXIT_PROGRAM,

    ZERO_REF, // CONST VARIABLES
    EMPTY_STRING,
    YEARS,
    BASE_FILE_INIT_KWD,
    FTC_FILE_INIT_KWD,
    YES_KWD,
    NO_KWD,
    FORCEQUIT_KWD,
    EXTRA_TEAM_NAMES,
    NFL_CONFERENCES,
    OFFENSIVE_SKILL_POSITIONS,
    OLINE_POSITIONS,
    DEFENSIVE_LINE_POSITIONS,
    LINEBACKER_POSITIONS,
    DEFENSIVE_BACK_POSITIONS,
    ALL_DEFENSIVE_POSITIONS,
    SPECIAL_TEAM_POSITIONS,
    COACH_SKIN_TONES,
    COACH_APPAREL,
    CONTRACT_STATUSES,
    TABLE_NAMES,
    SEASON_STAGES,

    USER_CONTROL_SETTINGS, // VARIABLES FOR USER/CPU CONTROL
    CPU_CONTROL_SETTINGS,
  };