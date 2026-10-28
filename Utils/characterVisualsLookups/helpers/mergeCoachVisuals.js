const fs = require("fs");
const path = require("path");

const OLD_FILE = path.join(__dirname, "oldCoachVisualsLookup.json");
const NEW_FILE = path.join(__dirname, "coachVisualsLookup.json");
const OUTPUT_FILE = path.join(__dirname, "coachVisualsLookup.merged.json");

/**
 * Keeps everything in the new lookup as-is, then appends any entries that only exist in the
 * old lookup at the end (in their original order).
 */
function mergeCoachVisuals(oldLookup, newLookup) {
  const merged = { ...newLookup };
  const appended = [];

  for (const assetName of Object.keys(oldLookup)) {
    if (Object.prototype.hasOwnProperty.call(newLookup, assetName)) continue;
    merged[assetName] = oldLookup[assetName];
    appended.push(assetName);
  }

  return { merged, appended };
}

try {
  const oldLookup = JSON.parse(fs.readFileSync(OLD_FILE, "utf8"));
  const newLookup = JSON.parse(fs.readFileSync(NEW_FILE, "utf8"));

  const { merged, appended } = mergeCoachVisuals(oldLookup, newLookup);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), "utf8");

  console.log(`Merged JSON written to: ${OUTPUT_FILE}`);
  console.log(`New entries: ${Object.keys(newLookup).length}, appended from old: ${appended.length}`);
  appended.forEach((name) => console.log(`  + ${name}`));
} catch (err) {
  console.error("Failed to merge coach visuals JSON:", err);
}
