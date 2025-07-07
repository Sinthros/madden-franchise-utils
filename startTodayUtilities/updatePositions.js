const FranchiseUtils = require('../Utils/FranchiseUtils');
const StartTodayUtils = require('./StartTodayUtils');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();


const ALL_POSITION_KEYS = ['QB','HB','WR','TE','LT','LG','C','RG','RT','LE','DT','RE','ROLB','MLB','LOLB','CB','SS','FS'];
const REMOVE_POSITIONS = ['FB','PK','P','H','PR','KR','LS'];
const ALL_DEPTH_CHART_URL = 'https://www.espn.com/nfl/story/_/id/29098001/nfl-depth-charts-all-32-teams';
const DEPTH_CHART_PREFIX_URL = "https://www.espn.com/nfl/team/depth/";

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program will update player positions for all players, based on ESPN Depth Charts.");
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

const FILE_PATH = path.join(__dirname, `${String(franchise.schema.meta.gameYear)}/positions_assetlookup.json`);

// If the file doesn't exist, create it with an empty object
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, '{}', 'utf8');
}

const allAssets = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

async function scrapePlayerData(currentURL) {
  try {
    const response = await axios.get(currentURL);
    const html = response.data;
    const $ = cheerio.load(html);

    const positionRows = $('.Table__TBODY tr');
    const positions = [];
    const playerData = [];

    const defenseTitle = $('.Table__Title').eq(1).text().trim();
    const specialTeamsTitle = $('.Table__Title').eq(2).text().trim();
    const teamName = $('.flex.flex-wrap span')
      .map((_, el) => $(el).text().trim())
      .get()
      .join(' ');

    console.log(`Now getting players from the ${teamName}`);

    positionRows.each((index, element) => {
      const cells = $(element).find('.Table__TD');
      const positionCell = $(cells[0]).text().trim().split(' ')[0];

      if (positionCell && !$(cells[1]).find('span').hasClass('nfl-injuries-status')) {
        positions.push(positionCell);
      } else {
        const playerEntries = {};

        cells.each((_, el) => {
          const anchor = $(el).find('a.AnchorLink');
          if (anchor.length > 0) {
            const playerName = anchor.text().trim();
            const playerLink = anchor.attr('href');

            const injuryStatus = $(el).find('span.nfl-injuries-status').text().trim();
            const finalName = injuryStatus && playerName.endsWith(injuryStatus)
              ? playerName.slice(0, -injuryStatus.length).trim()
              : playerName;

            if (finalName !== '-') {
              playerEntries[finalName] = playerLink.startsWith('http')
                ? playerLink
                : `https://www.espn.com${playerLink}`;
            }
          }
        });

        playerData.push(playerEntries);
      }
    });

    let playerDataWithPositions = {};

    positions.forEach((position, index) => {
      if (playerDataWithPositions.hasOwnProperty(position)) {
        Object.assign(playerDataWithPositions[position], playerData[index]);
      } else {
        playerDataWithPositions[position] = { ...playerData[index] };
      }
    });

    // Remove "-" values from playerDataWithPositions
    Object.keys(playerDataWithPositions).forEach((key) => {
      Object.entries(playerDataWithPositions[key]).forEach(([name]) => {
        if (name === '-') {
          delete playerDataWithPositions[key][name];
        }
      });
    });

    // Helper function to conjoin positions
    const conjoinPositions = (positionsToConjoin, conjoinedPosition) => {
      const combinedData = {};
      const deletePositions = [];

      positionsToConjoin.forEach((position) => {
        if (playerDataWithPositions.hasOwnProperty(position)) {
          Object.assign(combinedData, playerDataWithPositions[position]);
          deletePositions.push(position);
        }
      });

      if (Object.keys(combinedData).length > 0) {
        const updatedPlayerDataWithPositions = {};

        Object.keys(playerDataWithPositions).forEach((key) => {
          if (!deletePositions.includes(key)) {
            updatedPlayerDataWithPositions[key] = playerDataWithPositions[key];
          }
        });

        const insertIndex = Object.keys(playerDataWithPositions).indexOf(positionsToConjoin[0]);
        updatedPlayerDataWithPositions[conjoinedPosition] = combinedData;

        playerDataWithPositions = updatedPlayerDataWithPositions;

        // Reorder the positions to maintain the original order
        const reorderedPlayerDataWithPositions = {};
        let currentIndex = 0;

        Object.keys(playerDataWithPositions).forEach((key) => {
          if (currentIndex === insertIndex) {
            reorderedPlayerDataWithPositions[conjoinedPosition] = playerDataWithPositions[conjoinedPosition];
          }
          if (!deletePositions.includes(key)) {
            reorderedPlayerDataWithPositions[key] = playerDataWithPositions[key];
            currentIndex++;
          }
        });

        playerDataWithPositions = reorderedPlayerDataWithPositions;
      }
    };

    // Conjoin position groups if present
    if (positions.includes('LILB') && positions.includes('RILB')) {
      conjoinPositions(['LILB', 'RILB'], 'MLB');
    }
    if (positions.includes('LCB') && positions.includes('RCB') && positions.includes('NB')) {
      conjoinPositions(['LCB', 'RCB', 'NB'], 'CB');
    }
    if (positions.includes('LDT') && positions.includes('RDT')) {
      conjoinPositions(['LDT', 'RDT'], 'DT');
    }

    // Remove unwanted positions
    REMOVE_POSITIONS.forEach((position) => {
      delete playerDataWithPositions[position];
    });

    // Replace keys with values from ALL_POSITION_KEYS
    const updatedPlayerDataWithKeys = {};
    Object.keys(playerDataWithPositions).forEach((key, index) => {
      updatedPlayerDataWithKeys[ALL_POSITION_KEYS[index]] = playerDataWithPositions[key];
    });

    playerDataWithPositions = updatedPlayerDataWithKeys;
    //console.log(playerDataWithPositions);

    return [playerDataWithPositions, teamName];
  } catch (error) {
    console.error('Error:', error);
  }
}


