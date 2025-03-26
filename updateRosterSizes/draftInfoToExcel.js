const FranchiseUtils = require('../Utils/FranchiseUtils');
const xlsx = require("xlsx");
const fs = require("fs");
const COLLEGES = JSON.parse(fs.readFileSync('../Utils/JsonLookups/25/colleges.json', 'utf8'));

const validGameYears = [
  FranchiseUtils.YEARS.M25,
];

console.log("This program will export some draft player info to Excel.");

const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);

function getCollege(college) {
  const assetId = FranchiseUtils.bin2Dec(college);

  try {
      return COLLEGES.find(college => college.AssetId === assetId).Name;
  } catch(err) {
    console.log(err);
    return null;
  }
}

franchise.on('ready', async function () {

  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await FranchiseUtils.readTableRecords([playerTable]);
  // Filter, sort, and map draft players
  const draftPlayers = playerTable.records
    .filter(record => FranchiseUtils.isValidDraftPlayer(record))
    .sort((a, b) => {
      if (a.PLYR_DRAFTROUND !== b.PLYR_DRAFTROUND) {
        return a.PLYR_DRAFTROUND - b.PLYR_DRAFTROUND;
      }
      return a.PLYR_DRAFTPICK - b.PLYR_DRAFTPICK;
    })
    .map(record => ({
      Name: `${record.FirstName} ${record.LastName}`,
      DraftRound: record.PLYR_DRAFTROUND,
      DraftPick: record.PLYR_DRAFTPICK,
      Position: record.Position,
      Overall: record.OverallRating,
      College: getCollege(record.College)
    }));

  // Convert to worksheet and save as Excel file
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(draftPlayers);
  xlsx.utils.book_append_sheet(workbook, worksheet, "DraftPlayers");

  // Save to a file
  const filePath = "DraftPlayers.xlsx";
  xlsx.writeFile(workbook, filePath);

  console.log(`Excel file saved as ${filePath}`);
  FranchiseUtils.EXIT_PROGRAM();
});



