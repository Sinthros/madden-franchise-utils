const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../FranchiseUtils");
const fs = require("fs");
const path = require("path");

const MALE_BODY_TYPES = ["Standard", "Muscular", "Thin", "Heavy"];
const FEMALE_BODY_TYPES = ["Standard_Alternate", "Thin_Alternate"];

// Maps the CharacterBodyType enum value to the string used in the visuals' CharacterBodyType slot
// (visualBodyTypeMap in the TS project). Falls back to the enum value itself if there is no entry.
const VISUAL_BODY_TYPE_MAP = {
  Standard: "Standard_BodyType",
  Thin: "Thin_BodyType",
  Muscular: "Muscular_BodyType",
  Heavy: "Heavy_BodyType",
  Freshman: "Lean_BodyType",
  Standard_Alternate: "StandardAlternate_BodyType",
  Thin_Alternate: "ThinAlternate_BodyType",
};

/* -------------------------------------------------------------
   Lookups
------------------------------------------------------------- */

/**
 * Loads the coach visual lookups for a game version from ./<version>/ (next to this file).
 * baseCoachVisualLookup.json and baseFemaleCoachVisualLookup.json are required;
 * coachVisualsLookup.json is optional (treated as empty if the version doesn't have one yet).
 */
function loadVisualLookups(version) {
  const dir = path.join(__dirname, String(version));
  const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));

  const coachVisualsPath = path.join(dir, "coachVisualsLookup.json");

  return {
    baseCoachVisuals: read("baseCoachVisualLookup.json"),
    baseFemaleVisuals: read("baseFemaleCoachVisualLookup.json"),
    coachVisualsLookup: fs.existsSync(coachVisualsPath) ? read("coachVisualsLookup.json") : {},
  };
}

/* -------------------------------------------------------------
   Head helpers
------------------------------------------------------------- */

/**
 * Female check on a head asset name alone. Naming families:
 * - anything containing "female" (e.g. Coachhead_M26_FemaleReporter_01)
 * - Coachhead_M26_Agent_*:                 female
 * - coachhead_<M|F>_<nnnn>_HS:             gender is the 2nd segment
 * - Coachhead_HS_Generic_<M|F>_Scan_*:     gender is the 4th segment (old naming)
 * - Coachhead_<tone>_<m|f>_<eth>_*:        gender is the 3rd segment (legacy Coachhead_<tone>_<B|H|M|T>_* never has "f" there)
 * - everything else (e.g. 4_F_*):          gender is the 2nd segment
 */
function isFemaleHeadName(headName) {
  if (!headName) return false;
  const name = headName.replace(/^gen_/i, "");
  const lower = name.toLowerCase();
  const parts = lower.split("_");

  if (lower.includes("female")) return true;

  if (/^coachhead_m\d+_/.test(lower)) {
    return lower.includes("agent");
  }

  // coachhead_<M|F>_<nnnn>_HS
  if (/^coachhead_[mf]_\d+_hs$/.test(lower)) {
    return parts[1] === "f";
  }

  if (parts[0] === "coachhead") {
    return parts[1] === "hs" ? parts[3] === "f" : parts[2] === "f";
  }

  return parts[1] === "f";
}

function isFemaleHead(coachRecord) {
  const head = coachRecord?.GenericHeadAssetName;
  const bodyType = coachRecord?.CharacterBodyType;

  return FEMALE_BODY_TYPES.includes(bodyType) || isFemaleHeadName(head);
}

// Skin tone is the leading digit of the head name (e.g. "3_M_...") and defaults to 1
function getSkinToneFromHead(headAssetName) {
  const firstChar = headAssetName?.charAt(0);
  return firstChar && /\d/.test(firstChar) ? parseInt(firstChar, 10) : 1;
}

