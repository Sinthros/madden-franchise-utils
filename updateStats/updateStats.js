const FranchiseUtils = require('../Utils/FranchiseUtils');
const xlsx = require("xlsx");
const fs = require("fs");
const prompt = require('prompt-sync')();
const STRING_SIMILARITY = require('string-similarity');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const SEASON_STATS = xlsx.readFile("./players.xlsx");
const CAREER_STATS = xlsx.readFile("./players-career.xlsx");
const OUTPUT_FILE = "asset_lookup.json";
const LOOKUP_FILE = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
const DEFAULT_COLUMNS = ["PUNTYARDS", "PUNTNETYARDS", "PUNTLONGEST", "BLITZ_YARDS", "DEEPPASS_YARDS", "INSIDEPOCKETTHROW_YARDS", "MEDIUMPASS_YARDS","OUTSIDEPOCKETTHROW_YARDS", "SHORTPASS_YARDS", "PASSYARDS",
    "PRETYARDS", "KRETYARDS", "INSIDERUN_YARDS", "QBSCRAMBLE_YARDS", "OUTSIDERUN_YARDS", "RECEIVEYARDSAFTER", "RECEIVEYARDS", "RUSHYARDSAFTER1STHIT", "RUSHYARDS", "KRETLONGEST", "RUSHLONGEST", "PASSLONGEST", "RECEIVELONGEST",
    "PRETLONGEST", "DEFDEEPPASS_YARDS", "DEFMEDIUMPASS_YARDS", "DEFSHORTPASS_YARDS", "DEFINSIDERUN_YARDS", "DEFOUTSIDERUN_YARDS", "DSECINTRETURNYARDS", "DLINEFUMBLERECOVERYYARDS", "DSECINTLONGESTRETURN"
]

const TEAM_MAPPING = {
    "SFO": 14, "CHI": 0, "CIN": 1, "BUF": 2, "DEN": 3, "CLE": 4, "TAM": 5, "ARI": 6,
    "LAC": 7, "KAN": 8, "IND": 9, "DAL": 10, "MIA": 11, "PHI": 12, "ATL": 13,
    "WAS": 25, "NYG": 15, "JAX": 16, "NYJ": 17, "DET": 18, "GNB": 19, "CAR": 20,
    "NWE": 21, "LVR": 22, "LAR": 23, "BAL": 24, "NOR": 26, "SEA": 27, "PIT": 28,
    "HOU": 31, "TEN": 29, "MIN": 30, "Free Agent": 32
}

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


const validGameYears = [
  FranchiseUtils.YEARS.M25,
];


