const FranchiseUtils = require('../Utils/FranchiseUtils');
const xlsx = require("xlsx");
const fs = require("fs");
const prompt = require('prompt-sync')();
const STRING_SIMILARITY = require('string-similarity');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const SEASON_STATS = xlsx.readFile("./players.xlsx");
const CAREER_STATS = xlsx.readFile("./players-career.xlsx");
const OUTPUT_FILE = "asset_lookup_test.json";
const LOOKUP_FILE = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
const COLLEGES = require('../Utils/JsonLookups/25/colleges.json');
const axios = require('axios');
const cheerio = require('cheerio');
const YEAR = 2011//new Date();

const DEFAULT_COLUMNS = [
    "BLITZ_YARDS", "DEEPPASS_YARDS", "DEFDEEPPASS_YARDS", 
    "DEFINSIDERUN_YARDS", "DEFMEDIUMPASS_YARDS", "DEFOUTSIDERUN_YARDS", 
    "DEFSHORTPASS_YARDS", "DLINEFUMBLERECOVERYYARDS", "DSECINTLONGESTRETURN", 
    "DSECINTRETURNYARDS", "INSIDERUN_YARDS", "INSIDEPOCKETTHROW_YARDS", 
    "KRETLONGEST", "KRETYARDS", "MEDIUMPASS_YARDS", "OUTSIDEPOCKETTHROW_YARDS", 
    "OUTSIDERUN_YARDS", "PASSLONGEST", "PASSYARDS", "PRETLONGEST", 
    "PRETYARDS", "PUNTLONGEST", "PUNTNETYARDS", "PUNTYARDS", 
    "QBSCRAMBLE_YARDS", "RECEIVELONGEST", "RECEIVEYARDS", 
    "RECEIVEYARDSAFTER", "RUSHLONGEST", "RUSHYARDS", 
    "RUSHYARDSAFTER1STHIT", "SHORTPASS_YARDS"
];

function getAge(age) {
    const value = age.toString();
    if (value.includes('-')) {
      const [, afterDash] = value.split('-');
      return parseInt(afterDash, 10);
    }
    return parseInt(value, 10);
  }

const TEAM_MAPPING = {
    "SFO": 14, "CHI": 0, "CIN": 1, "BUF": 2, "DEN": 3, "CLE": 4, "TAM": 5, "ARI": 6,
    "LAC": 7, "SDG": 7, "KAN": 8, "IND": 9, "DAL": 10, "MIA": 11, "PHI": 12, "ATL": 13,
    "WAS": 25, "NYG": 15, "JAX": 16, "NYJ": 17, "DET": 18, "GNB": 19, "CAR": 20,
    "NWE": 21, "LVR": 22, "OAK": 22, "LAR": 23, "STL": 23, "BAL": 24, "NOR": 26, "SEA": 27, "PIT": 28,
    "HOU": 31, "TEN": 29, "MIN": 30, "Free Agent": 32
}


const validGameYears = [
  FranchiseUtils.YEARS.M25,
];


console.log("This program will recalculate all player season/career stats based on an input file you provide.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: true, isAutoUnemptyEnabled: true});
const tables = FranchiseUtils.getTablesObject(franchise);

function getPlayers(lookupFile) {
    // Get all sheet names
    const sheetNames = lookupFile.SheetNames;

    // Initialize an empty array to store the player data
    const players = [];

    // Helper object to track data by PLAYERLINK for merging
    const playerDataMap = {};

    // Iterate through each sheet
    sheetNames.forEach((sheetName) => {
        const sheet = lookupFile.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Process each row of the sheet
        data.forEach((row) => {
            const playerLink = row["PLAYERLINK"];
            if (!playerLink) return; // Skip rows without a PLAYERLINK

            // If the player doesn't exist in the map, initialize a new object
            if (!playerDataMap[playerLink]) {
                playerDataMap[playerLink] = { PLAYERLINK: playerLink };
            }

            // Merge data from this row into the player object
            for (const [key, value] of Object.entries(row)) {
                if (key !== "PLAYERLINK") {
                    playerDataMap[playerLink][key] = value;
                }
            }
        });
    });

    // Convert the playerDataMap into a list of objects
    for (const playerLink in playerDataMap) {
        players.push(playerDataMap[playerLink]);
    }

    return players;
}


async function getTeamIndices(csvTeams) {
    const teamIndices = [];
    const teamNames = csvTeams.split(',');

    for (const name of teamNames) {
        if (name in TEAM_MAPPING) {
            teamIndices.push(TEAM_MAPPING[name]);
        }
    }
    return teamIndices;
}

function getStatsTableName(position, playerStats, isCareer) {
    const prefix = isCareer ? "Career" : "Season";
    const hasKPReturns = "KRETATTEMPTS" in playerStats && playerStats["KRETATTEMPTS"] > 0;

    let suffix;
    if (FranchiseUtils.OFFENSIVE_SKILL_POSITIONS.includes(position)) {
        suffix = hasKPReturns ? "OffensiveKPReturnStats" : "OffensiveStats";
    } else if (FranchiseUtils.ALL_DEFENSIVE_POSITIONS.includes(position)) {
        suffix = hasKPReturns ? "DefensiveKPReturnStats" : "DefensiveStats";
    } else if (FranchiseUtils.SPECIAL_TEAM_POSITIONS.includes(position)) {
        suffix = "KickingStats";
    } else {
        throw new Error(`Unknown position: ${position}`);
    }

    return `${prefix}${suffix}`;
}

function getTeamShortName(teamTable, teamIndex) {

    if (teamIndex === 32) return FranchiseUtils.EMPTY_STRING;

    const record = teamTable.records.find(record =>
        !record.isEmpty && !FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName)
        && record.TeamIndex === teamIndex)
    if (record) return record.ShortName;

    return FranchiseUtils.EMPTY_STRING;
        
}

