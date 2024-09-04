const fs = require('fs');
const FranchiseUtils = require('../Utils/FranchiseUtils');

const validGameYears = [
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25,
];

console.log("This program will generate lookups for rookies between different franchise files.");

const sourceFranchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});
const targetFranchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});

const SOURCE_TABLES = FranchiseUtils.getTablesObject(sourceFranchise);
const TARGET_TABLES = FranchiseUtils.getTablesObject(targetFranchise);

sourceFranchise.on('ready', async function () {
  targetFranchise.on('ready', async function () {

    const sourcePlayerTable = sourceFranchise.getTableByUniqueId(SOURCE_TABLES.playerTable);
    const targetPlayerTable = targetFranchise.getTableByUniqueId(TARGET_TABLES.playerTable);
    await FranchiseUtils.readTableRecords([sourcePlayerTable, targetPlayerTable]);
    
    const rookiePlayers = targetPlayerTable.records.filter(record => !record.isEmpty && record.YearsPro === 0 && record.ContractStatus !== FranchiseUtils.CONTRACT_STATUSES.NONE);
    const sourceRookiePlayers = sourcePlayerTable.records.filter(record => !record.isEmpty && record.YearsPro === 0 && record.ContractStatus !== FranchiseUtils.CONTRACT_STATUSES.NONE);

    const matchingPlayersDictionary = {};
    
    for (const player of rookiePlayers) {
      const fullName = `${player.FirstName} ${player.LastName}`;
      const formattedName = FranchiseUtils.removeSuffixes(fullName);
    
      const matchingPlayer = sourcePlayerTable.records.find(sourcePlayer => {
        const sourceFullName = `${sourcePlayer.FirstName} ${sourcePlayer.LastName}`;
        const sourceFormattedName = FranchiseUtils.removeSuffixes(sourceFullName);
        return sourceFormattedName === formattedName && !sourcePlayer.isEmpty && sourcePlayer.YearsPro === 0;
      });
    
      if (matchingPlayer) {
        // Add the matching player's asset name as a key in the dictionary
        matchingPlayersDictionary[matchingPlayer.PLYR_ASSETNAME] = {
          PLYR_ASSETNAME: player.PLYR_ASSETNAME,
          PresentationId: player.PresentationId,
          PLYR_COMMENT: player.PLYR_COMMENT,
          PLYR_PORTRAIT: player.PLYR_PORTRAIT,
          GenericHeadAssetName: player.GenericHeadAssetName,
        };
      }
    }

    for (const player of sourceRookiePlayers) {
      const assetName = player.PLYR_ASSETNAME;
      if (!matchingPlayersDictionary[assetName]) {
        matchingPlayersDictionary[assetName] = {
          PLYR_ASSETNAME: "",
          PresentationId: 32767,
          PLYR_PORTRAIT: 0,
          GenericHeadAssetName: "",
        };
      }
    }

    console.log(matchingPlayersDictionary)
    // Convert the dictionary to a JSON string
    const jsonContent = JSON.stringify(matchingPlayersDictionary, null, 2); // The `null, 2` is for pretty-printing with 2 spaces

    // Write the JSON string to a file
    fs.writeFileSync('matchingPlayers.json', jsonContent, 'utf8', (err) => {
      if (err) {
        console.log('An error occurred while writing JSON to file:', err);
        return;
      }
      console.log('JSON file has been saved.');
    });

    FranchiseUtils.EXIT_PROGRAM();
  });
})


