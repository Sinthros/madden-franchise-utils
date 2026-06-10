const FranchiseUtils = require("../Utils/FranchiseUtils");
const fs = require("fs");

const gameYear = FranchiseUtils.YEARS.M26;
const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

function writeJSON(data, file) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

franchise.on("ready", async function () {
  const depthChartSubPhilosophyTable = franchise.getTableByUniqueId(922139701);
  await FranchiseUtils.readTableRecords([depthChartSubPhilosophyTable]);

  const philosophyRow = depthChartSubPhilosophyTable.records[0];
  const columnNames = FranchiseUtils.getColumnNames(depthChartSubPhilosophyTable);

  const result = {};

  for (const col of columnNames) {
    const colBin = philosophyRow[col];
    if (!colBin || colBin === FranchiseUtils.ZERO_REF) continue;

    // Resolve the DepthChartPositionSub[] array table + row
    const { tableId: arrayTableId, row: arrayRowIndex } = FranchiseUtils.getRowAndTableIdFromRef(colBin);
    const arrayTable = franchise.getTableById(arrayTableId);
    await FranchiseUtils.readTableRecords([arrayTable]);

    const arrayRow = arrayTable.records[arrayRowIndex];
    const arrayColumns = FranchiseUtils.getColumnNames(arrayTable);

    const subEntries = [];

    for (const arrayCol of arrayColumns) {
      const subBin = arrayRow[arrayCol];
      if (!subBin || subBin === FranchiseUtils.ZERO_REF) continue;

      // Resolve the individual DepthChartPositionSub row
      const { tableId: subTableId, row: subRowIndex } = FranchiseUtils.getRowAndTableIdFromRef(subBin);
      const subTable = franchise.getTableById(subTableId);
      await FranchiseUtils.readTableRecords([subTable]);

      const subRow = subTable.records[subRowIndex];
      const subColumns = FranchiseUtils.getColumnNames(subTable);

      const entry = {};
      for (const subCol of subColumns) {
        entry[subCol] = subRow[subCol];
      }

      subEntries.push(entry);
    }

    result[col] = subEntries;
  }

  writeJSON(result, "DepthChartPhilosophy.json");
  console.log("Done writing DepthChartPhilosophy.json");
});
