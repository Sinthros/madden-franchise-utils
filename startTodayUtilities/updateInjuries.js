const FranchiseUtils = require("../Utils/FranchiseUtils");
const StartTodayUtils = require("./StartTodayUtils");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const prompt = require("prompt-sync")();

const CBS_URL = "https://www.cbssports.com/nfl/injuries/";
const ASSET_FILE_NAME = "cbs_assetlookup.json";
const COL_PLAYERNAME = "Player";
const COL_UPDATED = "Updated";
const COL_INJURY = "Injury";
const COL_INJURYSTATUS = "Injury Status";
const COL_POSITION = "Position";
const COL_URL = "URL";

const MAX_INJURY_WEEKS = 63;

const TEAM_NAME_MAP = {
  JAC: "JAX",
  ARI: "AZ",
};

let INJURY_TYPES = [];
let INJURY_TYPES_SORTED = [];

const INJURY_TYPES_TO_REMOVE = ["Invalid_", "Max_", "DoNotUse", "Count_"];

// Maps CBS "Injury" text (lowercase) to the game enum values worth suggesting
const CBS_INJURY_PATTERNS = {
  ankle: /^Ankle(?!Achilles)/,
  achilles: /^AnkleAchilles/,
  back: /^Back/,
  biceps: /^Arm(Strained|Torn)Bicep$/,
  triceps: /^Arm(Strained|Torn)Tricep$/,
  forearm: /^ArmForearm/,
  elbow: /^Elbow/,
  hand: /^Hand(?!Wrist|Finger|Thumb)/,
  finger: /^HandFinger/,
  thumb: /^HandThumb/,
  wrist: /^HandWrist/,
  foot: /^Foot/,
  toe: /^Foot(BrokenToe|TurfToe)$/,
  heel: /^Foot(Contusion|Fracture|StressFracture|FractureCoupleGames)$/,
  calf: /^LegCalfStrain$/,
  groin: /^LegGroin/,
  hamstring: /^LegHamstring/,
  quadriceps: /^LegQuad/,
  thigh: /^Leg(Quad|Hamstring|BrokenFemur)/,
  shin: /^Leg(Tibia|Fibula)Broken$/,
  "lower leg": /^Leg(Calf|Tibia|Fibula)/,
  leg: /^Leg/,
  hip: /^Hip/,
  knee: /^Knee/,
  "knee - acl": /^KneeACL/,
  "knee - mcl": /^KneeMCL/,
  "knee - pcl": /^KneePCL/,
  "knee - acl + mcl": /^Knee(ACL|MCL)/,
  "knee - meniscus": /^KneeCartilageTear$/,
  neck: /^Neck/,
  shoulder: /^Shoulder/,
  chest: /^Rib(Pectoral|BruiseSternum|BruisedRibs|WindKnockedOut)/,
  pectoral: /^RibPectoral/,
  ribs: /^Rib(BruisedRibs|BrokenRibs|BruiseSternum|WindKnockedOut)$/,
  abdomen: /^RibAbdominal/,
  oblique: /^RibAbdominal/,
};

const SHOW_ALL_OPTION = "ALL";

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
  FranchiseUtils.YEARS.M26,
  FranchiseUtils.YEARS.M27,
];

console.log("This program will update injuries for all players, based on CBS Sports.");
const ONLY_IR_PLAYERS = FranchiseUtils.getYesOrNo("Should only IR players be included? Enter yes or no.");

const INCLUDE_QUESTIONABLE_PLAYERS = ONLY_IR_PLAYERS
  ? false
  : FranchiseUtils.getYesOrNo("Should players listed as questionable be included? Enter yes or no.");

const DEFAULT_INJURY_WEEKS =
  ONLY_IR_PLAYERS &&
  FranchiseUtils.getYesOrNo(
    "Would you like to set a default injury week amount for all IR players (For use in Preseason week 1 for example)? Enter yes or no.",
  )
    ? FranchiseUtils.getUserInputNumber(`How many weeks should IR players be injured?`, 0, 63)
    : -1;

// TODO, come back and make this based on the SeasonInfo table directly
const CURRENT_WEEK =
  DEFAULT_INJURY_WEEKS === -1
    ? FranchiseUtils.getUserInputNumber(
        "What regular season or playoff week are you starting from? (Used to calculate injury length from CBS's expected return week)",
        1,
        23,
      )
    : -1;

const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

const FILE_PATH = path.join(__dirname, `${String(franchise.schema.meta.gameYear)}/${ASSET_FILE_NAME}`);

// If the file doesn't exist, create it with an empty object
if (!fs.existsSync(FILE_PATH)) {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, "{}", "utf8");
}

const ALL_ASSETS = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));

