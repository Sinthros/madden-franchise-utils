const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "rawCoachVisuals.json");
const OUTPUT_FILE = path.join(__dirname, "coachVisualsLookup.json");

const PRO_HEAD_SUFFIX = "_c_pro";
const UNIQUE_HEAD_PLACEHOLDER = "MustBeUnique";

function resolveCharacterBodyType(bodyType) {
  switch (bodyType) {
    case 1:
      return "Thin_BodyType";
    case 2:
      return "Muscular_BodyType";
    case 3:
      return "Heavy_BodyType";
    default:
      return "Standard_BodyType";
  }
}

function resolveAssetName(coach) {
  if (coach.assetName) return coach.assetName;

  const genericHeadName = coach.genericHeadName;
  if (typeof genericHeadName === "string" && genericHeadName.toLowerCase().endsWith(PRO_HEAD_SUFFIX)) {
    coach.assetName = genericHeadName;
    coach.genericHeadName = UNIQUE_HEAD_PLACEHOLDER;
    return coach.assetName;
  }

  return null;
}

function reformatCoachVisuals(inputJson) {
  const output = {};
  const seenAssets = new Set();

  const coachMap = inputJson.characterVisualsCoachMap || {};

  for (const coachId of Object.keys(coachMap)) {
    const coach = coachMap[coachId];
    const assetName = resolveAssetName(coach);
    const genHead = coach.genericHeadName || "";

    if (!assetName) {
      console.warn(`Coach ${coachId} - ${genHead} missing assetName, skipping.`);
      continue;
    }

    if (seenAssets.has(assetName)) {
      //console.warn(`Duplicate assetName detected: ${assetName} (coachId ${coachId}), skipping.`);
      continue;
    }

    seenAssets.add(assetName);

    const loadouts = coach.loadouts || [];

    // ---- CoachOnField ----
    const coachOnFieldLoadout = loadouts.find((l) => l.loadoutType === "CoachOnField");

    if (!coachOnFieldLoadout) {
      console.warn(`No CoachOnField loadout found for ${assetName}`);
    }

    let baseCharacterBodyTypeLoadout = null;

    // Find Base loadout (if any)
    const baseLoadout = loadouts.find((l) => l.loadoutType === "Base");

    // Try to extract CharacterBodyType
    const characterBodyTypeElement =
      baseLoadout?.loadoutElements?.find((el) => el.slotType === "CharacterBodyType") || null;

    if (characterBodyTypeElement) {
      // Use existing CharacterBodyType only
      baseCharacterBodyTypeLoadout = {
        loadoutType: "Base",
        loadoutCategory: "Base",
        loadoutElements: [characterBodyTypeElement],
      };
    } else {
      // Missing Base OR missing CharacterBodyType → synthesize
      const bodyTypeAsset = resolveCharacterBodyType(coach.bodyType);

      baseCharacterBodyTypeLoadout = {
        loadoutType: "Base",
        loadoutCategory: "Base",
        loadoutElements: [
          {
            slotType: "CharacterBodyType",
            itemAssetName: bodyTypeAsset,
          },
        ],
      };
    }

    // ---- Build output ----
    output[assetName] = {
      //...(coach.bodyType !== undefined && { bodyType: coach.bodyType }),
      ...(coach.skinTone !== undefined && coach.skinTone !== null && { skinTone: coach.skinTone }),
      loadouts: [
        ...(coachOnFieldLoadout
          ? [
              {
                loadoutType: "CoachOnField",
                loadoutCategory: coachOnFieldLoadout.loadoutCategory,
                loadoutElements: coachOnFieldLoadout.loadoutElements,
              },
            ]
          : []),
        ...(baseCharacterBodyTypeLoadout ? [baseCharacterBodyTypeLoadout] : []),
      ],
    };
  }

  return output;
}

try {
  const rawData = fs.readFileSync(INPUT_FILE, "utf8");
  const inputJson = JSON.parse(rawData);

  const reformatted = reformatCoachVisuals(inputJson);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(reformatted, null, 2), "utf8");

  console.log(`Reformatted JSON written to: ${OUTPUT_FILE}`);
} catch (err) {
  console.error("Failed to process coach visuals JSON:", err);
}
