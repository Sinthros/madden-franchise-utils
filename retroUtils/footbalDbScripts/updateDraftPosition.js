const FranchiseUtils = require("../../Utils/FranchiseUtils");
const StartTodayUtils = require("../../startTodayUtilities/StartTodayUtils");
const FootballDBUtils = require("./footballDBUtils");

const fs = require("fs");
const path = require("path");

const validGameYears = [FranchiseUtils.YEARS.M26];

console.log("This program will update draft positions for all players based on footballdb.com");
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

const FILE_PATH = path.join(__dirname, `./lookupFiles/${FootballDBUtils.ASSET_FILE_NAME}`);

// If the file doesn't exist, create it with an empty object
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, "{}", "utf8");
}

const ALL_ASSETS = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));

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
  if (ALL_ASSETS.hasOwnProperty(url)) {
    const asset = ALL_ASSETS[url];
    if (!FranchiseUtils.isBlank(asset)) {
      const assetRowIndex = playerTable.records.findIndex((record) => record.PLYR_ASSETNAME === asset);
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
    position: playerInfo.position,
  };

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
    ALL_ASSETS[url] = playerAssetName;
    playerTable.records[result].Position = position;
  } else {
    ALL_ASSETS[url] = FranchiseUtils.EMPTY_STRING;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

franchise.on("ready", async function () {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);

  await FranchiseUtils.readTableRecords([playerTable, teamTable, seasonInfoTable]);

  const seasonYear = seasonInfoTable.records[0].CurrentSeasonYear;
  const teamRecords = teamTable.records.filter((team) => !team.isEmpty && team.TeamIndex < 32 && team.TEAM_VISIBLE);

  for (const team of teamRecords) {
    const longNameSlug = FootballDBUtils.toSlug(team.LongName);
    const displayNameSlug = FootballDBUtils.toSlug(team.DisplayName);
    const teamIndex = team.TeamIndex;

    const url = `${FootballDBUtils.ROSTER_PREFIX_URL}${longNameSlug}-${displayNameSlug}/roster/${seasonYear}`;

    try {
      const playerData = await FootballDBUtils.scrapeRoster(url, teamIndex);

      for (const player of playerData) {
        try {
          const { draftInfo, fromCache } = await FootballDBUtils.getPlayerDraftInfoCached(player.profileUrl);

          Object.assign(player, draftInfo);

          console.log(
            `${player.name} → ${
              draftInfo.isUndrafted ? "Undrafted" : `R${draftInfo.round} P${draftInfo.draftPick} (${draftInfo.team})`
            } ${fromCache ? "⚡" : "🌐"}`
          );

          // ✅ only sleep if we actually hit the site
          if (!fromCache) {
            await sleep(600);
          }
        } catch (err) {
          console.error(`Failed to scrape player ${player.name}:`, err.message);
        }
      }

      console.log(FootballDBUtils.isDraftCacheDirty())
      if (FootballDBUtils.isDraftCacheDirty()) {
        fs.writeFileSync(FootballDBUtils.PLAYER_DRAFT_CACHE_FILE, JSON.stringify(FootballDBUtils.PLAYER_DRAFT_CACHE, null, 2), "utf8");
        FootballDBUtils.setDraftCacheDirty(false);
      }
    } catch (err) {
      console.error(`🚫 Failed for team ${team.LongName}`, err.message);
    }
  }

  console.log("✅ All teams processed");
});