/**
 * Removes duplicate players appearing in multiple position groups by
 * automatically keeping the highest-ranked position or prompting the user
 * if there is a tie for highest rank.
 *
 * @param {Object.<string, Object.<string, string>>} playerData
 *   An object where keys are position names and values are objects mapping
 *   player names to their associated URLs.
 *
 * @returns {Promise<Object.<string, Object.<string, string>>>}
 *   The updated playerData object with duplicates removed from all but the chosen position.
 */
async function getDuplicatePlayers(playerData) {
  // Map each playerName to array of [position, index] where index is player rank (lower is better)
  const playerPositionsMap = {};

  // Gather all player names and their positions with their ranks
  Object.entries(playerData).forEach(([position, players]) => {
    Object.keys(players).forEach(playerName => {
      if (!playerPositionsMap[playerName]) {
        playerPositionsMap[playerName] = [];
      }
      // The rank/index of the player in that position's array (lower index = better rank)
      const rank = Object.keys(players).indexOf(playerName);
      playerPositionsMap[playerName].push([position, rank]);
    });
  });

  // Filter to players appearing in more than one position
  const duplicatePlayers = Object.entries(playerPositionsMap).filter(
    ([_, positions]) => positions.length > 1
  );

  for (const [playerName, positions] of duplicatePlayers) {
    // Sort positions by ascending rank (lowest index first)
    const sortedPositions = positions.slice().sort((a, b) => a[1] - b[1]);

    // Find best rank (lowest index)
    const bestRank = sortedPositions[0][1];

    // Positions tied for best rank
    const tiedPositions = sortedPositions.filter(([_, rank]) => rank === bestRank);

    let positionToKeep;

    if (tiedPositions.length === 1) {
      // Only one best position, keep it automatically
      positionToKeep = tiedPositions[0][0];
    } else {
      // Tie between positions, prompt user to pick one
      const options = tiedPositions.map(([pos]) => pos);
      while (!positionToKeep || !options.includes(positionToKeep)) {
        positionToKeep = prompt(
          `Player "${playerName}" has a tie for highest rank in positions: (${options.join(
            ', '
          )}). Please select the position to keep:`
        );
        if (positionToKeep) positionToKeep = positionToKeep.trim().toUpperCase();
      }
    }

    // Remove player from all other positions except the chosen one
    positions.forEach(([position]) => {
      if (position !== positionToKeep) {
        delete playerData[position][playerName];
      }
    });
  }

  return playerData;
}