console.log("This program will recalculate all player season/career stats based on an input file you provide.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: true, isAutoUnemptyEnabled: true});
const tables = FranchiseUtils.getTablesObject(franchise);

async function getTeamIndices(teamTable, csvTeams) {
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

function getRecordColumns(record) {
    return record._offsetTable.map((offset) => {
        return offset.name;
      });
}
async function updateStats(franchise, isCareer) {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    await FranchiseUtils.readTableRecords([playerTable,teamTable]);
    const lookup = isCareer ? CAREER_STATS : SEASON_STATS;
    const players = getPlayers(lookup);
    const statColumn = isCareer ? "CareerStats" : "SeasonStats";
    //fs.writeFileSync("output_career.json", JSON.stringify(players, null, 2), "utf-8");

    for (const player of players) {
        const link = player.PLAYERLINK;

        if (!(link in LOOKUP_FILE)) {
            const teamIndices = await getTeamIndices(teamTable, player.TEAM);
            if (teamIndices.length === 0) {
                console.log(player.PLAYERNAME)
            }

            const assetName = await checkPlayerTable(player, teamIndices, isCareer);
            LOOKUP_FILE[link] = assetName === -1 ? '' : assetName;
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(LOOKUP_FILE, null, 2));
        }

        const assetName = LOOKUP_FILE[link];
        if (assetName === '') continue;

        // Get the associated player record
        const playerRecord = playerTable.records.find(
            record => FranchiseUtils.isValidPlayer(record) && record.PLYR_ASSETNAME === assetName
        );

        if (playerRecord) {
            let newStatRecord = false;
            if (FranchiseUtils.OLINE_POSITIONS.includes(playerRecord.Position)) continue;

            if (playerRecord[statColumn] === FranchiseUtils.ZERO_REF) {
                if (isCareer) {
                    const statsTableName = getStatsTableName(playerRecord.Position, player, isCareer);
                    const table = franchise.getTableByName(statsTableName);
                    await table.readRecords();
    
                    const binary = getBinaryReferenceData(table.header.tableId, table.header.nextRecordToUse);
                    playerRecord[statColumn] = binary;
                    newStatRecord = true;
                }
                else {
                    const seasonStatsArray = franchise.getTableByUniqueId(tables.seasonStatsTable);
                    await seasonStatsArray.readRecords();

                    const record = seasonStatsArray.records[seasonStatsArray.header.nextRecordToUse];
                    for (const column of FranchiseUtils.getColumnNames(record)) {
                        record[column] = FranchiseUtils.ZERO_REF;
                    }
                    const binary = getBinaryReferenceData(seasonStatsArray.header.tableId, record.index);
                    playerRecord[statColumn] = binary;
                    newStatRecord = true;
                }
            }

            const statsRef = playerRecord[statColumn];
            const {row, tableId} = FranchiseUtils.getRowAndTableIdFromRef(statsRef);
            const statsTable = franchise.getTableById(tableId);
            await statsTable.readRecords();
            const statsRecord = statsTable.records[row];
            const columnNames = FranchiseUtils.getColumnNames(statsTable);
            let seasonStatsRecord = null;

            if (!isCareer) {
                for (const column of columnNames) {
                    if (FranchiseUtils.isReferenceColumn(statsRecord, column)) {
                        const {row, tableId} = FranchiseUtils.getRowAndTableIdFromRef(statsRecord[column]);
                        const tempTable = franchise.getTableById(tableId);
                        await tempTable.readRecords();
                        const tempRecord = tempTable.records[row];
                        
                        if (tempRecord.SEAS_YEAR === 0) {
                            seasonStatsRecord = tempRecord;
                            break;
                        }
                    }
                }

                if (seasonStatsRecord === null) {
                    for (const column of columnNames) {
                        if (statsRecord[column] === FranchiseUtils.ZERO_REF) {
                            const statsTableName = getStatsTableName(playerRecord.Position, player, isCareer);
                            const table = franchise.getTableByName(statsTableName);
                            await table.readRecords();

                            const record = table.records[table.header.nextRecordToUse];
            
                            const binary = getBinaryReferenceData(table.header.tableId, record.index);
                            statsRecord[column] = binary;
                            seasonStatsRecord = record;
                            newStatRecord = true;
                            break;
                        }
                    }

                }
            }

            
            const finalRecord = isCareer ? statsRecord : seasonStatsRecord;

            if (!seasonStatsRecord && !isCareer)  {
                console.log(playerRecord.PLYR_ASSETNAME) 
                continue;
            }
            //if (!isCareer) console.log(finalRecord.offsetTable)
            const finalColumnNames = getRecordColumns(finalRecord)


            // Set default values for columns that can be negative
            if (newStatRecord) {
                if (!isCareer) {
                    finalRecord.SEAS_YEAR = 0;
                    finalRecord.YearByYearTeamIndex = playerRecord.TeamIndex;
                }
                for (const column of DEFAULT_COLUMNS) {
                    if (columnNames.includes(column)) {
                        finalRecord[column] = 0;
                    }
                }
            }

            for (const column of finalColumnNames) {
                if (column in player) {
                    if (column === 'DLINESACKS') {
                        const value = player.DLINESACKS;
                        const { integer, hasDecimal } = FranchiseUtils.splitDecimal(value);
                        
                        finalRecord.DLINESACKS = integer; // Store the integer part
                        finalRecord.DLINEHALFSACK = hasDecimal ? 1 : 0; // Store 1 if decimal exists, else 0
                    } else {
                        finalRecord[column] = player[column];
                    }
                }
            }


        } else {
            console.log(`No matching record found for assetName: ${assetName}`);
        }
        

    }
}

async function updateSeasonStats(franchise) {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    await FranchiseUtils.readTableRecords([playerTable,teamTable]);
    const players = getPlayers(SEASON_STATS);
    //fs.writeFileSync("output.json", JSON.stringify(players, null, 2), "utf-8");

    for (const player of players) {
        const link = player.PLAYERLINK;

        if (!(link in LOOKUP_FILE)) {
            const teamIndices = await getTeamIndices(teamTable, player.TEAM);
            if (teamIndices.length === 0) {
                console.log(player.PLAYERNAME)
            }

            const assetName = await checkPlayerTable(player, teamIndices, false);
            LOOKUP_FILE[link] = assetName === -1 ? '' : assetName;
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(LOOKUP_FILE, null, 2));

            if (LOOKUP_FILE[link] === '') continue;
        }
    }
}

