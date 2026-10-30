const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "rawPlayerVisuals.json");
const OUTPUT_FILE = path.join(__dirname, "playerVisualsLookup.json");

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

function reformatPlayerVisuals(inputJson) {
  const output = {};
  const seenAssets = new Set();

  const playerMap = inputJson.characterVisualsPlayerMap || {};

  for (const playerId of Object.keys(playerMap)) {
    const player = playerMap[playerId];
    const assetName = player.assetName;

    if (!assetName) {
      console.warn(`Player ${playerId} - ${player.genericHeadName || ""} missing assetName, skipping.`);
      continue;
    }

    if (seenAssets.has(assetName)) {
      continue;
    }
    seenAssets.add(assetName);

    const loadouts = player.loadouts || [];

    const onFieldLoadout = loadouts.find((l) => l.loadoutType === "PlayerOnField");

    if (!onFieldLoadout) {
      console.warn(`No PlayerOnField loadout found for ${assetName}`);
    }

    const baseLoadout = loadouts.find((l) => l.loadoutType === "Base");
    const characterBodyTypeElement =
      baseLoadout?.loadoutElements?.find((el) => el.slotType === "CharacterBodyType") || null;

    const baseCharacterBodyTypeLoadout = {
      loadoutType: "Base",
      loadoutCategory: "Base",
      loadoutElements: [
        characterBodyTypeElement ?? {
          slotType: "CharacterBodyType",
          itemAssetName: resolveCharacterBodyType(player.bodyType),
        },
      ],
    };

    // ---- Build output ----
    output[assetName] = {
      ...(player.skinTone !== undefined && player.skinTone !== null && { skinTone: player.skinTone }),
      ...(player.genericHeadName && { genericHeadName: player.genericHeadName }),
      loadouts: [
        ...(onFieldLoadout
          ? [
              {
                loadoutType: "PlayerOnField",
                loadoutElements: onFieldLoadout.loadoutElements,
              },
            ]
          : []),
        baseCharacterBodyTypeLoadout,
      ],
    };
  }

  return output;
}

try {
  const rawData = fs.readFileSync(INPUT_FILE, "utf8");
  const inputJson = JSON.parse(rawData);

  const reformatted = reformatPlayerVisuals(inputJson);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(reformatted, null, 2), "utf8");

  console.log(`Reformatted JSON written to: ${OUTPUT_FILE}`);
} catch (err) {
  console.error("Failed to process player visuals JSON:", err);
}