// HS heads have an "HS" segment anywhere in the name (e.g. Coachhead_HS_Generic_M_Scan_0200, coachhead_M_0083_HS).
// Matches "_HS" only as a whole segment so "_hsp" (Hispanic heads like Coachhead_4_f_hsp_d_001) doesn't count.
function isHSHeadName(headName) {
  return typeof headName === "string" && /_hs(_|$)/i.test(headName);
}

function shouldAddHeadSection(coachRecord) {
  return isHSHeadName(coachRecord?.GenericHeadAssetName);
}

function buildHeadLoadout(headAssetName) {
  return {
    loadoutCategory: "Head",
    loadoutType: "Head",
    loadoutElements: [
      {
        slotType: "PlusHead",
        itemAssetName: headAssetName,
        itemInstanceTag: headAssetName,
        blends: [{}],
        transforms: [{}],
      },
    ],
  };
}

/* -------------------------------------------------------------
   Visuals object helpers
------------------------------------------------------------- */

/**
 * Drops empty top-level strings, empty loadout elements and empty loadouts
 * (same cleanup the TS project does before saving).
 */
function cleanVisuals(visuals) {
  const cleaned = structuredClone(visuals);

  for (const key of Object.keys(cleaned)) {
    if (typeof cleaned[key] === "string" && !cleaned[key]) delete cleaned[key];
  }

  cleaned.loadouts = (cleaned.loadouts || [])
    .map((loadout) => ({
      ...loadout,
      loadoutElements: (loadout.loadoutElements || []).filter(
        (el) => el.itemAssetName !== undefined && el.itemAssetName !== "" && el.itemAssetName !== " ",
      ),
    }))
    .filter((loadout) => loadout.loadoutElements.length > 0);

  return cleaned;
}

// Assumes the slot type already exists
function updateVisualsSlot(visuals, slotType, newItemAssetName) {
  // Flatten all loadoutElements, but keep references
  const allElements = visuals.loadouts.flatMap((loadout) => loadout.loadoutElements);

  // Find the element by slotType
  const element = allElements.find((e) => e.slotType === slotType);

  // Update only if it exists
  if (element) {
    element.itemAssetName = newItemAssetName;
    return true;
  }

  return false;
}

/**
 * Sets the CharacterBodyType slot on a visuals object, adding it to the first loadout if missing.
 * @param {Object} visuals - parsed visuals object
 * @param {string} bodyType - CharacterBodyType enum value
 */
function updateBodyType(visuals, bodyType) {
  const bodyTypeValue = VISUAL_BODY_TYPE_MAP[bodyType] ?? bodyType;

  for (const loadout of visuals.loadouts) {
    const el = loadout.loadoutElements.find((e) => e.slotType === "CharacterBodyType");
    if (el) {
      el.itemAssetName = bodyTypeValue;
      return;
    }
  }

  if (visuals.loadouts.length > 0) {
    visuals.loadouts[0].loadoutElements.push({
      slotType: "CharacterBodyType",
      itemAssetName: bodyTypeValue,
    });
  }
}

/* -------------------------------------------------------------
   Visuals records
------------------------------------------------------------- */

/**
 * Gets the player/coach character visuals record
 * If it exists we pull that record, else we allocate a new one and return that record
 * It will also update the playerOrCoachRecord.CharacterVisuals reference if needed
 * @param {Object} franchise - The franchise file object
 * @param {Object} tables - The franchise tables
 * @param {Object} playerOrCoachRecord - The player or coach record
 */
