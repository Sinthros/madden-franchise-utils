const fs = require('fs');
const path = require('path');

// 📍 Change these to match your setup
const dir = 'C:\\Users\\xxx\\Downloads\\jpgTalentPortraits'; // directory with PNG files
const csvFile = 'C:\\Users\\xxx\\Downloads\\assetlibrary_talentportraits_brt.csv'; // path to your CSV file

// --- Load and parse CSV ---
const csvData = fs.readFileSync(csvFile, 'utf8')
  .trim()
  .split('\n')
  .slice(1) // skip header
  .map(line => {
    const [name, id] = line.split(',').map(s => s.trim());
    return { name, id };
  });

// Create a lookup map for fast access
const nameToId = Object.fromEntries(csvData.map(row => [row.name, row.id]));

// --- Rename files ---
fs.readdirSync(dir).forEach(file => {
  if (file.toLowerCase().endsWith('.jpg')) {
    const baseName = path.parse(file).name; // e.g. Coachhead_2_B_N_20
    const matchId = nameToId[baseName];

    if (matchId) {
      const newFile = `${matchId}.jpg`;
      const oldPath = path.join(dir, file);
      const newPath = path.join(dir, newFile);

      // Avoid overwriting if the target already exists
      if (!fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed: ${file} → ${newFile}`);
      } else {
        console.warn(`⚠️ Skipped: ${newFile} already exists`);
      }
    } else {
      console.warn(`⚠️ No ID found for ${file}`);
    }
  }
});

console.log('✅ Renaming complete.');
