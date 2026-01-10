const axios = require("axios");
const cheerio = require("cheerio");
const FranchiseUtils = require("../../Utils/FranchiseUtils");
const StartTodayUtils = require("../../startTodayUtilities/StartTodayUtils");
const fs = require("fs");
const path = require("path");
const stringSimilarity = require("string-similarity");

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

const PLAYER_CACHE_FILE = path.join(__dirname, "./lookupFiles/player_cache.json");
let ASSET_FILE_PATH = null;
let ALL_ASSETS = {};

const PLAYER_CACHE = loadJsonSafe(PLAYER_CACHE_FILE);

let cacheDirty = false;

function heightToInches(heightStr) {
  if (!heightStr || typeof heightStr !== "string") return null;

  const match = heightStr.match(/^(\d+)[-'\s]?(\d+)$/);
  if (!match) return null;

  const feet = Number(match[1]);
  const inches = Number(match[2]);

  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;

  return feet * 12 + inches;
}

function initAssets(seasonYear) {
  const assetDir = path.join(__dirname, "lookupFiles", "assets", String(seasonYear));

  ASSET_FILE_PATH = path.join(assetDir, ASSET_FILE_NAME);

  // Ensure directory exists
  fs.mkdirSync(assetDir, { recursive: true });

  // Load or create file
  ALL_ASSETS = loadJsonSafe(ASSET_FILE_PATH, {
    urlLookup: {},
    assetLookup: {},
  });
}

function maddenAgeAsOfYear(birthdateStr, year) {
  // Validate inputs
  if (!birthdateStr || typeof birthdateStr !== "string") return null;
  if (!Number.isInteger(year)) return null;

  const parts = birthdateStr.split("-");
  if (parts.length !== 3) return null;

  const [birthYear, birthMonth, birthDay] = parts.map(Number);

  // Basic numeric validation
  if (!Number.isInteger(birthYear) || !Number.isInteger(birthMonth) || !Number.isInteger(birthDay)) {
    return null;
  }

  // Date sanity checks
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31 || birthYear > year) {
    return null;
  }

  let age = year - birthYear;

  // After September 1st → subtract 1 (Sept 1 inclusive)
  const isAfterCutoff = birthMonth > 9 || (birthMonth === 9 && birthDay > 1);

  if (isAfterCutoff) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/**
 * Matches a player to a franchise record
 *
 * Cache structure:
 *   ALL_ASSETS.byUrl[url] = assetName
 *   ALL_ASSETS.byAsset[assetName] = url
 */
async function matchPlayer(franchise, tables, playerName, url, options = {}) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const { teamIndex = -1, jersey = null, college = null, age = null } = options;

  /* ===============================
     Check if we already have the player
     =============================== */
  if (ALL_ASSETS.byUrl.hasOwnProperty(url)) {
    const asset = ALL_ASSETS.byUrl[url];

    if (!FranchiseUtils.isBlank(asset)) {
      const assetRowIndex = playerTable.records.findIndex((record) => record.PLYR_ASSETNAME === asset);

      if (assetRowIndex !== -1) {
        return playerTable.records[assetRowIndex];
      }
    }

    return null;
  }

  /* ===============================
     Search for player
     =============================== */
  const skippedPlayers = [];
  let result = -1;

  const searchOptions = {
    url,
    age,
    college,
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

  /* ===============================
     Write to cache
     =============================== */
  if (result !== -1) {
    const record = playerTable.records[result];
    const assetName = record.PLYR_ASSETNAME;
    ALL_ASSETS.byUrl[url] = assetName;
    ALL_ASSETS.byAsset[assetName] = url;

    return record;
  }

  /* ===============================
     If no match, write empty string for the URL
     =============================== */
  ALL_ASSETS.byUrl[url] = FranchiseUtils.EMPTY_STRING;
  return null;
}

function isCacheDirty() {
  return cacheDirty;
}

function setCacheDirty(val) {
  cacheDirty = val;
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
        name: FranchiseUtils.getNormalizedCommaName(link.text().trim()),
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

/**
 * Validates whether a FootballDB candidate matches a specific Madden player record.
 * Uses fuzzy / contextual logic identical to searchForPlayer.
 *
 * @returns {Promise<boolean>} true if confirmed match
 */
async function validatePlayerMatch(franchise, tables, playerRecord, playerName, options = {}) {
  const {
    teamIndex = -1,
    position = null,
    age = null,
    weight = null,
    height = null,
    college = null,
    url = null,
  } = options;

  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([teamTable]);

  const normalizedInputName = FranchiseUtils.getNormalizedName(playerName);
  const normalizedMaddenName = FranchiseUtils.getNormalizedName(playerRecord);

  const similarity = stringSimilarity.compareTwoStrings(normalizedInputName, normalizedMaddenName);

  // Hard reject if similarity is very low
  if (similarity < 0.5) return false;

  // Hard reject if age gap is impossible
  if (age !== null && playerRecord.Age !== null && Math.abs(Number(playerRecord.Age) - Number(age)) > 12) {
    return false;
  }

  const teamRecord = teamIndex === -1 ? null : StartTodayUtils.getTeamRecordByIndex(teamIndex, teamTable);
  const teamName = teamRecord ? `${teamRecord.LongName} ${teamRecord.DisplayName}` : null;

  const playerTeamRecord = StartTodayUtils.getTeamRecordByIndex(playerRecord.TeamIndex, teamTable);
  const playerTeamName = playerTeamRecord ? `${playerTeamRecord.LongName} ${playerTeamRecord.DisplayName}` : null;

  const maddenCollege = await FranchiseUtils.getCollege(franchise, playerRecord.College);

  //const isExactNameAndTeamMatch = normalizedInputName === normalizedMaddenName && teamName === playerTeamName;

  const footballDbHeightInches = heightToInches(height);
  const nameMatches = normalizedInputName === normalizedMaddenName;

  // 1 year tolerance
  const ageMatches = age !== null && Math.abs(Number(playerRecord.Age) - Number(age)) <= 1;

  const collegeMatches = college !== null && (maddenCollege || "").toLowerCase() === college.toLowerCase();

  // 1 inch tolerance
  const heightMatches =
    footballDbHeightInches !== null && Math.abs(Number(playerRecord.Height) - footballDbHeightInches) <= 1;

  // 2 pound tolerance
  const weightMatches = weight !== null && Math.abs(Number(playerRecord.Weight + 160) - Number(weight)) <= 2;

  // If name matches and age matches and (college match OR height + weight match)
  const isFAMatch = nameMatches && ageMatches && (collegeMatches || (heightMatches && weightMatches));

  if (isFAMatch) {
    return true;
  }

  const message =
    `FootballDB: ${playerName}` +
    (position ? `, ${position}` : "") +
    (age !== null ? `, Age: ${age}` : "") +
    (weight !== null ? `, Weight: ${weight}` : "") +
    (height !== null ? `, Height: ${height}` : "") +
    (college ? `, College: ${college}` : "") +
    (url ? `, URL: ${url}` : "") +
    `\n\nMadden: ${normalizedMaddenName}, ${playerRecord.Position}, Age: ${playerRecord.Age}, Weight: ${
      playerRecord.Weight + 160
    }, Height: ${FranchiseUtils.formatHeight(playerRecord.Height)} ` +
    `for the ${playerTeamName}. ` +
    (maddenCollege ? `College: ${maddenCollege}. ` : "") +
    `${playerRecord.YearsPro} years of experience.` +
    `\n\nIs this the correct player?`;

  return FranchiseUtils.getYesOrNo(message, true);
}

function sortPlayersByNameSimilarity(inputName, players, matchMinimum) {
  const normalizedInput = FranchiseUtils.getNormalizedName(inputName);

  return players
    .map((p) => ({
      ...p,
      _similarity: stringSimilarity.compareTwoStrings(normalizedInput, FranchiseUtils.getNormalizedName(p.name)),
    }))
    .sort((a, b) => b._similarity - a._similarity)
    .filter((p) => p._similarity >= matchMinimum);
}

async function searchForPlayerUrl(franchise, tables, playerRecord, seasonYear) {
  const assetName = playerRecord.PLYR_ASSETNAME;

  // Cache hit
  const cachedUrl = ALL_ASSETS.byAsset[assetName];

  if (cachedUrl !== undefined) {
    return FranchiseUtils.isBlank(cachedUrl) ? null : cachedUrl;
  }

  const inputName = `${playerRecord.FirstName} ${playerRecord.LastName}`;
  const normalizedInput = FranchiseUtils.getNormalizedName(inputName);
  const lastName = FranchiseUtils.getNormalizedName(playerRecord.LastName);
  if (!lastName) return null;

  const allPlayers = await fetchPlayersByLastName(lastName);
  const candidates = sortPlayersByNameSimilarity(normalizedInput, allPlayers, 0.65);

  for (const candidate of candidates) {
    const scrapedInfo = await getPlayerInfoCached(candidate.profileUrl);
    const fromCache = scrapedInfo.fromCache;
    const playerInfo = scrapedInfo.playerInfo;
    const isMatch = await validatePlayerMatch(franchise, tables, playerRecord, candidate.name, {
      position: playerInfo.position,
      weight: playerInfo.weight,
      height: playerInfo.height,
      age: maddenAgeAsOfYear(playerInfo.birthdate, seasonYear),
      college: playerInfo.college,
      url: candidate.profileUrl,
    });

    if (!fromCache) await sleep(600);

    if (isMatch) {
      ALL_ASSETS.byUrl[candidate.profileUrl] = assetName;
      ALL_ASSETS.byAsset[assetName] = candidate.profileUrl;
      return candidate.profileUrl;
    }
  }

  // Cache miss
  ALL_ASSETS.byAsset[assetName] = FranchiseUtils.EMPTY_STRING;
  return null;
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

async function getPlayerInfoCached(profileUrl) {
  if (PLAYER_CACHE[profileUrl]) {
    return {
      playerInfo: PLAYER_CACHE[profileUrl],
      fromCache: true,
    };
  }

  const scrapedInfo = await scrapePlayerProfile(profileUrl);

  if (!scrapedInfo.draft_isUndrafted) {
    if (scrapedInfo.draft_isSupplemental) {
      scrapedInfo.draft_pick = 1;
    } else {
      scrapedInfo.draft_pick = await resolvePickInRoundByLink(
        scrapedInfo.draft_year,
        scrapedInfo.draft_round,
        profileUrl
      );
    }
  }

  PLAYER_CACHE[profileUrl] = scrapedInfo;
  cacheDirty = true;

  return {
    playerInfo: scrapedInfo,
    fromCache: false,
  };
}

function getLabeledValue($, labelText) {
  const label = $("b")
    .filter((_, el) => $(el).text().trim() === labelText)
    .first();

  if (!label.length) return null;

  let node = label[0].nextSibling;

  while (node) {
    // Grab the first text node immediately after the <b>
    if (node.type === "text") {
      const value = node.data.replace(/\s+/g, " ").trim();
      return value || null;
    }

    // Stop once we hit a line break
    if (node.name === "br") break;

    node = node.nextSibling;
  }

  return null;
}

async function scrapePlayerProfile(profileUrl) {
  const { data: html } = await axios.get(profileUrl, {
    headers: BROWSER_HEADERS,
    timeout: 15000,
  });

  const $ = cheerio.load(html);

  const info = {
    current_team: null,
    position: null,
    height: null,
    weight: null,
    birthdate: null,
    college: null,

    // draft fields (flat, cache-friendly)
    draft_isUndrafted: true,
    draft_isSupplemental: false,
    draft_overallPick: null,
    draft_year: null,
    draft_round: null,
    draft_pick: null,
    draft_team: null,
  };

  /* ---------------- TEAM ---------------- */
  const teamLink = $('.sectiontop-players a[href^="/teams/"]').first();
  if (teamLink.length) {
    info.current_team = teamLink.text().trim();
  }

  /* ---------------- POSITION ---------------- */
  info.position = getLabeledValue($, "Position:");

  /* ---------------- HEIGHT / WEIGHT ---------------- */
  const heightText = getLabeledValue($, "Height:");
  if (heightText) info.height = heightText;

  const weightText = getLabeledValue($, "Weight:");
  if (weightText) {
    const parsed = parseInt(weightText, 10);
    info.weight = Number.isNaN(parsed) ? weightText : parsed;
  }

  /* ---------------- BIRTHDATE ---------------- */
  const birthSpan =
    $("b")
      .filter((_, el) => $(el).text().trim() === "Birthdate:")
      .parent()
      .find("span.d-none.d-xl-inline")
      .text()
      .trim() ||
    $("b")
      .filter((_, el) => $(el).text().trim() === "Birthdate:")
      .parent()
      .find("span.d-inline.d-xl-none")
      .text()
      .trim();

  if (birthSpan) {
    // Extract a date pattern (e.g., "May 28, 1988" or "03/10/1998")
    const dateMatch = birthSpan.match(/([A-Za-z]{3,9}\s\d{1,2},\s\d{4})|(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateMatch) {
      const date = new Date(dateMatch[0]);
      info.birthdate = isNaN(date.getTime()) ? dateMatch[0] : date.toISOString().slice(0, 10);
    }
  }

  /* ---------------- COLLEGE ---------------- */
  info.college = getLabeledValue($, "College:");

  /* ---------------- DRAFT (existing logic) ---------------- */
  const draftSpan = $("b")
    .filter((_, el) => $(el).text().trim() === "Draft:")
    .parent()
    .find("span.d-inline.d-xl-none")
    .text()
    .trim();

  if (draftSpan) {
    const parsedDraft = parseDraftInfo(draftSpan);
    if (parsedDraft) {
      info.draft_isUndrafted = parsedDraft.isUndrafted;
      info.draft_isSupplemental = parsedDraft.isSupplemental;
      info.draft_overallPick = parsedDraft.overallPick;
      info.draft_year = parsedDraft.year;
      info.draft_round = parsedDraft.round;
      info.draft_pick = parsedDraft.pick;
      info.draft_team = parsedDraft.team;
    }
  }

  return info;
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
  maddenAgeAsOfYear,
  searchForPlayerUrl,
  validatePlayerMatch,
  fetchPlayersByLastName,
  filterByFirstName,
  getDraftRoundMap,
  resolvePickInRoundByLink,
  scrapePlayerProfile,
  getPlayerInfoCached,
  parseDraftInfo,
  scrapeRoster,
  toSlug,
  isCacheDirty,
  setCacheDirty,
  sleep,
  matchPlayer,

  BASE_URL,
  ROSTER_PREFIX_URL,
  ASSET_FILE_NAME,
  PLAYER_CACHE,
  PLAYER_CACHE_FILE,
  get ASSET_FILE_PATH() {
    return ASSET_FILE_PATH;
  },
  get ALL_ASSETS() {
    return ALL_ASSETS;
  },
};
