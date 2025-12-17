// remove_prefixes_recursive.js
const fs = require('fs');
const path = require('path');

const prefixes = [
  'mapo_coachportraits_legends_',
  'mapo_coachportraits_generic_',
  'mapo_coachportraits_'
];

const dir = 'C:\\Users\\xxx\\Downloads\\MFT Coach Portraits'; // change this to your target directory

function renamePngs(folder) {
  const files = fs.readdirSync(folder);
  for (const file of files) {
    const fullPath = path.join(folder, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      renamePngs(fullPath);
      continue;
    }

    if (file.toLowerCase().endsWith('.png')) {
      let newName = file;
      for (const prefix of prefixes) {
        if (newName.startsWith(prefix)) {
          newName = newName.replace(prefix, '');
          break;
        }
      }

      if (newName !== file) {
        const newPath = path.join(folder, newName);
        fs.renameSync(fullPath, newPath);
        console.log(`Renamed: ${file} → ${newName}`);
      }
    }
  }
}

renamePngs(dir);
