const path = require("path");
const fs = require("fs");

const FranchiseUtils = require("../Utils/FranchiseUtils");

// Prompt user for inputs
let dir = FranchiseUtils.getStringInput("Enter the absolute folder path containing the files:");
let csvFile = FranchiseUtils.getStringInput("Enter the absolute CSV file path:");
let ext = FranchiseUtils.getStringInput("Enter the file extension (e.g., .jpg, .dds):");

// Remove any quotes from inputs
dir = dir.replace(/['"]/g, "");
csvFile = csvFile.replace(/['"]/g, "");
ext = ext.replace(/['"]/g, "");

// Normalize extension to include dot
const extension = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;

// --- Load and parse CSV ---
if (!fs.existsSync(csvFile)) {
  console.error(`CSV file not found: ${csvFile}`);
  process.exit(1);
}

const csvData = fs
  .readFileSync(csvFile, "utf8")
  .trim()
  .split("\n")
  .slice(1) // skip header
  .map((line) => {
    const [name, id] = line.split(",").map((s) => s.trim());
    return { name, id };
  });

// Create a lookup map for fast access
const nameToId = Object.fromEntries(csvData.map((row) => [row.name, row.id]));

// --- Rename files ---
if (!fs.existsSync(dir)) {
  console.error(`Directory not found: ${dir}`);
  process.exit(1);
}

fs.readdirSync(dir).forEach((file) => {
  if (file.toLowerCase().endsWith(extension)) {
    const baseName = path.parse(file).name;
    const matchId = nameToId[baseName];

    if (matchId) {
      const newFile = `${matchId}${extension}`;
      const oldPath = path.join(dir, file);
      const newPath = path.join(dir, newFile);

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

console.log("✅ Renaming complete.");