async function checkPlayerTable(pfrPlayer, teamIndices, isCareer) {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);

    // Read records from both tables
    await FranchiseUtils.readTableRecords([playerTable, teamTable]);

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

    // Check valid players with a high match value first
    let matchValue = 0.95;
    let result = await checkValidPlayers(allValidPlayers, skippedPlayers, matchValue, teamIndices, pfrPlayer, isCareer);

    if (result !== -1) {
        return playerTable.records[result].PLYR_ASSETNAME;
    }

    // If no valid result, retry with a lower match value
    matchValue = 0.50;
    result = await checkValidPlayers(allValidPlayers, skippedPlayers, matchValue, teamIndices, pfrPlayer, isCareer);

    return result !== -1 ? playerTable.records[result].PLYR_ASSETNAME : -1;
}

async function checkValidPlayers(allValidPlayers, skippedPlayers, matchValue, teamIndices, pfrPlayer, isCareer) {

  // Create an array to store players along with their match values
  const playersWithMatchValues = allValidPlayers
  .map(player => ({ ...player, matches: STRING_SIMILARITY.compareTwoStrings(FranchiseUtils.removeSuffixes(pfrPlayer.PLAYERNAME.toLowerCase()), FranchiseUtils.removeSuffixes(player.name.toLowerCase())) }))
  .filter(player => player.matches > matchValue)
  .sort((a, b) => b.matches - a.matches);

  // Loop through the sorted players
  for (const player of playersWithMatchValues) {
    const record = player.playerRecord;
    const teamRecord = player.teamRecord;
    const teamName = teamRecord !== null ? teamRecord.DisplayName : "Free Agents";

    const index = record.index;
    if (skippedPlayers.includes(index)) {
      continue;
    }

    const finalPfrName = FranchiseUtils.removeSuffixes(pfrPlayer.PLAYERNAME);
    const finalMaddenName = FranchiseUtils.removeSuffixes(player.name);
    
    const isMatch = (finalPfrName === finalMaddenName) && (teamIndices.includes(record.TeamIndex));

    const otherMatch = (finalPfrName === finalMaddenName) && (
        !isCareer ? 
            (pfrPlayer.AGE === record.Age) : 
            (Math.abs(pfrPlayer.AGE - record.Age) <= 2)
    );
    if (isMatch || otherMatch) { 
      return index;
    } else {
      console.log(`PFR: ${finalPfrName}, ${pfrPlayer.AGE}, ${pfrPlayer.TEAM}. ${pfrPlayer.PLAYERLINK}.\nMadden: ${finalMaddenName}, ${record.Age}, ${record.Position}, for the ${teamName}. ${record.YearsPro} years of experience.`);

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
franchise.on('ready', async function () {

  // First, add assets for any players who don't have one
  await FranchiseUtils.addAssetNames(franchise);
  await updateStats(franchise,false);
  await updateStats(franchise,true);



  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});