async function fetchInjuryReport() {
  const response = await axios.get(CBS_URL);
  const $ = cheerio.load(response.data);

  // Remove short names
  $("span.CellPlayerName--short").remove();

  const teamInjuryReports = [];

  $("div.TableBaseWrapper").each((_, el) => {
    const $wrapper = $(el);
    const teamName = $wrapper.find("span.TeamName").text().trim();
    const teamLink = $wrapper.find(".TeamLogoNameLockup-name a").attr("href") || "";

    const rawShortName = teamLink.split("/")[3] || "";
    const shortName = TEAM_NAME_MAP[rawShortName] || rawShortName;

    const players = [];

    const headers = [];
    $wrapper.find("th").each((_, th) => {
      headers.push($(th).text().trim());
    });

    $wrapper.find("tr.TableBase-bodyTr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length === headers.length) {
        const player = {};

        headers.forEach((header, i) => {
          const cell = $(cells[i]);

          // Extract full player name and URL
          if (i === 0) {
            const anchor = cell.find("a").first();
            const name = anchor.text().trim();
            const href = anchor.attr("href");
            player[COL_PLAYERNAME] = name;
            player[COL_URL] = href ? `https://www.cbssports.com${href}` : null;
          } else {
            player[headers[i]] = cell.text().trim();
          }
        });

        const status = (player[COL_INJURYSTATUS] || "").toLowerCase();
        if (ONLY_IR_PLAYERS && !status.includes("injured reserve")) return;
        if (!INCLUDE_QUESTIONABLE_PLAYERS && status.includes("questionable")) {
          return; // Skip player
        }
        players.push(player);
      }
    });

    if (players.length > 0) {
      teamInjuryReports.push({
        team: teamName,
        shortName: shortName,
        url: CBS_URL,
        players,
      });
    }
  });

  return teamInjuryReports;
}

/**
 * Scrapes school, age, and experience from a CBS Sports NFL player profile URL.
 * Handles common HTTP errors and retries automatically.
 *
 * @param {string} url - CBS Sports player profile URL.
 * @returns {Promise<{ school: string | null, age: number | null, experience: number | null }>}
 */
