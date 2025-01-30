



const FranchiseUtils = require('../Utils/FranchiseUtils');
const { tables } = require('../Utils/FranchiseTableId');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');

const signatureAbilities = {
    WRSignatureAbilities: {},
    TESignatureAbilities: {},
    QBSignatureAbilities: {},
    OLSignatureAbilities: {},
    OLBSignatureAbilities: {},
    MLBSignatureAbilities: {},
    K_PSignatureAbilities: {},
    HBSignatureAbilities: {},
    FS_SSSignatureAbilities: {},
    FBSignatureAbilities: {},
    DTSignatureAbilities: {},
    DESignatureAbilities: {},
    CBSignatureAbilities: {},
  };


const gameYear = FranchiseUtils.YEARS.M25;

const franchise = FranchiseUtils.selectFranchiseFile(gameYear,false,true);



// Function I used to manually get certain data from FTC tables into an array, can be modified to be used however you want
async function getFtcReferences() {

    const currentTable = franchise.getTableById(603); // Whatever table you're working with
                                                                                // Change to getTableByUniqueId if using
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

franchise.on('ready', async function () {
    //const json = await getFtcReferences();
    // Convert array to JSON string
//const teamIdentityStr = JSON.stringify(json, null, 2); // `null, 2` formats the JSON nicely

// Write the JSON string to a file
//fs.writeFileSync('output.json', teamIdentityStr, 'utf8');
//process.exit(0)

    const SignatureAbilitesTable = franchise.getTableByUniqueId(tables.signatureAbilitesFtcTable);
    const SignatureByPosition = franchise.getTableByUniqueId(tables.signatureByPositionFtcTable);

    const gameYear = franchise.schema.meta.gameYear;

    const positionSigArrayId = gameYear === FranchiseUtils.YEARS.M25 
    ? tables.positionSignatureAbilityArrayFtcTableM25 : tables.positionSignatureAbilityArrayFtcTableM24;

    const PositionSignatureAbilityArray = franchise.getTableByUniqueId(positionSigArrayId);
    const PositionSignatureAbility = franchise.getTableByUniqueId(tables.positionSignatureAbilityFtcTable);
    const SignatureAbility = franchise.getTableByUniqueId(tables.signatureAbilityFtcTable);

    const PositionSignatureAbilityTableId = PositionSignatureAbility.header.tableId //Table ID

    await FranchiseUtils.readTableRecords([
      SignatureAbilitesTable,
      SignatureByPosition,
      PositionSignatureAbilityArray,
      PositionSignatureAbility,
      SignatureAbility
  ]);
    const allAssets = franchise.assetTable; //Get all available assets and their references

    for (const key in signatureAbilities) {
        const xFactorAbilityIndices = [];
        const allAbilityIndices = [];
        const currentPositionBinary = SignatureAbilitesTable.records[0][key];
        const rowRef = FranchiseUtils.bin2Dec(currentPositionBinary.slice(15));

        const activeSignaturesBin = SignatureByPosition.records[rowRef]['ActiveSignatures']
        const passiveSignaturesBin = SignatureByPosition.records[rowRef]['PassiveSignatures']
        
        if (activeSignaturesBin !== FranchiseUtils.ZERO_REF) {
            signatureAbilities[key].XFactorAbilities = [];
            const activeSignaturesRowRef = FranchiseUtils.bin2Dec(activeSignaturesBin.slice(15));
            for (let i = 0;i < PositionSignatureAbilityArray.header.recordCapacity;i++) {
                const currentPosSigAbility = PositionSignatureAbilityArray.records[activeSignaturesRowRef][`PositionSignatureAbility${i}`];
                if (currentPosSigAbility !== FranchiseUtils.ZERO_REF) {
                    const currentPosSigAbilityRow = FranchiseUtils.bin2Dec(currentPosSigAbility.slice(15));
                    const abilityBin = PositionSignatureAbility.records[currentPosSigAbilityRow]['Ability'];
                    const abilityBinRow = FranchiseUtils.bin2Dec(abilityBin.slice(15));
                    xFactorAbilityIndices.push(abilityBinRow);
                    allAbilityIndices.push({ [currentPosSigAbilityRow]: abilityBinRow });
                }
            }
        }

        if (passiveSignaturesBin !== FranchiseUtils.ZERO_REF) {
            signatureAbilities[key].SuperStarAbilities = [];
            const passiveSignaturesRowRef = FranchiseUtils.bin2Dec(passiveSignaturesBin.slice(15));
            for (let i = 0;i < PositionSignatureAbilityArray.header.numMembers;i++) {
                const currentPosSigAbility = PositionSignatureAbilityArray.records[passiveSignaturesRowRef][`PositionSignatureAbility${i}`];
                if (currentPosSigAbility !== FranchiseUtils.ZERO_REF) {
                    const currentPosSigAbilityRow = FranchiseUtils.bin2Dec(currentPosSigAbility.slice(15));
                    const abilityBin = PositionSignatureAbility.records[currentPosSigAbilityRow]['Ability'];
                    const abilityBinRow = FranchiseUtils.bin2Dec(abilityBin.slice(15));
                    allAbilityIndices.push({ [currentPosSigAbilityRow]: abilityBinRow });

                }
            }

        }


        for (const abilityIndexObject of allAbilityIndices) {
          for (const abilityIndex in abilityIndexObject) {
            const value = abilityIndexObject[abilityIndex];
            let abilityType = 'SuperStarAbilities'
            if (xFactorAbilityIndices.includes(value)) {
                abilityType = 'XFactorAbilities';
            }
            const abilityName = SignatureAbility.records[value]['Name'];

            const abilityGuid = SignatureAbility.records[value]['GUID'];
            const abilityDescription = SignatureAbility.records[value]['Description'];
            
            const binReference = getBinaryReferenceData(PositionSignatureAbilityTableId,abilityIndex) 
            const assetReference = FranchiseUtils.bin2Dec(binReference) //This will match up with the reference in the assetTable

            const assetId = allAssets.find(obj => obj.reference === assetReference)?.assetId; //This finds our desired assetId
            const finalBin = FranchiseUtils.dec2bin(assetId,2) //Convert to binary

            
            const updatedJson = { 
                'Ability': abilityName,
                'GUID': abilityGuid,
                'Description': abilityDescription,
                'binaryReference': finalBin,
                'assetId': assetId,
                'assetBinReference': assetReference
               };

            signatureAbilities[key][abilityType].push(updatedJson)


        }
      }

    }
    const jsonString = JSON.stringify(signatureAbilities, null, 2);
    //console.log(jsonString);
    await convertArrayToJSONFile(signatureAbilities,'abilities.json')
    
    
});