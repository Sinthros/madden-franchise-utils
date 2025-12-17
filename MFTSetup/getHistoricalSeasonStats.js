



const FranchiseUtils = require('../Utils/FranchiseUtils');

const gameYear = FranchiseUtils.YEARS.M26;

// This uses the franchise-seasonstats-binary.FTC file
const franchise = FranchiseUtils.init(gameYear, {isFtcFile: true, promptForBackup: false})

franchise.on('ready', async function () {
  const tableNames = [
    'SeasonOffensiveStats',
    'SeasonOffensiveKPReturnStats',
    'SeasonDefensiveStats',
    'SeasonDefensiveKPReturnStats',
    'SeasonKickingStats',
  ];

  const statTypeMap = {
    SeasonOffensiveStats: 'offensive',
    SeasonOffensiveKPReturnStats: 'offensiveKPReturn',
    SeasonDefensiveStats: 'defensive',
    SeasonDefensiveKPReturnStats: 'defensiveKPReturn',
    SeasonKickingStats: 'specialTeam',
  };

  const tables = tableNames.map(name => franchise.getTableByName(name));

  await FranchiseUtils.readTableRecords(tables);

  const options = { includeRow: false, includeAssetId: false, includeBinary: true };

  const allArrays = await Promise.all(
    tables.map(table => FranchiseUtils.getTableDataAsArray(franchise, table, options))
  );

  // Create a single object keyed by binary values instead of array of objects
  const combinedObject = {};

  allArrays.forEach((arr, index) => {
    const statType = statTypeMap[tableNames[index]];
    arr.forEach(({ Binary, ...data }) => {
      combinedObject[Binary] = { ...data, statType };
    });
  });

  // Save the combined object as JSON file
  FranchiseUtils.convertArrayToJSONFile(combinedObject, 'combinedSeasonStats.json');
});
