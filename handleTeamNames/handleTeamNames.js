const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const FranchiseUtils = require('../Utils/FranchiseUtils');
const prompt = require('prompt-sync')({ sigint: true });

const validGameYears = [FranchiseUtils.YEARS.M25];
console.log("This program will adjust team names based on historical changes.");

// Initialize franchise and tables
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

// Function to prompt user for season year
function promptForSeasonYear() {
  while (true) {
    const answer = prompt('Please enter the season year (e.g., 2024): ');
    const year = parseInt(answer);
    if (isNaN(year) || year < 1969 || year > 2024) {
      console.log('Invalid year. Please enter a year between 1969 and 2024.');
      continue;
    }
    return year;
  }
}

// Function to prompt user about Washington team name
function promptForWashingtonName() {
  while (true) {
    const answer = prompt('Would you like to update the Washington team name from "Redskins" to "Commanders" for seasons prior to 2019? (yes/no): ');
    const response = answer.toLowerCase().trim();
    if (response === 'yes' || response === 'y') {
      return true;
    } else if (response === 'no' || response === 'n') {
      return false;
    }
    console.log('Please answer with "yes" or "no".');
  }
}

const teamNameChanges = {
  // Example format: 'team index': [{year range, column, new value}]
  '5': [
    { yearStart: 1996, yearEnd: 1998, column: 'LongName', value: 'Inactive' },
    { yearStart: 1996, yearEnd: 1998, column: 'DisplayName', value: 'Team' },
    { yearStart: 1999, yearEnd: null, column: 'LongName', value: 'Cleveland' },
    { yearStart: 1999, yearEnd: null, column: 'DisplayName', value: 'Browns' }
  ],
  '6': [
    { yearStart: 1969, yearEnd: 1975, column: 'LongName', value: 'Inactive' },
    { yearStart: 1969, yearEnd: 1975, column: 'DisplayName', value: 'Team' },
    { yearStart: 1976, yearEnd: null, column: 'LongName', value: 'Tampa Bay' },
    { yearStart: 1976, yearEnd: null, column: 'DisplayName', value: 'Buccaneers' }
  ],
  '7': [
    { yearStart: 1969, yearEnd: 1987, column: 'LongName', value: 'St.Louis' },
    { yearStart: 1969, yearEnd: 1987, column: 'ShortName', value: 'STL' },
    { yearStart: 1988, yearEnd: 1993, column: 'LongName', value: 'Phoenix' },
    { yearStart: 1988, yearEnd: 1993, column: 'ShortName', value: 'PHX' },
    { yearStart: 1994, yearEnd: null, column: 'LongName', value: 'Arizona' },
    { yearStart: 1994, yearEnd: null, column: 'ShortName', value: 'ARI' }
  ],
  '10': [
    { yearStart: 1969, yearEnd: 2016, column: 'LongName', value: 'San Diego' },
    { yearStart: 1969, yearEnd: 2016, column: 'ShortName', value: 'SD' },
    { yearStart: 2017, yearEnd: null, column: 'LongName', value: 'Los Angeles' },
    { yearStart: 2017, yearEnd: null, column: 'ShortName', value: 'LAC' }
  ],
  '12': [
    { yearStart: 1969, yearEnd: 1983, column: 'LongName', value: 'Baltimore' },
    { yearStart: 1969, yearEnd: 1983, column: 'ShortName', value: 'BAL' },
    { yearStart: 2017, yearEnd: null, column: 'LongName', value: 'Indianapolis' },
    { yearStart: 2017, yearEnd: null, column: 'ShortName', value: 'IND' }
  ],
  '13': [
    { yearStart: 1969, yearEnd: 2019, column: 'DisplayName', value: 'Redskins' },
    { yearStart: 2020, yearEnd: 2021, column: 'DisplayName', value: 'Football Team' },
    { yearStart: 2022, yearEnd: null, column: 'DisplayName', value: 'Commanders' }
  ],
  '21': [
    { yearStart: 1969, yearEnd: 1994, column: 'LongName', value: 'Inactive' },
    { yearStart: 1969, yearEnd: 1994, column: 'DisplayName', value: 'Team' },
    { yearStart: 1995, yearEnd: null, column: 'LongName', value: 'Jacksonville' },
    { yearStart: 1995, yearEnd: null, column: 'DisplayName', value: 'Jaguars' }
  ],
  '26': [
    { yearStart: 1969, yearEnd: 1994, column: 'LongName', value: 'Inactive' },
    { yearStart: 1969, yearEnd: 1994, column: 'DisplayName', value: 'Team' },
    { yearStart: 1995, yearEnd: null, column: 'LongName', value: 'Carolina' },
    { yearStart: 1995, yearEnd: null, column: 'DisplayName', value: 'Panthers' }
  ],
  '28': [
    { yearStart: 1969, yearEnd: 1981, column: 'LongName', value: 'Oakland' }, // Oakland Raiders (City)
    { yearStart: 1969, yearEnd: 1981, column: 'ShortName', value: 'OAK' },  //Abbreviation
    { yearStart: 1982, yearEnd: 1994, column: 'LongName', value: 'Los Angeles' }, //Los Angeles Raiders (City)
    { yearStart: 1982, yearEnd: 1994, column: 'ShortName', value: 'RAI' },  // Abbreviation
    { yearStart: 1995, yearEnd: 2019, column: 'LongName', value: 'Oakland' }, // Oakland Raiders (City)
    { yearStart: 1995, yearEnd: 2019, column: 'ShortName', value: 'OAK' },  //Abbreviation
    { yearStart: 2020, yearEnd: null, column: 'LongName', value: 'Las Vegas' }, // Oakland Raiders (City)
    { yearStart: 2020, yearEnd: null, column: 'ShortName', value: 'LV' }  //Abbreviation
  ],
  '29': [
    { yearStart: 1969, yearEnd: 1994, column: 'LongName', value: 'Los Angeles' },
    { yearStart: 1969, yearEnd: 1994, column: 'ShortName', value: 'RAM' },
    { yearStart: 1995, yearEnd: 2015, column: 'LongName', value: 'St. Louis' },
    { yearStart: 1995, yearEnd: 2015, column: 'ShortName', value: 'STL' },
    { yearStart: 2016, yearEnd: null, column: 'LongName', value: 'Los Angeles' },
    { yearStart: 2016, yearEnd: null, column: 'ShortName', value: 'LAR' }
  ],
  '30': [
    { yearStart: 1969, yearEnd: 1995, column: 'LongName', value: 'Inactive' },
    { yearStart: 1969, yearEnd: 1995, column: 'DisplayName', value: 'Team' },
    { yearStart: 1996, yearEnd: null, column: 'LongName', value: 'Baltimore' },
    { yearStart: 1996, yearEnd: null, column: 'DisplayName', value: 'Ravens' }
  ],
  '32': [
    { yearStart: 1969, yearEnd: 1975, column: 'LongName', value: 'Inactive' },
    { yearStart: 1969, yearEnd: 1975, column: 'DisplayName', value: 'Team' },
    { yearStart: 1976, yearEnd: null, column: 'LongName', value: 'Seattle' },
    { yearStart: 1976, yearEnd: null, column: 'DisplayName', value: 'Seahawks' }
  ],
  '34': [
    { yearStart: 1969, yearEnd: 2001, column: 'LongName', value: 'Inactive' },
    { yearStart: 1969, yearEnd: 2001, column: 'DisplayName', value: 'Team' },
    { yearStart: 2002, yearEnd: null, column: 'LongName', value: 'Houston' },
    { yearStart: 2002, yearEnd: null, column: 'DisplayName', value: 'Texans' }
  ],
  '35': [
    { yearStart: 1969, yearEnd: 1996, column: 'LongName', value: 'Houston' },
    { yearStart: 1969, yearEnd: 1996, column: 'ShortName', value: 'HOU' },
    { yearStart: 1969, yearEnd: 1998, column: 'DisplayName', value: 'Oilers' },
    { yearStart: 1997, yearEnd: null, column: 'LongName', value: 'Tennessee' },
    { yearStart: 1997, yearEnd: null, column: 'ShortName', value: 'TEN' },
    { yearStart: 1999, yearEnd: null, column: 'DisplayName', value: 'Titans' }
  ],
};

