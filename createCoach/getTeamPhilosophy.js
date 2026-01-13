const FranchiseUtils = require("../Utils/FranchiseUtils");
const fs = require("fs");
const validGameYears = [FranchiseUtils.YEARS.M24, FranchiseUtils.YEARS.M25, FranchiseUtils.YEARS.M26];

console.log("This will generate a team philosophy lookup file.");

const franchise = FranchiseUtils.init(validGameYears, { promptForBackup: false });
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on("ready", async function () {
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  await FranchiseUtils.readTableRecords([teamTable]);

  const philosophyArray = {};
  for (const record of FranchiseUtils.getActiveRecords(teamTable)) {
    if (FranchiseUtils.NFL_CONFERENCES.includes(record.DisplayName) || !record.TEAM_VISIBLE) {
      continue;
    }

    philosophyArray[record.DisplayName] = record.DefaultPhilosophy;
  }

  fs.writeFileSync("./philosophyOutput.json", JSON.stringify(philosophyArray, null, 2), "utf8");
  FranchiseUtils.EXIT_PROGRAM();
});