// Function to process players in batches with a delay between batches
async function processPlayersInBatches(players, isCareer, batchSize = 5) {
    // Step 1: Filter out players whose PLAYERLINK is already in the lookup file
    const playersToProcess = players.filter(player => !(player.PLAYERLINK in LOOKUP_FILE) && parseInt(player.MAXYEAR, 10) >= 2000);
    
    // Step 2: Process players in batches
    for (let i = 0; i < playersToProcess.length; i += batchSize) {
        //console.log(`Processing batch starting at index ${i}`);
        const batch = playersToProcess.slice(i, i + batchSize);

        // Fetch asset names for the current batch in parallel
        await Promise.all(batch.map(player => getOrCreateAssetName(player.PLAYERLINK, player, isCareer)));

        // Add delay between batches (in seconds)
        if (i + batchSize < playersToProcess.length) {
            //console.log(`Waiting for ${delayBetweenBatches} seconds before processing the next batch...`);
            //await fixedDelay(delayBetweenBatches);  // Wait for the specified delay before processing the next batch
        }
    }
}


async function updateStats(franchise, isCareer) {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
    await FranchiseUtils.readTableRecords([playerTable, teamTable, seasonInfoTable]);
    const lookup = isCareer ? CAREER_STATS : SEASON_STATS;
    const players = getPlayers(lookup);
    const statColumn = isCareer ? "CareerStats" : "SeasonStats";
    const currentYear = seasonInfoTable.records[0].CurrentYear;

    // Process players in batches with delay
    //await processPlayersInBatches(players, isCareer, 400);

    const playersInLookupFile = players.filter(player => {
        const link = String(player.PLAYERLINK); // Ensure consistent type
        return link in LOOKUP_FILE && LOOKUP_FILE[link] !== '';
    });

    for (const player of playersInLookupFile) {
        const assetName = LOOKUP_FILE[player.PLAYERLINK];  // Assuming asset names are stored in the lookup file
        console.log(assetName)

        const playerRecord = getPlayerRecord(playerTable, assetName);

        // We don't update stats for O-Line
        if (!playerRecord || FranchiseUtils.OLINE_POSITIONS.includes(playerRecord.Position)) continue;

        let newRecord = await ensureStatColumn(playerRecord, statColumn, franchise, player, isCareer);

        const statsRef = playerRecord[statColumn];
        const { row, tableId } = FranchiseUtils.getRowAndTableIdFromRef(statsRef);
        const statsTable = franchise.getTableById(tableId);
        await statsTable.readRecords();
        const statsRecord = statsTable.records[row];

        const { record: finalRecord, newStatRecord } = isCareer
            ? { record: statsRecord, newStatRecord: newRecord } // For career stats, use statsRecord directly
            : await getOrCreateSeasonRecord(statsRecord, player, playerRecord, currentYear, franchise);

        if (!finalRecord) {
            console.log(playerRecord.PLYR_ASSETNAME);
            continue;
        }

        const finalColumns = FranchiseUtils.getColumnNames(finalRecord);

        if (newStatRecord) {
            for (const column of DEFAULT_COLUMNS) {
                if (finalColumns.includes(column)) {
                    finalRecord[column] = 0;
                }
            }
        }
        if (!isCareer) {
            finalRecord.SEAS_YEAR = currentYear;
            finalRecord.YEARBYYEARTEAMINDEX = playerRecord.TeamIndex;
            finalRecord.TeamPrefixName = getTeamShortName(teamTable, playerRecord.TeamIndex);
        }

        // Update final record with player data
        for (const column in player) {
            if (!finalColumns.includes(column)) continue;
            if (column === "DLINESACKS") {
                const { integer, hasDecimal } = FranchiseUtils.splitDecimal(player[column]);
                finalRecord.DLINESACKS = integer;
                finalRecord.DLINEHALFSACK = hasDecimal ? 1 : 0;
            } else {
                finalRecord[column] = player[column];
            }
        }
    }
}

