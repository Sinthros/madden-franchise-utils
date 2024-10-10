const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program will generate lookups for coaches between different franchise files.");

const sourceFranchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});
const targetFranchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    const sourceCoachTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.coachTable);
    const targetCoachTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.coachTable);
    await FranchiseUtils.readTableRecords([sourceCoachTable, targetCoachTable]);
    
    const coaches = targetCoachTable.records.filter(record => !record.isEmpty);
    const sourceCoaches = sourceCoachTable.records.filter(record => !record.isEmpty);

    const matchingCoachesDictionary = {};
    
    for (const coach of coaches) {
      const fullName = `${coach.FirstName} ${coach.LastName}`;
      const formattedName = FranchiseUtils.removeSuffixes(fullName);
    
      const matchingCoach = sourceCoachTable.records.find(sourceCoach => {
        const sourceFullName = `${sourceCoach.FirstName} ${sourceCoach.LastName}`;
        const sourceFormattedName = FranchiseUtils.removeSuffixes(sourceFullName);
        return sourceFormattedName === formattedName && !sourceCoach.isEmpty;
      });
    
      if (matchingCoach) {
        // Add the matching coaches asset name as a key in the dictionary
        matchingCoachesDictionary[FranchiseUtils.removeSuffixes(`${matchingCoach.FirstName} ${matchingCoach.LastName}`)] = {
          AssetName: coach.AssetName,
          PresentationId: coach.PresentationId,
          Portrait: coach.Portrait,
          GenericHeadAssetName: coach.GenericHeadAssetName,
        };
      }
    }

    for (const coach of sourceCoaches) {
      const name = FranchiseUtils.removeSuffixes(`${coach.FirstName} ${coach.LastName}`);
      if (!matchingCoachesDictionary[name]) {
        matchingCoachesDictionary[name] = {
          AssetName: "",
          PresentationId: 32767,
          Portrait: 0,
          GenericHeadAssetName: "",
        };
      }
    }

    console.log(matchingCoachesDictionary)
    // Convert the dictionary to a JSON string
    const jsonContent = JSON.stringify(matchingCoachesDictionary, null, 2); // The `null, 2` is for pretty-printing with 2 spaces

    // Write the JSON string to a file
    fs.writeFileSync('matchingCoaches.json', jsonContent, 'utf8', (err) => {
      if (err) {
        console.log('An error occurred while writing JSON to file:', err);
        return;
      }
      console.log('JSON file has been saved.');
    });

    FranchiseUtils.EXIT_PROGRAM();
  });
})


