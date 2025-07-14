



const FranchiseUtils = require('../Utils/FranchiseUtils');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');

const validGameYears = Object.values(FranchiseUtils.YEARS);
const gameYear = FranchiseUtils.getGameYear(validGameYears);

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,false,true);
const tables = FranchiseUtils.getTablesObject(franchise);

// Function I used to manually get certain data from FTC tables into an array, can be modified to be used however you want
async function getFtcReferences() {

  const currentTable = franchise.getTableByUniqueId(tables.stadiumFtcTable); // Change this to match whatever table you want
  await currentTable.readRecords();
  const currentTableId = currentTable.header.tableId //Table ID
  let finalArray = [];

  const allAssets = franchise.assetTable; //Get all available assets and their references

  for (const record of currentTable.records) {
    
    const binReference = getBinaryReferenceData(currentTableId,record.index) 
    const assetReference = FranchiseUtils.bin2Dec(binReference) //This will match up with the reference in the assetTable
  
    const assetId = allAssets.find(obj => obj.reference === assetReference)?.assetId; //This finds our desired assetId
    const finalBin = FranchiseUtils.dec2bin(assetId, 2); // Convert to binary
    const columns = FranchiseUtils.getColumnNames(currentTable);
    const updatedJson = {};

    updatedJson.Row = record.index;
    updatedJson.AssetId = assetId;
    updatedJson.Binary = finalBin;

    for (const column of columns) {      
      updatedJson[column] = record[column];
    }
    
    
    finalArray.push(updatedJson);
  }
  return finalArray

}

franchise.on('ready', async function () {
  const json = await getFtcReferences();
  // Convert array to JSON string
  const tableRefs = JSON.stringify(json, null, 4); // `null, 2` formats the JSON nicely

  // Write the JSON string to a file
  fs.writeFileSync('output.json', tableRefs, 'utf8');
  
  FranchiseUtils.EXIT_PROGRAM();
});