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
      players: players.map(player =>
        Object.fromEntries(
        Object.entries(player).filter(([key]) => COLS_TO_KEEP.includes(key))
        )
      )
    };
  } catch (err) {
    console.error(`Error parsing ${teamUrl}:`, err.message);
    return null;
  }
}



franchise.on('ready', async function () {
  const allTeamLinks = await getTeamLinks(); // Get all Ourlads team links
  const obj = await parseTeamRoster("https://www.ourlads.com/nfldepthcharts/roster/MIA");
  console.log(obj.players)
  process.exit(0)
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
    fs.writeFileSync(FILE_PATH, JSON.stringify(ALL_ASSETS, null, 2), 'utf8');
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(ALL_ASSETS, null, 2), 'utf8');
  console.log("Jersey numbers have been updated.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();

});