// This function will return the correct name based on the year
function getTeamNameChange(record, seasonYear, changes) {
  if (!changes || !Array.isArray(changes)) return null;
  
  for (const change of changes) {
    const { yearStart, yearEnd, column, value } = change;
    
    // If `yearEnd` is null, it means the change is ongoing
    if (seasonYear >= yearStart && (yearEnd === null || seasonYear <= yearEnd)) {
      return { column, value };
    }
  }
  
  return null;
}

franchise.on('ready', async function () {
  const teamTable = franchise.getTableByUniqueId(tables.teamTable);
  
  await FranchiseUtils.readTableRecords([teamTable]);
  
  // Get season year from user input
  const seasonYear = promptForSeasonYear();
  console.log(`Using season year: ${seasonYear}`);
  
  // Special handling for Washington team name
  let updateWashingtonName = false;
  if (seasonYear < 2019) {
    updateWashingtonName = promptForWashingtonName();
  }
  
  // Iterate over team records to update based on year
  teamTable.records
  .filter(record => !record.isEmpty && record.TEAM_VISIBLE)
  .forEach(record => {
    const teamIndex = record.index.toString();
    
    if (teamNameChanges.hasOwnProperty(teamIndex)) {
      const changes = teamNameChanges[teamIndex];

      // Special handling for Washington team (index 13)
      if (teamIndex === '13' && updateWashingtonName && seasonYear < 2019) {
        const change = { column: 'DisplayName', value: 'Commanders' };
        if (record[change.column] !== change.value) {
          console.log(`Updating ${record.LongName} (${record.ShortName}) - ${record.DisplayName}: Setting ${change.column} to ${change.value}`);
          record[change.column] = change.value;
        }
        return; // Skip the regular changes for this team
      }

      // Loop through all the changes for the current team
      changes.forEach(change => {
        const { yearStart, yearEnd, column, value } = change;

        // Check if the current season year falls within the specified range
        if (seasonYear >= yearStart && (yearEnd === null || seasonYear <= yearEnd)) {
          // Update the record only if the value is different
          if (record[column] !== value) {
            console.log(`Updating ${record.LongName} (${record.ShortName}) - ${record.DisplayName}: Setting ${column} to ${value}`);
            record[column] = value;
          }
        }
      });
    }
  });

  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Team names updated successfully.");
  FranchiseUtils.EXIT_PROGRAM();
});