function getPlayerRecord(playerTable, assetName) {
    return playerTable.records.find(record =>
        FranchiseUtils.isValidPlayer(record) && record.PLYR_ASSETNAME === assetName
    );
}

async function getOrCreateAssetName(link, player, isCareer) {
    if (!(link in LOOKUP_FILE)) {
        const teamIndices = await getTeamIndices(player.TEAM);
        //if (teamIndices.length === 0) console.log(player.PLAYERNAME);

        const assetName = await checkPlayerTable(player, teamIndices, isCareer);
        LOOKUP_FILE[link] = assetName === -1 ? '' : assetName;
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(LOOKUP_FILE, null, 2));
    }
    return LOOKUP_FILE[link];
}

async function ensureStatColumn(playerRecord, statColumn, franchise, player, isCareer) {
    // Check if the stat column is already present
    if (playerRecord[statColumn] !== FranchiseUtils.ZERO_REF) {
        return false; // No new stat record created
    }

    if (isCareer) {
        const tableName = getStatsTableName(playerRecord.Position, player, isCareer);
        const table = franchise.getTableByName(tableName);
        await table.readRecords();

        const binary = getBinaryReferenceData(table.header.tableId, table.header.nextRecordToUse);
        playerRecord[statColumn] = binary;
    } else {
        const seasonStatsArray = franchise.getTableByUniqueId(tables.seasonStatsTable);
        await seasonStatsArray.readRecords();

        const record = seasonStatsArray.records[seasonStatsArray.header.nextRecordToUse];
        for (const column of FranchiseUtils.getColumnNames(record)) {
            record[column] = FranchiseUtils.ZERO_REF;
        }

        const binary = getBinaryReferenceData(seasonStatsArray.header.tableId, record.index);
        playerRecord[statColumn] = binary;
    }

    return true; // A new stat record was created
}

async function getOrCreateSeasonRecord(statsRecord, player, playerRecord, currentYear, franchise, isCareer) {
    const columnNames = FranchiseUtils.getColumnNames(statsRecord);

    // Try to find an existing record
    for (const column of columnNames) {
        if (FranchiseUtils.isReferenceColumn(statsRecord, column)) {
            const { row, tableId } = FranchiseUtils.getRowAndTableIdFromRef(statsRecord[column]);
            const tempTable = franchise.getTableById(tableId);
            await tempTable.readRecords();

            const tempRecord = tempTable.records[row];
            if (tempRecord.SEAS_YEAR === currentYear) {
                return { record: tempRecord, newStatRecord: false };
            }
        }
    }

    // Create a new record if none exists
    for (const column of columnNames) {
        if (statsRecord[column] === FranchiseUtils.ZERO_REF) {
            const tableName = getStatsTableName(playerRecord.Position, player, false);
            const table = franchise.getTableByName(tableName);
            await table.readRecords();

            const record = table.records[table.header.nextRecordToUse];
            const binary = getBinaryReferenceData(table.header.tableId, record.index);
            statsRecord[column] = binary;
            return { record, newStatRecord: true };
        }
    }

    // No record found or created
    return { record: null, newStatRecord: false };
}

