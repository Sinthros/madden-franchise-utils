// Required modules
const path = require('path');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../Utils/FranchiseUtils');
const autoUnempty = true;

// Binary values for international stadiums
const stadiumBinaryCodes = {
  "São Paulo":    "10000000100101011000111011110100", //São Paulo, Brazil
  "Tottenham Hotspur": "10000000000000011001001100110010", // London, England
  "Wembley":      "10000000000000001001110001001010", //London, England
  "Allianz Arena":"10000000010110110110010110100100", //Munich, Germany
  "Frankfurt":    "10000000000000011111111111111111", // Frankfurt, Germany (Deustche Bank Park)
  "Estadio Azteca": "10000000000000001111011001011101" //Azteca, Mexico
};

// Per-year stadium assignment mapping
const stadiumAssignmentsByYear = {
  2005: {
    3:  [ null, null, null, null, null, null, null, null, null, null, null, null, { stadium: "Estadio Azteca" } ] // Week 4 Game 5 (Mexico City) Cardinals vs 49ers
  },
  2007: {
    7:  [ null, null, null, null, { stadium: "Wembley" } ] // Week 8 Game 5 (London) Giants vs Dolphins
  },
  2008: {
    7:  [ null, null, null, null, null, null, null, null,  { stadium: "Wembley" } ] // Week 8 Game 9 (London) Saints vs Chargers
  },
  2009: {
    6:  [ null, null, null, null, null, { stadium: "Wembley" } ] // Week 7 Game 6 (London) Patriots vs Bucs
  },
  2010: {
    7:  [ null, null, null, null, null, { stadium: "Wembley" } ] // Week 8 Game 6 (London) 49ers vs Broncos
  },
  2011: {
    6:  [ null, null, null, null, null, null, { stadium: "Wembley" } ] // Week 7 Game 7 (London) Bears vs Bucs
  },
  2012: {
    7:  [ null, null, null, null, null, null, null, null, null, { stadium: "Wembley" } ] // Week 8 Game 10 (London) Patriots vs Rams
  },
  2013: {
    3:  [ null, null, null, null, null, null, null, null,  { stadium: "Wembley" } ], // Week 4 Game 9 (London) Steelers vs Vikings
    7:  [ null, null, null, null, null, { stadium: "Wembley" } ] // Week 8 Game 6 (London) 49ers vs Jags
  },
  2025: {
    0:  [ null, { stadium: "São Paulo" } ],
    4:  [ null, { stadium: "Tottenham Hotspur" } ],
    5:  [ null, { stadium: "Tottenham Hotspur" } ],
    6:  [ null, { stadium: "Wembley" } ],
    9:  [ null, { stadium: "Frankfurt" } ]
  }
};

console.log("This program assigns international stadiums to retro regular season games.");
console.log(" Only run during Regular Season period. Supported: Madden 25 Franchise Files.");

// Set up franchise file
const validGameYears = [
  FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGameYears, {
  isAutoUnemptyEnabled: autoUnempty
});
const tables = FranchiseUtils.getTablesObject(franchise);

async function promptForSeasonYear(minYear = 2005, maxYear = 2025) {
  while (true) {
    const input = prompt(`Enter the season year for stadium assignment (${minYear}-${maxYear}): `);
    const year = parseInt(input, 10);
    if (!isNaN(year) && year >= minYear && year <= maxYear) return year;
    console.log("Invalid year. Try again.");
  }
}

franchise.on('ready', async () => {
const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
  await seasonInfoTable.readRecords();
  const currentStage = seasonInfoTable.records[0].CurrentStage;
  console.log(`CurrentStage = "${currentStage}"`);

  // use the constant rather than a magic string
  if (currentStage !== FranchiseUtils.SEASON_STAGES.NFL_SEASON) {
    console.log("This tool can only be used during the Regular Season.");
    FranchiseUtils.EXIT_PROGRAM();
  }

  const seasonYear = await promptForSeasonYear();
  const yearAssignments = stadiumAssignmentsByYear[seasonYear];
  if (!yearAssignments) {
    console.log(`No stadium assignments found for year ${seasonYear}`);
    FranchiseUtils.EXIT_PROGRAM();
  }

  const scheduleTable = franchise.getTableByUniqueId(tables.seasonGameTable);
  if (!scheduleTable) {
    console.log("Could not locate the seasonGameTable.");
    FranchiseUtils.EXIT_PROGRAM();
  }
  await scheduleTable.readRecords();

  // only regular season (SeasonType === 1)
const seasonGames = scheduleTable.records.filter(g =>
  g.SeasonWeekType === 'RegularSeason' && g.IsPractice === false
  );
  if (seasonGames.length === 0) {
    console.log(" No regular season games found. Make sure your franchise is in the Regular Season stage.");
    FranchiseUtils.EXIT_PROGRAM();
  }

  console.log(`\n Assigning stadiums for ${seasonYear}...\n`);

  for (const [weekStr, games] of Object.entries(yearAssignments)) {
    const week = parseInt(weekStr, 10);
    for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
      const assignment = games[gameIndex];
      if (!assignment || !assignment.stadium) continue;

      const binary = stadiumBinaryCodes[assignment.stadium];
      if (!binary) {
        console.warn(` Unknown stadium: ${assignment.stadium}`);
        continue;
      }

      const game = seasonGames.find(g =>
        g.SeasonWeek === week &&
        g.SeasonGameNum=== gameIndex
      );

      if (!game) {
        console.warn(` Could not find Week ${week} Game ${gameIndex}`);  // ← fixed stray line break
        continue;
      }

      game.Stadium = binary;
      console.log(` Assigned ${assignment.stadium} → Week ${week}, Game ${gameIndex}`);
    }
  }

        // ask before saving
      const answer = prompt(
      "Would you like to save your changes? Enter yes to save, or no to quit without saving: ").trim().toLowerCase();

      if (answer === "yes") {
      await FranchiseUtils.saveFranchiseFile(franchise);
          console.log("\n💾 Stadium assignments saved successfully.");
      } else {
        console.log("\nYour franchise file has not been saved.");
      }

      // finally exit
      FranchiseUtils.EXIT_PROGRAM();
});