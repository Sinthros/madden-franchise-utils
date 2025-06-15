const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const prompt = require('prompt-sync')({ sigint: true });
const FranchiseTableId = require('../Utils/FranchiseTableId');

const validGameYears = [FranchiseUtils.YEARS.M25];
console.log("This tool updates player asset names based on historical season mappings for cyberface variations.");

// === Per-Year Asset Rename Dictionary (Add Season Years and follow this format accordingly) ===
const assetNameChangesByYear = {
  2023: {
    "oldAsset_001": "newAsset_001",
    "oldAsset_002": "newAsset_002"
  },
  2024: {
    "oldAsset_003": "newAsset_003",
    "oldAsset_004": "newAsset_004"
  },
  2025: {
    "oldAsset_005": "newAsset_005",
    "oldAsset_006": "newAsset_006"
  }
};

// === Prompt for valid year ===
function promptForSeasonYear() {
  while (true) {
    const input = prompt("Enter the season year to apply proper cyberface variations (e.g., 2025): ");
    const year = parseInt(input);
    if (!isNaN(year) && year >= 1969 && year <= 2025) {
      return year;
    }
    console.log("❌ Invalid year. Please enter a number between 1969 and 2025.");
  }
}

// === Main ===
const franchise = FranchiseUtils.init(validGameYears);

franchise.on('ready', async () => {
  const tables = FranchiseUtils.getTablesObject(franchise);

  const seasonYear = promptForSeasonYear();
  const changes = assetNameChangesByYear[seasonYear];

  if (!changes) {
    console.error(`❌ No asset mappings defined for season ${seasonYear}`);
    return;
  }

  const playersTable = franchise.getTableByUniqueId(tables.playerTable);
  await FranchiseUtils.readTableRecords([playersTable]);

  let modifiedCount = 0;

  playersTable.records.forEach((record) => {
    const currentAsset = record["PLYR_ASSETNAME"];
    if (changes.hasOwnProperty(currentAsset)) {
      console.log(`Updating PLYR_ASSETNAME: ${currentAsset} → ${changes[currentAsset]}`);
      record["PLYR_ASSETNAME"] = changes[currentAsset];
      modifiedCount++;
    }
  });

  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log(`✅ Modified ${modifiedCount} asset name(s) in the player table for season ${seasonYear}`);
  FranchiseUtils.EXIT_PROGRAM();
});
