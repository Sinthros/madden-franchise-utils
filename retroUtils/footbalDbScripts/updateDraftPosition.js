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

          if (!fromCache) {
            await FootballDBUtils.sleep(600);
          }
        } catch (err) {
          console.error(`Failed to scrape player ${player.name}:`, err.message);
        }
      }

      if (FootballDBUtils.isDraftCacheDirty()) {
        fs.writeFileSync(
          FootballDBUtils.PLAYER_DRAFT_CACHE_FILE,
          JSON.stringify(FootballDBUtils.PLAYER_DRAFT_CACHE, null, 2),
          "utf8"
        );
        FootballDBUtils.setDraftCacheDirty(false);
      }
    } catch (err) {
      console.error(`🚫 Failed for team ${team.LongName}`, err.message);
    }
  }
});
