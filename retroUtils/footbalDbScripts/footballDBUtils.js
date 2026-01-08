const axios = require("axios");
const cheerio = require("cheerio");
const FranchiseUtils = require("../../Utils/FranchiseUtils");
const StartTodayUtils = require("../../startTodayUtilities/StartTodayUtils");
const fs = require("fs");
const path = require("path");

function createAxios() {
  return axios.create({
    headers: BROWSER_HEADERS,
    timeout: 15000,
  });
}

const BASE_URL = "https://www.footballdb.com";
const ROSTER_PREFIX_URL = "https://www.footballdb.com/teams/nfl/";
const ASSET_FILE_NAME = "asset_lookup.json";

// Keep track of draft picks
const draftRoundCache = new Map();
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.footballdb.com/",
};

const PLAYER_DRAFT_CACHE_FILE = path.join(__dirname, "./lookupFiles/player_draft_cache.json");
let ASSET_FILE_PATH = null;
let ALL_ASSETS = {};

const PLAYER_DRAFT_CACHE = loadJsonSafe(PLAYER_DRAFT_CACHE_FILE);

let draftCacheDirty = false;

function initAssets(seasonYear) {
  const assetDir = path.join(__dirname, "lookupFiles", "assets", String(seasonYear));

  ASSET_FILE_PATH = path.join(assetDir, ASSET_FILE_NAME);

  // Ensure directory exists
  fs.mkdirSync(assetDir, { recursive: true });

  // Load or create file
  ALL_ASSETS = loadJsonSafe(ASSET_FILE_PATH, {});
}

/**
 * Handles assigning a player to a position by checking cache or running a fuzzy search.
 *
 * @param {string} playerName - The player's name (e.g., "Josh Allen").
 * @param {string} url - The unique player URL used for caching.
 * @param {number} teamIndex - The team index to help disambiguate player records.
 */
async function matchPlayer(franchise, tables, playerName, url, options = {}) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const { teamIndex = -1, jersey = null, college = null, age = null } = options;

  // Use cached asset if available
  if (ALL_ASSETS.hasOwnProperty(url)) {
    const asset = ALL_ASSETS[url];
    if (!FranchiseUtils.isBlank(asset)) {
      const assetRowIndex = playerTable.records.findIndex((record) => record.PLYR_ASSETNAME === asset);
      if (assetRowIndex !== -1) {
        return playerTable.records[assetRowIndex];
      }
    }
    return null;
  }

  const skippedPlayers = [];
  let result = -1;
  const searchOptions = {
    url: url,
    age: age,
    college: college,
  };

  // Try high similarity first
  result = await StartTodayUtils.searchForPlayer(
    franchise,
    tables,
    playerName,
    0.95,
    skippedPlayers,
    teamIndex,
    searchOptions
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
      searchOptions
    );
  }

  if (result !== -1) {
    const record = playerTable.records[result];
    const playerAssetName = record.PLYR_ASSETNAME;
    ALL_ASSETS[url] = playerAssetName;
    return record;
  } else {
    ALL_ASSETS[url] = FranchiseUtils.EMPTY_STRING;
    return null;
  }
}

function isDraftCacheDirty() {
  return draftCacheDirty;
}

function setDraftCacheDirty(val) {
  draftCacheDirty = val;
}

function loadJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`⚠️ Cache corrupted, resetting: ${filePath}`);
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

/* -----------------------------
   Fetch ALL players by last name
   There's no way to directly search by a full name
------------------------------ */

