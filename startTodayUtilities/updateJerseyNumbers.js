const FranchiseUtils = require('../Utils/FranchiseUtils');
const StartTodayUtils = require('./StartTodayUtils');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();

const BASE_DEPTH_CHART_URL = 'https://www.ourlads.com/nfldepthcharts/';
const ASSET_FILE_NAME = "jerseynum_assetlookup.json";
const COL_JERSEYNUM = "#";
const COL_PLAYERNAME = "Player";
const COL_AGE = "Age";
const COL_COLLEGE = "School";
const COL_YEARSPRO = "NFL Exp."
const COL_POSITION = "Pos.";
const COL_URL = "URL";

const COLS_TO_KEEP = [COL_JERSEYNUM, COL_PLAYERNAME, COL_AGE, COL_COLLEGE, COL_YEARSPRO, COL_POSITION, COL_URL];

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program will update jersey numbers for all players, based on Ourlads.com");
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

const FILE_PATH = path.join(__dirname, `${String(franchise.schema.meta.gameYear)}/${ASSET_FILE_NAME}`);

// If the file doesn't exist, create it with an empty object
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, '{}', 'utf8');
}

const ALL_ASSETS = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

async function getTeamLinks() {
  try {
    const response = await axios.get(BASE_DEPTH_CHART_URL);
    const $ = cheerio.load(response.data);

    const teamLinks = [];

    $('.page-content-wrapper').each((i, elem) => {
      $(elem).find('a').each((j, linkElem) => {
        const link = $(linkElem).attr('href');

        if (link === '#' || !link.includes('roster/')) {
          return;
        }

        teamLinks.push(`${BASE_DEPTH_CHART_URL}${link}`);
      });
    });

    return teamLinks;

  } catch (error) {
    console.error('Error fetching team links:', error);
  }
}

async function parseTeamRoster(teamUrl) {
  try {
    const response = await axios.get(teamUrl);
    const $ = cheerio.load(response.data);

    const teamCity = $('span.pt-team-city').text().trim();
    const teamName = $('span.pt-team-name').text().trim();
    const fullTeamName = `${teamCity} ${teamName}`;

    const headers = [];
    $('#page-content-wrapper th').each((i, el) => {
      headers.push($(el).text().trim());
    });

    const skipSections = ['Practice Squad', 'Free Agents / Cap Casualties', 'Reserves'].map(s =>
      s.toLowerCase()
    );

    let skipPlayers = false;
    const players = [];

    // Always skip first 2 rows to get to the player data
    $('#page-content-wrapper tr').slice(2).each((i, row) => {
      const $row = $(row);
      const colspanCell = $row.find('td[colspan]').first();

      if (colspanCell.length) {
        const sectionLabel = colspanCell.text().trim().toLowerCase();
        skipPlayers = skipSections.includes(sectionLabel);
        return; // always skip label rows
      }

      if (skipPlayers) return;

      const cells = $row.find('td');

      if (cells.length === headers.length) {
        const rowObj = {};

        headers.forEach((header, index) => {
          const cell = $(cells[index]);

          if (header === COL_PLAYERNAME) {
            const playerAnchor = cell.find('a');
            rowObj[COL_PLAYERNAME] = FranchiseUtils.getNormalizedCommaName(playerAnchor.text().trim());

            const href = playerAnchor.attr('href');
            rowObj[COL_URL] = href
              ? (href.startsWith('http') ? href : `https://www.ourlads.com${href}`)
              : null;
          } else {
            rowObj[header] = cell.text().trim();
          }
        });

        players.push(rowObj);
      }
    });

    return {
      team: fullTeamName,
      url: teamUrl,
      players: players
        .map(player =>
          Object.fromEntries(
            Object.entries(player).filter(([key]) => COLS_TO_KEEP.includes(key))
          )
        )
        .sort((a, b) => {
          const aHasNum = !FranchiseUtils.isBlank(a[COL_JERSEYNUM]);
          const bHasNum = !FranchiseUtils.isBlank(b[COL_JERSEYNUM]);
          return (aHasNum === bHasNum) ? 0 : aHasNum ? -1 : 1;
        })
    };
  } catch (err) {
    console.error(`Error parsing ${teamUrl}:`, err.message);
    return null;
  }
}

