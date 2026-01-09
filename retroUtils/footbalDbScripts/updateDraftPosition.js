const FranchiseUtils = require("../../Utils/FranchiseUtils");
const StartTodayUtils = require("../../startTodayUtilities/StartTodayUtils");
const FootballDBUtils = require("./footballDBUtils");
const playersProcessed = new Set();

const fs = require("fs");

const validGameYears = [FranchiseUtils.YEARS.M26];

console.log("This program will update draft/player information for all players based on footballdb.com");
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

function assignDraftInfo(playerRecord, teamTable, playerInfo, seasonYear) {
  let draftYearOffset;

  // - drafted: playerInfo.draft_year - seasonYear - 1
  // - undrafted: YearsPro * -1
  if (typeof playerInfo.draft_year === "number") {
    draftYearOffset = playerInfo.draft_year - seasonYear - 1;
  } else {
    draftYearOffset = playerRecord.YearsPro * -1;
  }

  // -1 is illegal, force to 0
  if (draftYearOffset === -1 || Number.isNaN(draftYearOffset)) {
    draftYearOffset = 0;
  }

  playerRecord.YearDrafted = draftYearOffset;

  // Draft round / pick
  if (playerInfo.isUndrafted) {
    playerRecord.PLYR_DRAFTROUND = 63;
    playerRecord.PLYR_DRAFTPICK = 511;
  } else {
    playerRecord.PLYR_DRAFTROUND = Number.isInteger(playerInfo.draft_round) ? playerInfo.draft_round : 63;

    playerRecord.PLYR_DRAFTPICK = Number.isInteger(playerInfo.draft_pick) ? playerInfo.draft_pick : 511;
  }

  // Draft team
  const draftTeam =
    typeof playerInfo.draft_team === "string" ? StartTodayUtils.getTeamRecordByShortName(playerInfo.draft_team, teamTable) : null;

  // Draft team is based on presentation ID
  playerRecord.PLYR_DRAFTTEAM = draftTeam !== null ? draftTeam.PresentationId : 32;
}

franchise.on("ready", async function () {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);

  await FranchiseUtils.readTableRecords([playerTable, teamTable, seasonInfoTable]);
  FranchiseUtils.addAssetNames(franchise);

  const seasonYear = seasonInfoTable.records[0].CurrentSeasonYear;

  const teamRecords = teamTable.records.filter((team) => !team.isEmpty && team.TeamIndex < 32 && team.TEAM_VISIBLE);
  FootballDBUtils.initAssets(seasonYear);

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
      let playerInfo;
      let fromCache = false;

      try {
      } catch (err) {
        console.error(
          `   🚫 FAILED during PLAYER INFO fetch`,
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

        const playerRecord = await FootballDBUtils.matchPlayer(
          franchise,
          tables,
          player.name,
          player.profileUrl,
          options
        );

        // If we found a matching player record, get their info and then assign it to the record
        if (playerRecord !== null) {
          const result = await FootballDBUtils.getPlayerInfoCached(player.profileUrl);
          playerInfo = result.playerInfo;
          fromCache = result.fromCache;
          assignDraftInfo(playerRecord, teamTable, playerInfo, seasonYear);
          playersProcessed.add(playerRecord.index);
        }

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
      if (FootballDBUtils.isCacheDirty()) {
        fs.writeFileSync(
          FootballDBUtils.PLAYER_CACHE_FILE,
          JSON.stringify(FootballDBUtils.PLAYER_CACHE, null, 2),
          "utf8"
        );
        FootballDBUtils.setCacheDirty(false);
      }

      fs.writeFileSync(FootballDBUtils.ASSET_FILE_PATH, JSON.stringify(FootballDBUtils.ALL_ASSETS, null, 2), "utf8");
    } catch (err) {
      console.error(`🚫 FAILED during CACHE WRITE for team ${team.LongName}`, `\n   Error: ${err.message}`);
    }

    console.log(`✅ Finished team: ${team.LongName}`);
  }

  const remainingPlayers = playerTable.records.filter(
    (record) => !playersProcessed.has(record.index) && FranchiseUtils.isValidPlayer(record)
  );

  // Go over all remaining players
  for (const record of remainingPlayers) {
    const assetName = record.PLYR_ASSETNAME;
    let url = FootballDBUtils.ALL_ASSETS.byAsset[assetName];
    let playerInfo;
    let fromCache = false;

    if (!url) {
      url = await FootballDBUtils.searchForPlayerUrl(franchise, tables, record);
      if (!url) continue;
      const result = await FootballDBUtils.getPlayerInfoCached(url);
      playerInfo = result.playerInfo;
      fromCache = result.fromCache;
      assignDraftInfo(record, teamTable, playerInfo, seasonYear);
      playersProcessed.add(record.index);
    }
    if (!fromCache) {
      await FootballDBUtils.sleep(600);
    }
    try {
      if (FootballDBUtils.isCacheDirty()) {
        fs.writeFileSync(
          FootballDBUtils.PLAYER_CACHE_FILE,
          JSON.stringify(FootballDBUtils.PLAYER_CACHE, null, 2),
          "utf8"
        );
        FootballDBUtils.setCacheDirty(false);
      }

      fs.writeFileSync(FootballDBUtils.ASSET_FILE_PATH, JSON.stringify(FootballDBUtils.ALL_ASSETS, null, 2), "utf8");
    } catch (err) {
      console.error(`FAILED during CACHE WRITE`, `\n   Error: ${err.message}`);
    }
  }

  await FranchiseUtils.saveFranchiseFile(franchise);
});
