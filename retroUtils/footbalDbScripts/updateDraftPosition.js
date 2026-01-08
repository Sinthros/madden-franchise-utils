const FranchiseUtils = require("../../Utils/FranchiseUtils");
const FootballDBUtils = require("./footballDBUtils");

const fs = require("fs");

const validGameYears = [FranchiseUtils.YEARS.M26];

console.log("This program will update draft positions for all players based on footballdb.com");
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on("ready", async function () {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);

  await FranchiseUtils.readTableRecords([playerTable, teamTable, seasonInfoTable]);
  FranchiseUtils.addAssetNames(franchise);

  const seasonYear = seasonInfoTable.records[0].CurrentSeasonYear;
  const teamRecords = teamTable.records.filter((team) => !team.isEmpty && team.TeamIndex < 32 && team.TEAM_VISIBLE);

  for (const team of teamRecords) {
    const longNameSlug = FootballDBUtils.toSlug(team.LongName);
    const displayNameSlug = FootballDBUtils.toSlug(team.DisplayName);
    const teamIndex = team.TeamIndex;

    const rosterUrl = `${FootballDBUtils.ROSTER_PREFIX_URL}${longNameSlug}-${displayNameSlug}/roster/${seasonYear}`;

    let playerData;

    try {
      playerData = await FootballDBUtils.scrapeRoster(rosterUrl, teamIndex);
    } catch (err) {
      console.error(
        `🚫 FAILED during ROSTER FETCH for team ${team.LongName}`,
        `\n   URL: ${rosterUrl}`,
        `\n   Error: ${err.message}`
      );
      continue;
    }

    for (const player of playerData) {

      let draftInfo;
      let fromCache = false;

      try {
        const result = await FootballDBUtils.getPlayerDraftInfoCached(player.profileUrl);
        draftInfo = result.draftInfo;
        fromCache = result.fromCache;

        Object.assign(player, draftInfo);
      } catch (err) {
        console.error(
          `   🚫 FAILED during DRAFT INFO fetch`,
          `\n      Player: ${player.name}`,
          `\n      URL: ${player.profileUrl}`,
          `\n      Error: ${err.message}`
        );
        continue;
      }

      /* ---- Asset matching ---- */
      try {
        const options = {
          age: player.age,
          college: player.college,
          teamIndex: player.teamIndex,
        };

        await FootballDBUtils.matchPlayer(franchise, tables, player.name, player.profileUrl, options);

        if (!fromCache) {
          await FootballDBUtils.sleep(600);
        }
      } catch (err) {
        console.error(
          `   🚫 FAILED during ASSET MATCH`,
          `\n      Player: ${player.name}`,
          `\n      Error: ${err.message}`
        );
      }
    }

    /* ===============================
       PHASE 3: CACHE WRITES
       =============================== */
    try {
      if (FootballDBUtils.isDraftCacheDirty()) {
        fs.writeFileSync(
          FootballDBUtils.PLAYER_DRAFT_CACHE_FILE,
          JSON.stringify(FootballDBUtils.PLAYER_DRAFT_CACHE, null, 2),
          "utf8"
        );
        FootballDBUtils.setDraftCacheDirty(false);
      }

      fs.writeFileSync(FootballDBUtils.ASSET_FILE_PATH, JSON.stringify(FootballDBUtils.ALL_ASSETS, null, 2), "utf8");
    } catch (err) {
      console.error(`🚫 FAILED during CACHE WRITE for team ${team.LongName}`, `\n   Error: ${err.message}`);
    }

    console.log(`✅ Finished team: ${team.LongName}`);
  }
});
