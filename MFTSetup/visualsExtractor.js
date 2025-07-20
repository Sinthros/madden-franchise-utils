const xlsx = require('xlsx');
const fs = require('fs');

function processData(records, roleType) {
  const output = {};
  const nflGear = new Set();

  for (const row of records) {
    if (row.CharacterRole !== roleType) continue;

    let rawSlot = row.LoadoutSlot;
    const item = row.ItemName;

    if (!rawSlot || !item) continue;

    // Remove "LoadoutSlot_" prefix
    const slot = rawSlot.replace(/^LoadoutSlot_/, '');

    // Remove `_item` suffix only if the slot is "GenericHead"
    //const cleanedItem = slot === 'GenericHead'
    //  ? item.replace(/_item$/i, '')
    //  : item;

    if (!output[slot]) {
      output[slot] = [];
    }

    output[slot].push(item);

    if (String(row.IsGlobal).toLowerCase() === 'true') {
      nflGear.add(item);
    }
  }

  if (nflGear.size > 0) {
    output.NFLGear = Array.from(nflGear);
  }

  return output;
}

// Load the XLSX file
const workbook = xlsx.readFile('input.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const json = xlsx.utils.sheet_to_json(sheet);

// Process Player
const playerData = processData(json, 'CharacterRoleType_Player');
fs.writeFileSync('loadout_player.json', JSON.stringify(playerData, null, 2));

// Process Coach
const coachData = processData(json, 'CharacterRoleType_Coach');
fs.writeFileSync('loadout_coach.json', JSON.stringify(coachData, null, 2));

console.log('✅ Loadout JSON files created.');
