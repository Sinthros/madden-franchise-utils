const FranchiseUtils = require("../../Utils/FranchiseUtils");
const FootballDBUtils = require("./footballDBUtils");

const playersProcessed = new Set();

const SAVE_EVERY = 10;
let processedCount = 0;

const validGameYears = [FranchiseUtils.YEARS.M26];

console.log("This program will update draft/player information for all players based on footballdb.com");

const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on("ready", async function () {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);

  await FranchiseUtils.readTableRecords([playerTable, teamTable, seasonInfoTable]);
  FranchiseUtils.addAssetNames(franchise);

  const seasonYear = seasonInfoTable.records[0].CurrentSeasonYear;
  FootballDBUtils.initAssets(seasonYear);

  const teams = teamTable.records.filter((team) => !team.isEmpty && team.TeamIndex < 32 && team.TEAM_VISIBLE);

  for (const team of teams) {
    const longNameSlug = FootballDBUtils.toSlug(team.LongName);
    const displayNameSlug = FootballDBUtils.toSlug(team.DisplayName);
    const rosterUrl = `${FootballDBUtils.ROSTER_PREFIX_URL}${longNameSlug}-${displayNameSlug}/roster/${seasonYear}`;

    let rosterPlayers;
    try {
      rosterPlayers = await FootballDBUtils.scrapeRoster(rosterUrl, team.TeamIndex);
    } catch (err) {
      console.error(
        `🚫 FAILED during ROSTER FETCH for team ${team.LongName}`,
        `\n   URL: ${rosterUrl}`,
        `\n   Error: ${err.message}`
      );
      continue;
    }

    for (const player of rosterPlayers) {
      try {
        const options = {
          age: player.age,
          college: player.college,
          teamIndex: player.teamIndex,
        };

        const playerRecord = await FootballDBUtils.matchPlayer(
          franchise,
          tables,
          player.name,
          player.profileUrl,
          options
        );

        if (!playerRecord) continue;

        const { playerInfo, fromCache } = await FootballDBUtils.getPlayerInfoCached(player.profileUrl);

        FootballDBUtils.assignDraftInfo(playerRecord, teamTable, playerInfo, seasonYear);
        FootballDBUtils.assignGeneralInfo(playerRecord, playerInfo, seasonYear);

        playersProcessed.add(playerRecord.index);

        if (!fromCache) await FootballDBUtils.sleep(600);
      } catch (err) {
        console.error(
          `   🚫 FAILED during PLAYER PROCESSING`,
          `\n      Player: ${player.name}`,
          `\n      Error: ${err.message}`
        );
      }
    }

    FootballDBUtils.flushCaches();
    console.log(`Finished team: ${team.LongName}`);
  }

  const remainingPlayers = playerTable.records.filter(
    (record) => FranchiseUtils.isValidPlayer(record) && !playersProcessed.has(record.index)
  );

  for (const playerRecord of remainingPlayers) {
    let url = FootballDBUtils.ALL_ASSETS.byAsset[playerRecord.PLYR_ASSETNAME];

    if (!url) {
      url = await FootballDBUtils.searchForPlayerUrl(franchise, tables, playerRecord, seasonYear);
      if (!url) continue;
    }

    const { playerInfo, fromCache } = await FootballDBUtils.getPlayerInfoCached(url);

    FootballDBUtils.assignDraftInfo(playerRecord, teamTable, playerInfo, seasonYear);
    FootballDBUtils.assignGeneralInfo(playerRecord, playerInfo, seasonYear);

    playersProcessed.add(playerRecord.index);
    processedCount++;

    if (!fromCache) await FootballDBUtils.sleep(600);

    if (processedCount % SAVE_EVERY === 0) {
      FootballDBUtils.flushCaches();
    }
  }

  FootballDBUtils.flushCaches();
  await FranchiseUtils.saveFranchiseFile(franchise);
});
