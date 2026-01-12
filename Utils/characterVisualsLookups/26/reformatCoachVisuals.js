const fs = require("fs");
const path = require("path");

const INPUT_FILE = path.join(__dirname, "rawCoachVisuals.json");
const OUTPUT_FILE = path.join(__dirname, "coachVisualsLookup.json");

function reformatCoachVisuals(inputJson) {
  const output = {};
  const seenAssets = new Set();

  const coachMap = inputJson.characterVisualsCoachMap || {};

  for (const coachId of Object.keys(coachMap)) {
    const coach = coachMap[coachId];
    const assetName = coach.assetName;

    if (!assetName) {
      console.warn(`Coach ${coachId} missing assetName, skipping.`);
      continue;
    }

    if (seenAssets.has(assetName)) {
      console.warn(`Duplicate assetName detected: ${assetName} (coachId ${coachId}), skipping.`);
      continue;
    }

    seenAssets.add(assetName);

    // Find CoachOnField loadout
    const coachOnFieldLoadout = (coach.loadouts || []).find(
      l => l.loadoutType === "CoachOnField"
    );

    if (!coachOnFieldLoadout) {
      console.warn(`No CoachOnField loadout found for ${assetName}`);
    }

    output[assetName] = {
      //genericHeadName: coach.genericHeadName,
      //...(coach.bodyType !== undefined && { bodyType: coach.bodyType }),
      loadouts: coachOnFieldLoadout
        ? [
            {
              loadoutType: "CoachOnField",
              loadoutCategory: coachOnFieldLoadout.loadoutCategory,
              loadoutElements: coachOnFieldLoadout.loadoutElements
            }
          ]
        : []
    };
  }

  return output;
}

try {
  const rawData = fs.readFileSync(INPUT_FILE, "utf8");
  const inputJson = JSON.parse(rawData);

  const reformatted = reformatCoachVisuals(inputJson);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(reformatted, null, 2),
    "utf8"
  );

  console.log(`Reformatted JSON written to: ${OUTPUT_FILE}`);
} catch (err) {
  console.error("Failed to process coach visuals JSON:", err);
}