async function getLinksFromHTML() {
  
  try {
    const response = await axios.get(ALL_DEPTH_CHART_URL);
    const html = response.data;

    // Load the HTML into Cheerio
    const $ = cheerio.load(html);

    // Find the container div and get all the links within it
    const container = $('.container');
    const links = container.find('a');

    const filteredLinks = [];

    // Iterate over each link and filter out the ones that match the desired pattern
    links.each((index, element) => {
      const href = $(element).attr('href');
      if (href.startsWith(DEPTH_CHART_PREFIX_URL)) {
        filteredLinks.push(href);
      }
    });

    // Return the filtered links
    return filteredLinks;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};


/**
 * Handles assigning a player to a position by checking cache or running a fuzzy search.
 *
 * @param {string} playerName - The player's name (e.g., "Josh Allen").
 * @param {string} url - The unique player URL used for caching.
 * @param {string} position - The position to assign (e.g., "QB").
 * @param {number} teamIndex - The team index to help disambiguate player records.
 */
async function handlePlayer(playerName, url, position, teamIndex) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);

  // Use cached asset if available
  if (allAssets.hasOwnProperty(url)) {
    const asset = allAssets[url];
    if (!FranchiseUtils.isBlank(asset)) {
      const assetRowIndex = playerTable.records.findIndex(
        record => record.PLYR_ASSETNAME === asset
      );
      if (assetRowIndex !== -1) {
        playerTable.records[assetRowIndex].Position = position;
      }
    }
    return;
  }

  const playerInfo = await StartTodayUtils.getEspnPlayerInfo(url);
  const skippedPlayers = [];
  let result = -1;
  const options = {
    url: url,
    age: playerInfo.age,
    college: playerInfo.college,
    position: playerInfo.position
  }

  // Try high similarity first
  result = await StartTodayUtils.searchForPlayer(
    franchise,
    tables,
    playerName,
    0.95,
    skippedPlayers,
    teamIndex,
    options
  );

  // Retry with lower threshold if no match
  if (result === -1) {
    result = await StartTodayUtils.searchForPlayer(
      franchise,
      tables,
      playerName,
      0.64,
      skippedPlayers,
      teamIndex,
      options
    );
  }

  if (result !== -1) {
    const playerAssetName = playerTable.records[result].PLYR_ASSETNAME;
    allAssets[url] = playerAssetName;
    playerTable.records[result].Position = position;
  } else {
    allAssets[url] = FranchiseUtils.EMPTY_STRING;
  }
}


franchise.on('ready', async function () {
  const allTeamLinks = await getLinksFromHTML(); // Get all ESPN team links
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([playerTable, teamTable]);

  for (const currentURL of allTeamLinks) { // Iterate through each team
    // Return players and team name
    // playerData contains a dictionary of the position: {playerName: url}
    const [playerData, teamName] = await scrapePlayerData(currentURL);
    const finalPlayerData = await getDuplicatePlayers(playerData); // Filter out duplicate players per position

    const teamRecord = StartTodayUtils.getTeamRecordByFullName(teamName, teamTable);
    const teamIndex = teamRecord === null ? -1 : teamRecord.TeamIndex;

    for (const [position, players] of Object.entries(finalPlayerData)) { //Iterate through each player and their position
      for (const [playerName, url] of Object.entries(players)) {
        await handlePlayer(playerName, url, position, teamIndex);
      }
    }
    // After each team save the asset file to be safe
    fs.writeFileSync(FILE_PATH, JSON.stringify(allAssets, null, 2), 'utf8');
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(allAssets, null, 2), 'utf8');
  console.log("Positions have been updated.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();

});