async function checkPlayerTable(pfrPlayer, teamIndices, isCareer) {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    const maxPlayerYear = parseInt(pfrPlayer.MAXYEAR,10);

    if (maxPlayerYear < 2000) return -1;
    const pfrAge = getAge(pfrPlayer.AGE);
    const finalSeason = maxPlayerYear > YEAR ? maxPlayerYear - (maxPlayerYear - YEAR) : maxPlayerYear;
    const finalPfrAge = pfrAge ? YEAR - finalSeason + pfrAge : pfrAge;
    const finalPfrName = FranchiseUtils.removeSuffixes(pfrPlayer.PLAYERNAME);
    const pfrObject = {pfrPlayer, finalPfrName, finalSeason, finalPfrAge};
    // Build a map of TeamIndex to team records for quick lookup
    const teamIndexMap = new Map();
    for (const record of teamTable.records) {
        if (!record.isEmpty) {
            teamIndexMap.set(record.TeamIndex, record);
        }
    }

    const allValidPlayers = [];

    // Iterate through the player table
    for (const record of playerTable.records) {
        if (!FranchiseUtils.isValidPlayer(record)) continue;
        const fullName = `${record.FirstName} ${record.LastName}`;

        // Retrieve the teamRecord using the TeamIndex, if applicable
        const teamRecord = record.TeamIndex !== 32 ? teamIndexMap.get(record.TeamIndex) : null;

        // Add player to the valid players array
        allValidPlayers.push({ playerRecord: record, name: fullName, teamRecord: teamRecord });
    }

    // Array of player row numbers the user skips
    const skippedPlayers = [];

    let result = -1;
    let colleges = [];

    // Check valid players with a high match value first
    let matchValue = 0.95;
    const highMatches = getPlayersToCheck(allValidPlayers, pfrObject.finalPfrName, matchValue);

    if (highMatches.length === 0) {
        //colleges = await getPfrPlayerInfo(pfrPlayer.PLAYERLINK);
        result = await checkValidPlayers(highMatches, skippedPlayers, teamIndices, pfrObject, isCareer, colleges);

        if (result !== -1) {
            return playerTable.records[result].PLYR_ASSETNAME;
        }

    }

    // If no valid result, retry with a lower match value
    matchValue = 0.80;
    const lowMatches = getPlayersToCheck(allValidPlayers, pfrObject.finalPfrName, matchValue);
    if (lowMatches.length > 0) {
        //if (colleges.length === 0) colleges = await getPfrPlayerInfo(pfrPlayer.PLAYERLINK);
        result = await checkValidPlayers(lowMatches, skippedPlayers, teamIndices, pfrObject, isCareer, colleges);
    }

    return result !== -1 ? playerTable.records[result].PLYR_ASSETNAME : -1;
}

function getPlayersToCheck(allValidPlayers, finalPfrName, matchValue) {
    
    // Preprocess finalPfrName
      const cleanedPfrName = FranchiseUtils.removeSuffixes(finalPfrName.toLowerCase());
  
      // Preprocess all player names outside the loop
      const playersWithMatchValues = allValidPlayers
      .map(player => {
          const cleanedPlayerName = FranchiseUtils.removeSuffixes(player.name.toLowerCase());
          const match = STRING_SIMILARITY.compareTwoStrings(cleanedPfrName, cleanedPlayerName);
          return { player, match };
      })
      .filter(({ match }) => match >= matchValue) // Filter by match value
      .map(({ player, match }) => ({ ...player, matches: match })); // Add match value to player
  
  
    
    playersWithMatchValues.sort((a, b) => b.matches - a.matches);

    return playersWithMatchValues;
}

function getCollege(college) {
   const assetId = FranchiseUtils.bin2Dec(college);
 
   try {
       return COLLEGES.find(college => college.AssetId === assetId).Name;
   } catch(err) {
     console.log(err);
     return null;
   }
 }


// Random delay function
const randomDelay = (min = 1000, max = 5000) => {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
};

// Fixed delay function (for Retry-After header)
const fixedDelay = (seconds) => {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000)); // Convert seconds to milliseconds
};

// Create a custom axios instance for pro-football-reference.com
const axiosInstance = axios.create({
    baseURL: 'https://www.pro-football-reference.com', // Correct the base URL
    headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 10000,
});

