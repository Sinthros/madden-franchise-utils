const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');

const gameYear = FranchiseUtils.YEARS.M26;
// This uses the franchise-tuning-binary.FTC file
const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false});
const SUM = 10;
const POSITION_ORDER = ["QB", "HB", "FB", "WR", "TE", "OT", "G", "C", "DE", "DT", "OLB", "MLB", "CB", "S", "KP", "LS"];
const COLUMN_LOOKUP = {
  "DeepAccuracy": "ThrowAccuracyDeepRating",
  "MediumAccuracy": "ThrowAccuracyMidRating",
  "ShortAccuracy": "ThrowAccuracyShortRating",
  "BallCarrierVision": "BCVisionRating",
  "Juke": "JukeMoveRating",
  "Spin": "SpinMoveRating"
};

const SKIP_COLUMNS = ["Toughness","KickReturn"];

const tables = FranchiseUtils.getTablesObject(franchise);


async function convertArrayToJSONFile(dataArray, filePath) {
  const jsonData = JSON.stringify(dataArray, null, 2); // Convert array to JSON string with indentation

  fs.writeFileSync(filePath, jsonData, (error) => {
    if (error) {
      console.error('Error writing JSON file:', error);
    } else {
      console.log('JSON file created successfully!');
    }
  });
};
function getFormattedColumn(column) {

  if (SKIP_COLUMNS.includes(column)) return null;

  if (COLUMN_LOOKUP[column]) return COLUMN_LOOKUP[column];

  return `${column}Rating`;
}

franchise.on('ready', async function () {

    const playerGradePhilosophy = franchise.getTableByName('PlayerGradePhilosophy');

    const finalArray = [];

    await FranchiseUtils.readTableRecords([
      playerGradePhilosophy,
    ]);

    for (const record of playerGradePhilosophy.records) {
      const archetype = record.PlayerType;
      const position = archetype.split('_')[0];

      const intangibleMetadata = FranchiseUtils.getRowAndTableIdFromRef(record.IntangiblePhilosophy);

      const intangibleGradePhilosophy = franchise.getTableById(intangibleMetadata.tableId);
      await intangibleGradePhilosophy.readRecords();

      const intangibleRecord = intangibleGradePhilosophy.records[intangibleMetadata.row];
      const desiredHigh = intangibleRecord.DesiredHigh;
      const desiredLow = intangibleRecord.DesiredLow;

      const gradeMetadata = FranchiseUtils.getRowAndTableIdFromRef(intangibleRecord.GradeWeights);

      const gradeWeightsTable = franchise.getTableById(gradeMetadata.tableId);
      await gradeWeightsTable.readRecords();
      
      const gradesRecord = gradeWeightsTable.records[gradeMetadata.row];

      const columns = FranchiseUtils.getColumnNames(gradeWeightsTable);

      const currentArray = {
      };

      for (const column of columns) {
        const formattedColumn = getFormattedColumn(column);

        if (!formattedColumn) continue;
        
        currentArray[formattedColumn] = gradesRecord[column] / SUM;
      }

      // Get the keys and sort them
      const sortedKeys = Object.keys(currentArray).sort();

      // Create a new object with the sorted keys
      const sortedObject = {};
      for (const key of sortedKeys) {
        sortedObject[key] = currentArray[key];
      }

      const newArray = {
        Pos: position,
        Archetype: archetype,
        DesiredHigh: desiredHigh,
        DesiredLow: desiredLow,
      };

      for (const key of sortedKeys) {
        newArray[key] = sortedObject[key];
      }

      newArray['Sum'] = SUM;

      finalArray.push(newArray);
    }

    // Sort finalArray by position
    finalArray.sort((a, b) => {
        return POSITION_ORDER.indexOf(a.Pos) - POSITION_ORDER.indexOf(b.Pos);
    });

    await convertArrayToJSONFile(finalArray,'ovrweights.json')
    
});