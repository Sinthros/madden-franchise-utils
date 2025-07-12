const FranchiseUtils = require('../Utils/FranchiseUtils');
const StartTodayUtils = require('./StartTodayUtils');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();

const BASE_DEPTH_CHART_URL = 'https://www.ourlads.com/nfldepthcharts/';
const ASSET_FILE_NAME = "jerseynum_assetlookup.json";

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

franchise.on('ready', async function () {
  const allTeamLinks = await getTeamLinks(); // Get all Ourlads team links
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