async function fetchPlayersByLastName(lastName) {
  let page = 1;
  let totalPages = 1;
  const players = [];

  do {
    const url = `${BASE_URL}/players/index.html?q=${encodeURIComponent(lastName)}&page=${page}`;
    const { data: html } = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(html);

    if (page === 1) {
      const pagerText = $(".report-form-right .btn-group a[data-bs-toggle='dropdown']").first().text().trim(); // e.g. "1 of 3"

      const match = pagerText.match(/of\s+(\d+)/i);
      if (match) totalPages = Number(match[1]);
    }

    const mainTable = $("table.statistics.scrollable.scrollable-fixed").first();

    mainTable.find("tbody > tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;

      const link = cells.eq(0).find("a");
      if (!link.length) return;

      const profileUrl = link.attr("href");
      if (!profileUrl.startsWith("/players/")) return;

      const position = cells.eq(1).text().trim();
      if (!/^[A-Z]{1,2}$/.test(position)) return;

      const yearsText = cells.eq(2).text().trim();

      // Filter out players whose end year is before 1990
      let endYear = null;
      if (/^\d{4}-\d{4}$/.test(yearsText)) {
        endYear = parseInt(yearsText.split("-")[1], 10);
      } else if (/^\d{4}$/.test(yearsText)) {
        endYear = parseInt(yearsText, 10);
      }

      if (endYear && endYear < 1990) return;

      players.push({
        name: link.text().trim(),
        profileUrl: BASE_URL + profileUrl,
        position: position,
        years: yearsText,
        college: cells.eq(3).text().trim(),
      });
    });

    page++;
  } while (page <= totalPages);

  return players;
}

/* -----------------------------
   Filter by first name
------------------------------ */
function filterByFirstName(fullName, players) {
  const [targetFirst] = FranchiseUtils.getNormalizedName(fullName).split(" ");

  return players.filter((p) => {
    const rawParts = p.name.split(",");
    if (rawParts.length < 2) return false;

    const firstName = FranchiseUtils.getNormalizedName(rawParts[1]).trim();
    return firstName.startsWith(targetFirst);
  });
}

async function searchForPlayer(playerRecord) {
  if (!playerRecord) {
    console.error("Player record is null");
    process.exit(1);
  }

  const inputName = `${playerRecord.FirstName} ${playerRecord.LastName}`;
  const normalizedInput = FranchiseUtils.getNormalizedName(inputName);
  const [, lastName] = normalizedInput.split(" ");

  if (!lastName) {
    console.error("Please provide at least a first and last name");
    process.exit(1);
  }

  try {
    const allPlayers = await fetchPlayersByLastName(lastName);
    const matches = filterByFirstName(normalizedInput, allPlayers);

    if (matches.length === 0) {
      console.log("No matching players found");
      return;
    }

    console.log(`Found ${matches.length} matching players:\n`);

    matches.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} | ${p.position || "?"} | ${p.years || "N/A"}`);
      console.log(`   College: ${p.college || "N/A"}`);
      console.log(`   ${p.profileUrl}\n`);
    });
  } catch (err) {
    console.error("🚫 Search failed:", err.message);
  }
}

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove punctuation
    .replace(/\s+/g, "-"); // spaces → dashes
}

async function scrapeRoster(url, teamIndex) {
  const client = createAxios();
  const { data: html } = await client.get(url);

  const $ = cheerio.load(html);
  const players = [];

  $("table.statistics tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 7) return;

    const nameLink = cells.eq(1).find("a");

    players.push({
      jersey: cells.eq(0).text().trim(),
      name: nameLink.text().trim(),
      profileUrl: `https://www.footballdb.com${nameLink.attr("href")}`,
      position: cells.eq(2).text().trim(),
      gamesPlayed: Number(cells.eq(3).text()) || 0,
      gamesStarted: Number(cells.eq(4).text()) || 0,
      age: Number(cells.eq(5).text()) || null,
      college: cells.eq(6).text().trim(),
      teamIndex,
    });
  });

  return players;
}

function parseDraftInfo(text) {
  // "2006 Round 5 (159), Chi"
  const match = text.match(/(\d{4})\s+Round\s+(\d+)\s+\((\d+)\),\s*([A-Za-z]+)/);

  if (!match) return null;

  let overallPick = Number(match[3]);
  const isSupplemental = overallPick === 0;

  return {
    year: Number(match[1]),
    round: Number(match[2]),
    overallPick,
    team: match[4].toUpperCase(),
    isUndrafted: false,
    isSupplemental: isSupplemental,
  };
}