function setJerseyNum(playerRecord, teamIndex, jerseyNum = null) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  let availableJerseyNums = FranchiseUtils.getAvailableJerseyNumbers(playerTable, teamIndex);
  const currentJerseyNum = playerRecord.JerseyNum;

  if (!availableJerseyNums.includes(currentJerseyNum) && teamIndex === playerRecord.TeamIndex) {
    const teamPlayers = FranchiseUtils.getPlayersOnTeam(playerTable, teamIndex);
    const isDuplicate = teamPlayers.some(
      p => p !== playerRecord && p.JerseyNum == currentJerseyNum
    );

    if (!isDuplicate && !availableJerseyNums.includes(currentJerseyNum)) {
      availableJerseyNums.push(currentJerseyNum);
      availableJerseyNums.sort((a, b) => a - b);
    }
  }

  if (jerseyNum !== null && !availableJerseyNums.includes(jerseyNum)) {
    availableJerseyNums.push(jerseyNum);
    availableJerseyNums.sort((a, b) => a - b); // Resort
  }

  const message = `Select a jersey number for ${playerRecord.FirstName} ${playerRecord.LastName}. Current number is ${currentJerseyNum}`;
  const selectedJerseyNumber = FranchiseUtils.getUserSelection(message, availableJerseyNums);
  playerRecord.JerseyNum = selectedJerseyNumber;
}

/**
 * Assigns a jersey number to a player, allowing resolution of conflicts by reassigning other players if needed.
 *
 * @param {object} playerRecord - The player to assign a jersey number to.
 * @param {number} teamIndex - The team index of the player.
 * @param {object} playerTable - The full player table object.
 */
function assignJerseyWithConflictResolution(playerRecord, teamIndex) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamPlayers = FranchiseUtils.getPlayersOnTeam(playerTable, teamIndex);

  // Get taken numbers from other players (exclude current player)
  const takenNumbers = new Set(
    teamPlayers
      .filter(p => p.index !== playerRecord.index)
      .map(p => Number(p.JerseyNum))
      .filter(num => !Number.isNaN(num))
  );

  // Build available numbers 0-99 excluding takenNumbers
  let availableJerseyNums = [];
  for (let i = 0; i <= 99; i++) {
    if (!takenNumbers.has(i)) {
      availableJerseyNums.push(i);
    }
  }

  // Include current jersey number if it is not taken by anyone else
  const currentJerseyNum = Number(playerRecord.JerseyNum);
  if (
    !Number.isNaN(currentJerseyNum) &&
    !takenNumbers.has(currentJerseyNum) &&
    !availableJerseyNums.includes(currentJerseyNum)
  ) {
    availableJerseyNums.push(currentJerseyNum);
    availableJerseyNums.sort((a, b) => a - b);
  }

  const message = `Enter a jersey number (0–99) for ${playerRecord.FirstName} ${playerRecord.LastName}. Current number is ${playerRecord.JerseyNum}`;

  while (true) {
    console.log(`${message}\nAvailable: ${availableJerseyNums.join(', ')}`);
    const input = prompt().trim();

    const selectedNum = Number(input);
    if (Number.isNaN(selectedNum) || selectedNum < 0 || selectedNum > 99) {
      console.log("Invalid input. Please enter a number between 0 and 99.");
      continue;
    }

    // Find ALL players with this jersey number (excluding current player)
    const conflicts = teamPlayers.filter(p =>
      p !== playerRecord && Number(p.JerseyNum) === selectedNum
    );

    if (conflicts.length === 0) {
      // No conflicts — safe to assign
      playerRecord.JerseyNum = selectedNum;
      return;
    }

    console.log(`Number ${selectedNum} is currently assigned to:`);
    for (const conflict of conflicts) {
      console.log(`- ${conflict.FirstName} ${conflict.LastName}`);
    }

    const resolve = FranchiseUtils.getYesOrNo(`Do you want to reassign and assign ${selectedNum} to ${playerRecord.FirstName} ${playerRecord.LastName}?`, true);
    if (!resolve) {
      continue;
    }

    playerRecord.JerseyNum = selectedNum;

    // Reassign each conflicting player
    for (const conflict of conflicts) {
      assignJerseyWithConflictResolution(conflict, teamIndex, playerTable);
    }
    return;
  }
}


