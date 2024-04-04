



const Franchise = require('madden-franchise');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');
const path = require('path');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const coachTalentPositions = JSON.parse(fs.readFileSync(path.join(__dirname, '../lookupFunctions/JsonLookups/coach_talents_positions.json'), 'utf8'));
const coachTalentDependencies = JSON.parse(fs.readFileSync(path.join(__dirname, 'coach_talents_dependencies.json'), 'utf8'));
const ZERO_REF = '00000000000000000000000000000000';
const twoUpgradeTalentTrees = ['Staff Modifications','Trades','Offense Recruitment','Defense Recruitment'];
const threeUpgradeTalents = ['After School Tutoring'];
const nonUpgradableTalentTypes = ['Regular','Selection'];

const gamePrompt = '24';
const franchise = FranchiseUtils.selectFranchiseFile(gamePrompt,false,true);


function findMatchingTalent(talentTreeName) {
  for (const [key, value] of Object.entries(coachTalentPositions)) {
    for (const [talentLevel, talentArray] of Object.entries(value)) {
      if (talentArray.includes(talentTreeName)) {
        return { position: key, talentLevel: talentLevel };
      }
    }
  }
  return null; // Return null if talent tree is not found
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

    const talentTable = franchise.getTableByUniqueId(tables.talentFtcTable);
    const talentNodeTable = franchise.getTableByUniqueId(tables.talentNodeFtcTable);
    const talentNodeArrayTable = franchise.getTableByUniqueId(tables.talentNodeArrayFtcTable);
    const talentSubTreeTable = franchise.getTableByUniqueId(tables.talentSubTreeFtcTable);

    const finalArray = [];

    await FranchiseUtils.readTableRecords([
      talentTable,
      talentNodeTable,
      talentNodeArrayTable,
      talentSubTreeTable,
    ]);

    const subTreeTableId = talentSubTreeTable.header.tableId; // Table ID
    const allAssets = franchise.assetTable; // Get all available assets and their references
    
    for (let i = 0; i < talentSubTreeTable.header.recordCapacity; i++) {
      const record = talentSubTreeTable.records[i];
      const talentNodes = [];
      let treeIconId = null;
      const talentTreeName = record.Name;
      const talentNodeArrayBinary = record.OrderedTalentNodeList;
      const talentNodeArrayRow = await FranchiseUtils.bin2Dec(talentNodeArrayBinary.slice(15));
      const talentNodeArrayRecord = talentNodeArrayTable.records[talentNodeArrayRow];
    
      for (let j = 0; j < talentNodeArrayTable.header.numMembers; j++) {
        const talentNodeBinary = talentNodeArrayRecord[`TalentNode${j}`];
        if (talentNodeBinary === ZERO_REF) {
          continue;
        }
        const talentNodeRow = await FranchiseUtils.bin2Dec(talentNodeBinary.slice(15));
        const talentNodeRecord = talentNodeTable.records[talentNodeRow];
        const talentRow = await FranchiseUtils.bin2Dec(talentNodeRecord.Talent.slice(15));
        const talentRecord = talentTable.records[talentRow];

        // If a non-upgradable type, set maxUpgrades to 0. Else, if a 2-upgrade Talent Tree, set to 2. Else, set to 3.
        const maxUpgrades = nonUpgradableTalentTypes.includes(talentRecord.Behavior) ? 0 : (twoUpgradeTalentTrees.includes(talentTreeName) && !threeUpgradeTalents.includes(talentRecord.Name)) ? 2 : 3;

        talentNodes.push({
          Name: talentRecord.Name,
          Behavior: talentRecord.Behavior,
          IconId: talentRecord.IconId,
          Description: talentRecord.Description,
          maxUpgrades: maxUpgrades
        });
      }

      const matchingTalent = findMatchingTalent(talentTreeName);
      if (matchingTalent !== null) {
          talentNodes.forEach((talent, index) => {
            talent.Dependencies = [];
            talent.Exclusions = [];

            const lookupString = `${matchingTalent.talentLevel}${matchingTalent.position}`;

            const dependentTalents = coachTalentDependencies[lookupString]['dependencies'][index];
            const excludedTalents = coachTalentDependencies[lookupString]['exclusions'][index];
            treeIconId = coachTalentDependencies[lookupString]['treeIconId'];
            // Iterate over the keys of dependentTalents object
            for (const talentIndex of dependentTalents) {
              talent.Dependencies.push(talentNodes[talentIndex].Name)
            }
  
            for (const talentIndex of excludedTalents) {
              talent.Exclusions.push(talentNodes[talentIndex].Name)
            }        
          });

      }
    
      const binReference = getBinaryReferenceData(subTreeTableId, i);
      const assetReference = await FranchiseUtils.bin2Dec(binReference);
    
      const assetId = allAssets.find(obj => obj.reference === assetReference)?.assetId;
      const finalBin = FranchiseUtils.dec2bin(assetId, 2);
    
      finalArray.push({
        [talentTreeName]: {
          binaryReference: finalBin,
          assetId: assetId,
          treeIconId: treeIconId,
          talents: talentNodes
          
        }
      });
    }
    

    await convertArrayToJSONFile(finalArray,'talentTreeData.json')
    
});