async function getPlayerDraftInfoCached(profileUrl) {
  if (PLAYER_DRAFT_CACHE[profileUrl]) {
    return {
      draftInfo: PLAYER_DRAFT_CACHE[profileUrl],
      fromCache: true,
    };
  }

  const draftInfo = await scrapePlayerDraft(profileUrl);

  if (!draftInfo.isUndrafted) {
    if (draftInfo.isSupplemental) {
      draftInfo.draftPick = 1;
    } else {
      draftInfo.draftPick = await resolvePickInRoundByLink(draftInfo.year, draftInfo.round, profileUrl);
    }
  }

  PLAYER_DRAFT_CACHE[profileUrl] = draftInfo;
  draftCacheDirty = true;

  return {
    draftInfo,
    fromCache: false,
  };
}

async function scrapePlayerDraft(profileUrl) {
  const { data: html } = await axios.get(profileUrl, {
    headers: BROWSER_HEADERS,
    timeout: 15000,
  });

  const $ = cheerio.load(html);

  // Look for the mobile/truncated draft line
  const draftSpan = $("b")
    .filter((_, el) => $(el).text().trim() === "Draft:")
    .parent()
    .find("span.d-inline.d-xl-none")
    .text()
    .trim();

  // Undrafted
  if (!draftSpan) {
    return {
      isUndrafted: true,
      isSupplemental: false,
      overallPick: null,
      year: null,
      round: null,
      pick: null,
      team: null,
    };
  }

  const parsed = parseDraftInfo(draftSpan);

  return (
    parsed ?? {
      isUndrafted: true,
      isSupplemental: false,
      overallPick: null,
      year: null,
      round: null,
      pick: null,
      team: null,
    }
  );
}

async function resolvePickInRoundByLink(year, round, playerProfileUrl) {
  const roundMap = await getDraftRoundMap(year, round);
  return roundMap.get(playerProfileUrl) ?? null;
}

async function getDraftRoundMap(year, round) {
  const key = `${year}-${round}`;
  if (draftRoundCache.has(key)) {
    return draftRoundCache.get(key);
  }

  const url = `https://www.footballdb.com/draft/draft.html?lg=NFL&yr=${year}&rnd=${round}`;

  const { data: html } = await axios.get(url, {
    headers: BROWSER_HEADERS,
    timeout: 15000,
  });

  const $ = cheerio.load(html);

  const playerLinkToPick = new Map();
  let pickIndex = 1;

  $("table.statistics tbody tr").each((_, row) => {
    const link = $(row).find("td a[href^='/players/']").attr("href");
    if (!link) return;

    // Normalize link
    const fullLink = `https://www.footballdb.com${link}`;

    playerLinkToPick.set(fullLink, pickIndex++);
  });

  draftRoundCache.set(key, playerLinkToPick);
  return playerLinkToPick;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  initAssets,
  searchForPlayer,
  fetchPlayersByLastName,
  filterByFirstName,
  getDraftRoundMap,
  resolvePickInRoundByLink,
  scrapePlayerDraft,
  getPlayerDraftInfoCached,
  parseDraftInfo,
  scrapeRoster,
  toSlug,
  isDraftCacheDirty,
  setDraftCacheDirty,
  sleep,
  matchPlayer,

  BASE_URL,
  ROSTER_PREFIX_URL,
  ASSET_FILE_NAME,
  PLAYER_DRAFT_CACHE,
  PLAYER_DRAFT_CACHE_FILE,
  get ASSET_FILE_PATH() {
    return ASSET_FILE_PATH;
  },
  get ALL_ASSETS() {
    return ALL_ASSETS;
  },
};