async function parsePlayerProfile(url) {
  const axiosConfig = { maxRedirects: 10 };
  const retryDelay = 5000; // milliseconds
  let response;

  try {
    try {
      response = await axios.get(url, axiosConfig);
    } catch (error) {
      if (error.response) {
        if (error.response.status === 503) {
          console.warn(`503 for ${url} — retrying after delay...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          response = await axios.get(url, axiosConfig);
        } else if (error.response.status === 400) {
          const finalUrl = error.response.request?.res?.responseUrl || url;
          console.warn(`400 for ${url} — retrying with encoded URI...`);
          response = await axios.get(encodeURI(finalUrl), axiosConfig);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const $ = cheerio.load(response.data);
    let school = null;
    let age = null;
    let experience = null;

    $("div.TableBaseWrapper tr.TableBase-bodyTr td").each((_, el) => {
      const text = $(el).text().trim();

      if (text.startsWith("Age:")) {
        const match = text.match(/Age:\s*(\d+)/);
        if (match) age = parseInt(match[1], 10);
      }

      if (text.startsWith("School:")) {
        school = text.replace("School:", "").trim();
      }

      if (text.startsWith("Experience:")) {
        const match = text.match(/Experience:\s*(\d+)/);
        if (match) experience = parseInt(match[1], 10);
      }
    });

    return { school, age, experience };
  } catch (err) {
    console.error(`Failed to parse CBS profile: ${url}`, err.message);
    return { school: null, age: null, experience: null };
  }
}


function getCandidateInjuries(cbsInjury) {
  const key = (cbsInjury || "").toLowerCase().trim();
  let pattern = CBS_INJURY_PATTERNS[key];

  if (!pattern) {
    // Fallback: longest key contained in the CBS text, e.g. "Knee - ACL (partial)"
    const match = Object.keys(CBS_INJURY_PATTERNS)
      .sort((a, b) => b.length - a.length)
      .find((k) => key.includes(k));
    pattern = match ? CBS_INJURY_PATTERNS[match] : null;
  }
  if (!pattern) return [];

  return INJURY_TYPES_SORTED.filter((v) => pattern.test(v));
}

function pickInjuryType(name, cbsInjury) {
  const candidates = getCandidateInjuries(cbsInjury);

  if (candidates.length > 0) {
    const choice = FranchiseUtils.getUserSelection(`Select the injury type for ${name} (CBS says: ${cbsInjury})`, [
      ...candidates,
      SHOW_ALL_OPTION,
    ]);
    if (choice !== SHOW_ALL_OPTION) return choice;
  }

  return FranchiseUtils.getUserSelection(`Select the injury type for ${name}`, INJURY_TYPES_SORTED);
}


function getSuggestedWeeks(statusText) {
  if (CURRENT_WEEK === -1) return null;

  const match = (statusText || "").match(/Expected Return\s*-\s*Week\s*(\d+)/i);
  if (!match) return null;

  const returnWeek = parseInt(match[1], 10);
  return Math.max(0, Math.min(MAX_INJURY_WEEKS, returnWeek - CURRENT_WEEK));
}

function getInjuryWeeks(name, statusText) {
  if (DEFAULT_INJURY_WEEKS !== -1) return DEFAULT_INJURY_WEEKS;

  const suggested = getSuggestedWeeks(statusText);
  if (suggested !== null) {
    const accept = FranchiseUtils.getYesOrNo(
      `CBS expects ${name} back after ${suggested} week(s) (starting from week ${CURRENT_WEEK}). Use ${suggested}? Enter yes or no`,
      true,
    );
    if (accept) return suggested;
  }

  return FranchiseUtils.getUserInputNumber(`How many weeks should ${name} be injured?`, 0, MAX_INJURY_WEEKS);
}

/**
 * Prompts the user to assign injury details to a player.
 *
 * Displays injury summary and allows the user to:
 * 1. Select an injury type.
 * 2. Set the injury duration in weeks.
 * 3. Decide whether the player should be placed on Injured Reserve (IR).
 *
 * Sets the appropriate injury fields on the player record.
 *
 * @param {object} injuryRecord - The injury information scraped or retrieved for the player.
 * @param {object} playerRecord - The franchise player record to be updated with injury info.
 */
function selectInjury(injuryRecord, playerRecord) {
  const name = `${playerRecord.FirstName} ${playerRecord.LastName}`;

  const position = injuryRecord[COL_POSITION];
  const injury = injuryRecord[COL_INJURY];
  const status = injuryRecord[COL_INJURYSTATUS];
  const updated = injuryRecord[COL_UPDATED];

  console.log(`Player: ${name}. Position: ${position}. Injury: ${injury}. Status: ${status}. Last updated: ${updated}`);

  const finalInjury = pickInjuryType(name, injury);

  const weeksInjured = getInjuryWeeks(name, status);

  const isInjuredReserve = ONLY_IR_PLAYERS
    ? true
    : FranchiseUtils.getYesOrNo(`Should ${name} be placed on IR? Enter yes or no`, true);

  playerRecord.InjuryType = finalInjury;
  playerRecord.InjurySide = "NA";
  playerRecord.MinInjuryDuration = weeksInjured;
  playerRecord.MaxInjuryDuration = weeksInjured;
  playerRecord.TotalInjuryDuration = weeksInjured;
  playerRecord.IsInjuredReserve = isInjuredReserve;
  playerRecord.InjuryStatus = "Injured";
}

/**
 * Handles assigning a player to a position by checking cache or running a fuzzy search.
 *
 * @param {string} playerName - The player record from CBS
 * @param {number} teamIndex - The team index to help disambiguate player records.
 */
async function handlePlayer(player, teamIndex) {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const url = player[COL_URL];
  const position = player[COL_POSITION];
  const playerName = player[COL_PLAYERNAME];

  // Use cached asset if available
  if (ALL_ASSETS.hasOwnProperty(url)) {
    const asset = ALL_ASSETS[url];
    if (!FranchiseUtils.isBlank(asset)) {
      const assetRowIndex = playerTable.records.findIndex((record) => record.PLYR_ASSETNAME === asset);
      if (assetRowIndex !== -1) {
        const playerRecord = playerTable.records[assetRowIndex];
        selectInjury(player, playerRecord);
      }
    }
    return;
  }

  const playerInfo = await parsePlayerProfile(player[COL_URL]);
  const skippedPlayers = [];
  let result = -1;
  const options = {
    url: url,
    age: playerInfo.age,
    college: playerInfo.school,
    yearsPro: playerInfo.experience,
    position: position,
  };

  // Try high similarity first
  result = await StartTodayUtils.searchForPlayer(
    franchise,
    tables,
    playerName,
    0.95,
    skippedPlayers,
    teamIndex,
    options,
  );

  // Retry with lower threshold if no match
  if (result === -1) {
    result = await StartTodayUtils.searchForPlayer(
      franchise,
      tables,
      playerName,
      0.6,
      skippedPlayers,
      teamIndex,
      options,
    );
  }

  if (result !== -1) {
    const playerRecord = playerTable.records[result];
    ALL_ASSETS[url] = playerRecord.PLYR_ASSETNAME;
    selectInjury(player, playerRecord);
  } else {
    ALL_ASSETS[url] = FranchiseUtils.EMPTY_STRING;
  }
}

franchise.on("ready", async function () {
  const injuryReport = await fetchInjuryReport();
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([playerTable, teamTable]);

  INJURY_TYPES = FranchiseUtils.getEnumValuesForField(playerTable, "InjuryType").filter(
    (item) => !INJURY_TYPES_TO_REMOVE.includes(item) && !item.startsWith("First") && !item.startsWith("Last"),
  );
  INJURY_TYPES_SORTED = [...INJURY_TYPES].sort((a, b) => a.localeCompare(b));

  for (const report of injuryReport) {
    const shortName = report.shortName;
    const players = report.players;

    const teamRecord = StartTodayUtils.getTeamRecordByShortName(shortName, teamTable);
    const teamIndex = teamRecord === null ? -1 : teamRecord.TeamIndex;

    for (const player of players) {
      await handlePlayer(player, teamIndex);
    }
    fs.writeFileSync(FILE_PATH, JSON.stringify(ALL_ASSETS, null, 2), "utf8");
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(ALL_ASSETS, null, 2), "utf8");
  console.log("Injuries have been updated.");
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
});
