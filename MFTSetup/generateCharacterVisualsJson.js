/**
 * generateVisualsJson.js
 *
 * Reads the Madden item Excel and outputs two JSON files:
 *   - playerVisuals.json  (CharacterRoleType_Player + CharacterRoleType_All)
 *   - coachVisuals.json   (CharacterRoleType_Coach  + CharacterRoleType_All)
 *
 * Each file is a dict of { slotType: [itemName, ...] } where slotType has the
 * LoadoutSlot_ prefix stripped (e.g. "LoadoutSlot_FaceMask" -> "FaceMask").
 *
 * Usage:
 *   node generateVisualsJson.js --input ./Prefab_Excel.xlsx --output ./
 *   node generateVisualsJson.js --input ./Prefab_Excel.xlsx --output ./ --pretty
 *
 * Requirements:
 *   npm install xlsx
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const PLAYER_ROLES = new Set(['CharacterRoleType_Player', 'CharacterRoleType_All']);
const COACH_ROLES  = new Set(['CharacterRoleType_Coach',  'CharacterRoleType_All']);

// Left/Right pairs that should be merged into a single slot type
const SLOT_MERGE_MAP = {
  'LeftArmTattoo':     'ArmTattoo',
  'RightArmTattoo':    'ArmTattoo',
  'LeftArmWear':       'ArmWear',
  'RightArmWear':      'ArmWear',
  'LeftBicepBand':     'BicepBand',
  'RightBicepBand':    'BicepBand',
  'LeftCalfBand':      'CalfBand',
  'RightCalfBand':     'CalfBand',
  'LeftEarAccessory':  'EarAccessory',
  'RightEarAccessory': 'EarAccessory',
  'LeftElbowWear':     'ElbowWear',
  'RightElbowWear':    'ElbowWear',
  'LeftForearmBand':   'ForearmBand',
  'RightForearmBand':  'ForearmBand',
  'LeftHandAccessory': 'HandAccessory',
  'RightHandAccessory':'HandAccessory',
  'LeftHandWear':      'HandWear',
  'RightHandWear':     'HandWear',
  'LeftKneeBrace':     'KneeBrace',
  'RightKneeBrace':    'KneeBrace',
  'LeftLegTattoo':     'LegTattoo',
  'RightLegTattoo':    'LegTattoo',
  'LeftShoe':          'Shoe',
  'RightShoe':         'Shoe',
  'LeftShoeOverride':  'ShoeOverride',
  'RightShoeOverride': 'ShoeOverride',
  'LeftSpat':          'Spat',
  'RightSpat':         'Spat',
  'LeftThighWear':     'ThighWear',
  'RightThighWear':    'ThighWear',
  'LeftWristWear':     'WristWear',
  'RightWristWear':    'WristWear',
};

// Left/Right pairs to merge into a single key
const MERGE_PAIRS = {
  'LeftShoe':          'Shoe',
  'RightShoe':         'Shoe',
  'LeftSpat':          'Spat',
  'RightSpat':         'Spat',
  'LeftArmWear':       'ArmWear',
  'RightArmWear':      'ArmWear',
  'LeftElbowWear':     'ElbowWear',
  'RightElbowWear':    'ElbowWear',
  'LeftHandWear':      'HandWear',
  'RightHandWear':     'HandWear',
  'LeftWristWear':     'WristWear',
  'RightWristWear':    'WristWear',
  'LeftThighWear':     'ThighWear',
  'RightThighWear':    'ThighWear',
  'LeftCalfWear':      'CalfWear',
  'RightCalfWear':     'CalfWear',
  'LeftArmTattoo':     'ArmTattoo',
  'RightArmTattoo':    'ArmTattoo',
  'LeftLegTattoo':     'LegTattoo',
  'RightLegTattoo':    'LegTattoo',
  'LeftBicepBand':     'BicepBand',
  'RightBicepBand':    'BicepBand',
  'LeftForearmBand':   'ForearmBand',
  'RightForearmBand':  'ForearmBand',
  'LeftCalfBand':      'CalfBand',
  'RightCalfBand':     'CalfBand',
  'LeftKneeBrace':     'KneeBrace',
  'RightKneeBrace':    'KneeBrace',
  'LeftEarAccessory':  'EarAccessory',
  'RightEarAccessory': 'EarAccessory',
  'LeftHandAccessory': 'HandAccessory',
  'RightHandAccessory':'HandAccessory',
  'LeftShoeOverride':  'ShoeOverride',
  'RightShoeOverride': 'ShoeOverride',
};

function mergeLeftRight(map) {
  const merged = {};
  for (const [slotType, items] of Object.entries(map)) {
    const mergedKey = MERGE_PAIRS[slotType] ?? slotType;
    if (!merged[mergedKey]) merged[mergedKey] = new Set();
    for (const item of items) merged[mergedKey].add(item);
  }
  // Convert sets back to sorted arrays
  return Object.fromEntries(
    Object.entries(merged).sort().map(([k, v]) => [k, [...v].sort()])
  );
}

function stripPrefix(value, prefix) {
  if (value && value.startsWith(prefix)) return value.slice(prefix.length);
  return value ?? '';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { input: null, output: null, pretty: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input')  result.input  = args[i + 1];
    if (args[i] === '--output') result.output = args[i + 1];
    if (args[i] === '--pretty') result.pretty = true;
  }
  if (!result.input || !result.output) {
    console.error('Usage: node generateVisualsJson.js --input <file.xlsx> --output <dir> [--pretty]');
    process.exit(1);
  }
  return result;
}

function generate(inputPath, outputDir, pretty = false) {
  const wb = XLSX.readFile(inputPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  const playerMap = {};
  const coachMap  = {};
  let skipped = 0;

  for (const row of rows) {
    const itemName      = row['ItemName'];
    const loadoutSlot   = row['LoadoutSlot'];
    const characterRole = row['CharacterRole'];

    if (!itemName || !loadoutSlot || !characterRole) {
      skipped++;
      continue;
    }

    const rawSlot  = stripPrefix(String(loadoutSlot).trim(), 'LoadoutSlot_');
    const slotType = SLOT_MERGE_MAP[rawSlot] ?? rawSlot;
    const role     = String(characterRole).trim();
    const name     = String(itemName).trim();

    if (PLAYER_ROLES.has(role)) {
      if (!playerMap[slotType]) playerMap[slotType] = [];
      playerMap[slotType].push(name);
    }
    if (COACH_ROLES.has(role)) {
      if (!coachMap[slotType]) coachMap[slotType] = [];
      coachMap[slotType].push(name);
    }
  }

  // Sort keys and item lists, deduplicating merged Left/Right entries
  const sortedPlayer = Object.fromEntries(
    Object.entries(playerMap).sort().map(([k, v]) => [k, [...new Set(v)].sort()])
  );
  const sortedCoach = Object.fromEntries(
    Object.entries(coachMap).sort().map(([k, v]) => [k, [...new Set(v)].sort()])
  );

  const indent = pretty ? 2 : undefined;
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'playerVisuals.json'), JSON.stringify(sortedPlayer, null, indent));
  fs.writeFileSync(path.join(outputDir, 'coachVisuals.json'),  JSON.stringify(sortedCoach,  null, indent));

  const playerTotal = Object.values(sortedPlayer).reduce((s, v) => s + v.length, 0);
  const coachTotal  = Object.values(sortedCoach).reduce((s, v) => s + v.length, 0);

  console.log('=== DONE ===');
  console.log(`playerVisuals.json: ${playerTotal} items across ${Object.keys(sortedPlayer).length} slot types`);
  console.log(`coachVisuals.json:  ${coachTotal} items across ${Object.keys(sortedCoach).length} slot types`);
  if (skipped) console.log(`Skipped ${skipped} rows with missing data`);
  console.log(`\nPlayer slot types: ${Object.keys(sortedPlayer).join(', ')}`);
  console.log(`\nCoach slot types:  ${Object.keys(sortedCoach).join(', ')}`);
}

const { input, output, pretty } = parseArgs();
generate(input, output, pretty);