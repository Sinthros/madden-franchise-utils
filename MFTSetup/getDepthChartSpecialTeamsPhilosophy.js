const FranchiseUtils = require("../Utils/FranchiseUtils");
const fs = require("fs");
const { getBinaryReferenceData } = require('madden-franchise').utilService;

const gameYear = FranchiseUtils.YEARS.M26;
const franchise = FranchiseUtils.init(gameYear, {
  isFtcFile: true,
  promptForBackup: false,
});

function writeJSON(data, file) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

franchise.on("ready", async function () {
  const table = franchise.getTableByUniqueId(4003040060);
  await FranchiseUtils.readTableRecords([table]);

  const result = {};

  const columnNames = FranchiseUtils.getColumnNames(table);

  for (const record of table.records) {
    const row = record.index;
    const rowResult = {};

    for (const col of columnNames) {
      if (!FranchiseUtils.isReferenceColumn(record, col)) continue;
      const bin = record[col];
      if (!bin || bin === FranchiseUtils.ZERO_REF) continue;

      // resolve DepthChartPositionPhilosophy[] wrapper
      const { tableId: arrayTableId, row: arrayRowIndex } = FranchiseUtils.getRowAndTableIdFromRef(bin);

      const arrayTable = franchise.getTableById(arrayTableId);
      await FranchiseUtils.readTableRecords([arrayTable]);

      const arrayRow = arrayTable.records[arrayRowIndex];
      const arrayCols = FranchiseUtils.getColumnNames(arrayTable);

      // always 1 entry
      for (const arrayCol of arrayCols) {
        const subBin = arrayRow[arrayCol];
        if (!subBin || subBin === FranchiseUtils.ZERO_REF) continue;

        const { tableId: subTableId, row: subRowIndex } = FranchiseUtils.getRowAndTableIdFromRef(subBin);

        const subTable = franchise.getTableById(subTableId);
        await FranchiseUtils.readTableRecords([subTable]);

        const subRow = subTable.records[subRowIndex];

        rowResult[col] = {
          PlayerType: subRow.PlayerType,
          Importance: subRow.Importance,
        };

        break; // only ever 1 per array
      }
    }

    result[row] = rowResult;
  }

  writeJSON(result, "DepthChartSpecialTeamsPhilosophy.json");
  console.log("Done writing DepthChartSpecialTeamsPhilosophy.json");
});