async function getCharacterVisualsRecord(franchise, tables, playerOrCoachRecord) {
  let characterVisualsRef = playerOrCoachRecord.CharacterVisuals;
  const mainCharacterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
  await mainCharacterVisualsTable.readRecords();
  const visualsRecordCapacity = mainCharacterVisualsTable.header.recordCapacity;
  let visualsRecord = null;

  if (characterVisualsRef === FranchiseUtils.ZERO_REF) {
    // If it's all zeroes, we need to set a new reference
    const nextRow = mainCharacterVisualsTable.header.nextRecordToUse; // Get the first empty row
    if (nextRow >= visualsRecordCapacity) {
      console.log("ERROR - The CharacterVisuals table has run out of space. Your changes have not been saved.");
      console.log(
        `This means that the amount of players + coaches in your Franchise File exceeds ${visualsRecordCapacity}.`,
      );
      FranchiseUtils.EXIT_PROGRAM();
    }
    visualsRecord = mainCharacterVisualsTable.records[nextRow];
    characterVisualsRef = getBinaryReferenceData(mainCharacterVisualsTable.header.tableId, nextRow);
    playerOrCoachRecord.CharacterVisuals = characterVisualsRef;
  } else {
    // Else, simply convert the binary ref to the row number value
    const row = FranchiseUtils.getRowFromRef(characterVisualsRef);
    visualsRecord = mainCharacterVisualsTable.records[row];
  }

  return visualsRecord;
}

/**
 * Generates character visuals for a coach record.
 * Uses coachVisualsLookup[AssetName] if it exists, otherwise the base male/female coach visuals.
 *
 * config:
 *   baseCoachVisuals, baseFemaleVisuals, coachVisualsLookup - lookups for the game version
 *   syncBodyType - write the coach record's CharacterBodyType into the visuals' CharacterBodyType slot (27+)
 */
async function generateCoachVisuals(franchise, tables, coachRecord, config) {
  if (!coachRecord) return;

  const { baseCoachVisuals, baseFemaleVisuals, coachVisualsLookup = {}, syncBodyType = false } = config;

  const assetName = coachRecord.AssetName;
  const headAssetName = coachRecord.GenericHeadAssetName;

  // Get current visuals record (allocates a new one and updates coachRecord.CharacterVisuals if needed)
  const visualsRecord = await getCharacterVisualsRecord(franchise, tables, coachRecord);

  let visuals = coachVisualsLookup[assetName];
  const existingVisuals = visuals !== undefined;
  if (!existingVisuals) {
    visuals = isFemaleHead(coachRecord) ? baseFemaleVisuals : baseCoachVisuals;
  }

  // Clone to avoid mutating shared base visuals
  visuals = structuredClone(visuals);

  // Generic-head coaches: skin tone comes from the head name (visuals from the lookup already have their own)
  if (!existingVisuals && headAssetName && headAssetName !== "NoHead") {
    visuals.skinTone = getSkinToneFromHead(headAssetName);
  }

  // Head loadout: HS heads get a PlusHead loadout, any other generic head must not have one.
  // Lookup visuals are left alone unless this is an HS head.
  const isHSHead = shouldAddHeadSection(coachRecord);
  if (!existingVisuals || isHSHead) {
    visuals.loadouts = (visuals.loadouts || []).filter((l) => l.loadoutCategory !== "Head" && l.loadoutType !== "Head");

    if (isHSHead && headAssetName) {
      visuals.loadouts.unshift(buildHeadLoadout(headAssetName));
    }
  }

  // Generic-head coaches: sync the body type chosen on the coach record into the visuals
  if (syncBodyType && !existingVisuals && coachRecord.CharacterBodyType) {
    updateBodyType(visuals, coachRecord.CharacterBodyType);
  }

  const cleanedVisuals = cleanVisuals(visuals);

  if (visualsRecord) {
    visualsRecord.RawData = cleanedVisuals;
  }
  return visualsRecord;
}

module.exports = {
  MALE_BODY_TYPES,
  FEMALE_BODY_TYPES,
  VISUAL_BODY_TYPE_MAP,

  loadVisualLookups,
  generateCoachVisuals,
  getCharacterVisualsRecord,
  isFemaleHead,
  isFemaleHeadName,
  getSkinToneFromHead,
  isHSHeadName,
  shouldAddHeadSection,
  buildHeadLoadout,
  cleanVisuals,
  updateVisualsSlot,
  updateBodyType,
};