/**
 * Handles assigning a player to a position by checking cache or running a fuzzy search.
 *
 * @param {object} player - The player object.
 * @param {number} teamIndex - The team index to help disambiguate player records.
 */
async function handlePlayer(player, teamIndex) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const jerseyNum = player[COL_JERSEYNUM];
  const playerName = player[COL_PLAYERNAME];
  const url = player[COL_URL];

  // Use cached asset if available
  if (ALL_ASSETS.hasOwnProperty(url)) {
    const asset = ALL_ASSETS[url];
    if (!FranchiseUtils.isBlank(asset)) {
      const assetRowIndex = playerTable.records.findIndex(
        record => record.PLYR_ASSETNAME === asset
      );
      if (assetRowIndex !== -1) {
        const playerRecord = playerTable.records[assetRowIndex];
        if (!FranchiseUtils.isBlank(jerseyNum)) {
          playerRecord.JerseyNum = jerseyNum;
        }
        else {
          assignJerseyWithConflictResolution(playerRecord, teamIndex);
        }
      }
    }
    return;
  }

  const skippedPlayers = [];
  let result = -1;
  const options = {
    url: url,
    age: player[COL_AGE],
    college: player[COL_COLLEGE],
    position: player[COL_POSITION],
    yearsPro: player[COL_YEARSPRO]
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
    const playerRecord = playerTable.records[result];
    ALL_ASSETS[url] = playerRecord.PLYR_ASSETNAME;
    if (!FranchiseUtils.isBlank(jerseyNum)) {
        playerRecord.JerseyNum = jerseyNum;
    }
    else {
      assignJerseyWithConflictResolution(playerRecord, jerseyNum);
    }
  } else {
    ALL_ASSETS[url] = FranchiseUtils.EMPTY_STRING;
  }
}

function resolveDuplicateJerseyNumbers(playerTable, teamIndex, teamName = '') {
  let duplicatesExist = true;

  while (duplicatesExist) {
    duplicatesExist = false;

    const teamPlayers = FranchiseUtils.getPlayersOnTeam(playerTable, teamIndex);

    // Build fresh jersey map each iteration
    const jerseyMap = new Map();

    for (const player of teamPlayers) {
      const num = Number(player.JerseyNum);
      if (!Number.isNaN(num)) {
        if (!jerseyMap.has(num)) {
          jerseyMap.set(num, []);
        }
        jerseyMap.get(num).push(player);
      }
    }

    for (const [jerseyNum, playersWithSameNum] of jerseyMap.entries()) {
      if (playersWithSameNum.length > 1) {
        duplicatesExist = true;
        console.log(`Duplicate jersey number ${jerseyNum} detected on ${teamName || 'team index ' + teamIndex}.`);
        
        console.log('Players with this number:');
        playersWithSameNum.forEach(player => {
          console.log(`- ${player.FirstName} ${player.LastName}`);
        });

        // Prompt just one player at a time and then break to rebuild map
        const player = playersWithSameNum[0];
        console.log(`Resolving for ${player.FirstName} ${player.LastName} (was #${player.JerseyNum})`);
        assignJerseyWithConflictResolution(player, teamIndex);

        break; // break the for..of loop to rebuild jersey map after this change
      }
    }
  }
}





franchise.on('ready', async function () {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([playerTable, teamTable]);

  for (const link of await getTeamLinks()) {
    const obj = await parseTeamRoster(link);
    const teamName = obj.team;
    const players = obj.players;
    console.log(`Getting numbers for the ${teamName}`);
    const teamRecord = StartTodayUtils.getTeamRecordByFullName(teamName, teamTable);
    const teamIndex = teamRecord === null ? -1 : teamRecord.TeamIndex;
    for (const player of players) {
        await handlePlayer(player, teamIndex);
    }
    // After each team save the asset file to be safe
    fs.writeFileSync(FILE_PATH, JSON.stringify(ALL_ASSETS, null, 2), 'utf8');
    resolveDuplicateJerseyNumbers(playerTable, teamIndex, teamName);
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(ALL_ASSETS, null, 2), 'utf8');
  console.log("Jersey numbers have been updated.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});