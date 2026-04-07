const FranchiseUtils = require("../Utils/FranchiseUtils");
const xlsx = require("xlsx");

const validGameYears = [FranchiseUtils.YEARS.M25, FranchiseUtils.YEARS.M26];

console.log("This program will export some draft player info to Excel.");

const franchise = FranchiseUtils.init(validGameYears, { promptForBackup: false });
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on("ready", async function () {
  const playerTable = franchise.getTableByUniqueId(tables.playerTable);
  await FranchiseUtils.readTableRecords([playerTable]);
  // Filter, sort, and map draft players
  const draftPlayers = playerTable.records
    .filter((record) => FranchiseUtils.isValidDraftPlayer(record))
    .sort((a, b) => {
      if (a.PLYR_DRAFTROUND !== b.PLYR_DRAFTROUND) {
        return a.PLYR_DRAFTROUND - b.PLYR_DRAFTROUND;
      }
      return a.PLYR_DRAFTPICK - b.PLYR_DRAFTPICK;
    })
    .map((record) => ({
      FirstName: record.FirstName,
      LastName: record.LastName,
      FullName: `${record.FirstName} ${record.LastName}`,
      AssetName: record.PLYR_ASSETNAME,
      Position: record.Position,
      Weight: `${record.Weight + 160} lbs`,
      Height: FranchiseUtils.formatHeight(record.Height),
      Overall: record.OverallRating,
      College: FranchiseUtils.getCollege(franchise, record.College),
      DraftRound: record.PLYR_DRAFTROUND,
      DraftPick: record.PLYR_DRAFTPICK,

      CurrentPortrait: record.PLYR_PORTRAIT,
      NewPortrait: null,
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