// Function to retrieve player info with rate limiting and retry logic
async function getPfrPlayerInfo(url, retryCount = 3) {

    try {
        // Random delay before each request (to avoid being detected)
        await randomDelay(2000, 6000); // Increased delay between 2 to 6 seconds

        const { pathname } = new URL(url); // Extract the relative URL path

        let response;
        try {
            // Attempt to make the request
            response = await axiosInstance.get(pathname, {
                headers: {
                    'Referer': url, // Simulate real navigation
                    'Origin': 'https://www.pro-football-reference.com', // Help prevent detection
                },
                timeout: 10000,  // Set a 10-second timeout for the request
            });
        } catch (error) {
            // Handle rate limit error
            if (error.response && error.response.status === 429) {
                const retryAfter = parseInt(error.response.headers['retry-after'], 10);
                if (retryAfter) {
                    console.log(`Rate limit hit. Retrying after ${retryAfter} seconds...`);
                    await fixedDelay(retryAfter);  // Wait for Retry-After period
                    return getPfrPlayerInfo(url);  // Retry the request
                } else {
                    console.error('Rate limit exceeded, but no Retry-After header found.');
                    return null;
                }
            }

            // Handle timeout error
            if (error.code === 'ECONNABORTED') {
                if (retryCount > 0) {
                    console.log(`Request timed out. Retrying... (${retryCount} retries left)`);
                    await fixedDelay(3); // Wait 3 seconds before retrying
                    return getPfrPlayerInfo(url, retryCount - 1); // Retry the request
                } else {
                    console.error('Max retries reached. Timeout error.');
                    return null;
                }
            }

            // Handle other errors
            console.error('Error fetching data:', error.message);
            return null;
        }

        // Process the response (e.g., parse the HTML or JSON)
        const $ = cheerio.load(response.data);

        // Extract college information from the #info div
        const infoDiv = $('#info');
        let colleges = [];

        if (infoDiv.length) {
            const collegeParagraph = infoDiv.find('p:contains("College:")');

            if (collegeParagraph.length) {
                collegeParagraph.find('a').each(function () {
                    const linkText = $(this).text().trim();

                    if (linkText && linkText !== '' && linkText !== 'College Stats') {
                        colleges.push(linkText);
                    }
                });

                // Replace abbreviations like "St." with "State"
                colleges = colleges.map(college => college.replace('St.', 'State'));
            }
        }

        // Return the extracted information
        return colleges;

    } catch (error) {
        console.error('Error fetching or parsing data:', error.message);
        return null;  // Return null or an empty object to handle the error gracefully
    }
}




async function checkValidPlayers(matches, skippedPlayers, teamIndices, pfrObject, isCareer, colleges) {

  // Loop through the sorted players
  for (const player of matches) {
    const record = player.playerRecord;
    const teamRecord = player.teamRecord;
    const teamName = teamRecord !== null ? teamRecord.DisplayName : "Free Agents";

    const index = record.index;
    if (skippedPlayers.includes(index)) {
      continue;
    }

    const finalMaddenName = FranchiseUtils.removeSuffixes(player.name);
    const playerCollege = getCollege(record.College);
    
    //const collegeMatch = (colleges.includes(playerCollege));
    const ageMatch = !isCareer ? (pfrObject.finalPfrAge === record.Age) : (Math.abs(pfrObject.finalPfrAge - record.Age) <= 1);
    const nameMatch = (pfrObject.finalPfrName === finalMaddenName);
    const teamMatch = (teamIndices.includes(record.TeamIndex));

    const isMatch = nameMatch && teamMatch;

    const otherMatch = nameMatch && ageMatch; //&& collegeMatch;
    if (isMatch || otherMatch) { 
      return index;
    } else {
      console.log(`PFR: ${pfrObject.finalPfrName}, ${pfrObject.finalPfrAge}, ${pfrObject.pfrPlayer.TEAM}. Last played in ${pfrObject.finalSeason}. ${pfrObject.pfrPlayer.PLAYERLINK}.\nMadden: ${finalMaddenName}, ${record.Age}, ${record.Position}, for the ${teamName}. ${playerCollege}. ${record.YearsPro} years of experience.`);

      while (true) {
        console.log("Enter y if correct player, or n.");
        let choice = prompt();

        if (choice.toLowerCase() === 'n') {
          skippedPlayers.push(index);
          break;
        } else if (choice.toLowerCase() === 'y') {
          //console.log(`Setting ${player.name} as the player for this link.`);
          return index;
        }
      }
    }
  }

  return -1;
};

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:60.0) Gecko/20100101 Firefox/60.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134',
    ];
    const randomIndex = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomIndex];
}
async function updateCareerStats() {
    await updateStats(franchise, true);
}

async function updateSeasonStats() {
    await updateStats(franchise, false);
}

franchise.on('ready', async function () {

  // First, add assets for any players who don't have one
  await FranchiseUtils.addAssetNames(franchise);
  await updateSeasonStats();
  await updateCareerStats();

  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



