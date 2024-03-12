




// Requirements
const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const fs = require('fs');
const teamLookup = JSON.parse(fs.readFileSync('teamLookup.json', 'utf8'));

const REGULAR_SEASON_WEEKS = 18;
const PRESEASON_WEEKS = 4;
const VALID_WEEK_TYPES = ['RegularSeason','OffSeason'];
const ZERO_REF = '00000000000000000000000000000000';
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');

//9:30 AM, 1:00 PM, 4:05 PM, 4:25 PM, 7:10 PM, 8:15 PM, 8:20 PM, 10:20 PM
const MADDEN_TIMES = [570,780,965,985,1150,1215,1220,1340];

function convertTimeToMinutes(timeString) {
  const match = timeString.match(/(\d+:\d+)\s*([APMapm]{2})/);
  if (!match) {
    console.error(`Invalid time format: ${timeString}`);
    return null; // or handle the error accordingly
  }

  const [_, time, period] = match;
  const [hour, minute] = time.split(':');

  let hours = parseInt(hour);
  const isPM = (period.toLowerCase() === 'pm');

  if (isPM && hours !== 12) {
    // Convert 12-hour PM to 24-hour format
    hours += 12;
  } else if (!isPM && hours === 12) {
    // Convert 12-hour AM to 24-hour format
    hours = 0;
  }

  const minutesAfterMidnight = hours * 60 + parseInt(minute);
  return minutesAfterMidnight;
}

function getDayOfWeek(day) {
  if (day === 'Sun') {
    return 'Sunday'
  }
  else if (day === 'Thu' || day === 'Thur') {
    return 'Thursday';
  }
  else if (day === 'Sat') {
    return 'Saturday';
  }
  else if (day === 'Mon') {
    return 'Monday';
  }
  else if (day === 'Tue') {
    return 'Tuesday';
  }
  else if (day === 'Wed') {
    return 'Wednesday';
  }
  else if (day === 'Fri') {
    return 'Friday';
  }
  else {
    return 'Sunday';
  }
}

function getTeamRow(teamName) {
  for (const key in teamLookup) {
    if (teamLookup[key].includes(teamName)) {
      return parseInt(key, 10);
    }
  }
  return null; // Return null if the team name is not found
}

function findGameEventBinary(seasonRowBinary,gameEventTable) {
  for (let n = 0; n < gameEventTable.header.recordCapacity; n++) {
    if (!gameEventTable.records[n].isEmpty) {
      const seasonGameBin = gameEventTable.records[n]['SeasonGame'];
      if (seasonGameBin === seasonRowBinary) {
        return getBinaryReferenceData(gameEventTable.header.tableId, n);
      }
    }
  }
  return '';
};


function countTargetRowsWithSeasonWeekType(table) {
  return table.records.reduce((count, record) => {
    if (!record.isEmpty && (record['SeasonWeekType'] === "RegularSeason" && record['IsPractice'] === false) ||
    (record['SeasonWeekType'] === 'OffSeason')) {
      return count + 1;
    }
    return count;
  }, 0);
};


async function getAllStartOccurrences(targetFranchise) {
  const currentTimeTable = targetFranchise.getTableByUniqueId(tables.schedulerTable);
  const seasonInfoTable = targetFranchise.getTableByUniqueId(tables.seasonInfoTable);

  await currentTimeTable.readRecords();
  await seasonInfoTable.readRecords();

  const weekStartOccurrences = [];
  const preseasonStartOccurrences = [];

  const currentTime = currentTimeTable.records[0]['CurrentTime'];
  const currentWeek = seasonInfoTable.records[0]['CurrentWeek'];

  // Calculate the number of remaining preseason weeks
  const remainingPreseasonWeeks = PRESEASON_WEEKS - currentWeek;

  // Adjusted time for the start of preseason
  const preseasonAdjustedTime = currentTime - 122400;

  // Calculate start occurrences for preseason weeks
  for (let i = 0; i < PRESEASON_WEEKS; i++) {
    let startOccurrence;
    if (i < currentWeek) {
      startOccurrence = preseasonAdjustedTime - (604800 * (currentWeek - i));
    } else if (i === currentWeek) {
      startOccurrence = preseasonAdjustedTime;
    } else {
      startOccurrence = preseasonAdjustedTime + (604800 * (i - currentWeek));
    }

    preseasonStartOccurrences.push({ currentWeek: i, startOccurrence });
  }

  // Calculate start occurrences for regular season weeks
  const adjustedTime = currentTime - 122400 + (remainingPreseasonWeeks * 604800);
  for (let i = 0; i < REGULAR_SEASON_WEEKS; i++) {
    const startOccurrence = adjustedTime + (604800 * i);
    weekStartOccurrences.push({ currentWeek: i, startOccurrence });
  }

  return { weekStartOccurrences, preseasonStartOccurrences };
}



function resetGameRecordValues(record) {
  record.GameGoal = ZERO_REF;
  record.GameSetup = ZERO_REF;
  record.HomePlayerStatCache = ZERO_REF;
  record.HomeTeamStatCache = ZERO_REF;
  record.InjuryCache = ZERO_REF;
  record.AwayPlayerStatCache = ZERO_REF;
  record.AwayTeamStatCache = ZERO_REF;
  record.ScoringSummaries = ZERO_REF;
  record.Stadium = ZERO_REF;
  record.DayOfWeek = 'Sunday';
  record.TimeOfDay = 780;
  record.ChristmasFlag = false;
  record.NewYearsFlag = false;
  record.ThanksgivingFlag = false;
};

// This function looks at the current week games and reassigns them to the correct teams
// Since we only replace Regular Season games while in the PreSeason, this is not needed
async function processSeasonGameRequests(seasonGameRequest, pendingGames, franchiseUser, seasonGameTable) {
  for (let i = 0; i < seasonGameRequest.header.recordCapacity; i++) {
    if (seasonGameRequest.header.isEmpty) {
      continue;
    }

    const currentUser = seasonGameRequest.records[i]['Response'];
    let assignedSeasonGame = ZERO_REF;

    if (currentUser !== ZERO_REF) {
      const franchiseUserRow = await FranchiseUtils.bin2Dec(currentUser.slice(15));
      const userTeam = franchiseUser.records[franchiseUserRow]['Team'];

      if (userTeam !== ZERO_REF) {
        for (let j = 0; j < pendingGames.length; j++) {
          const currentGameRow = pendingGames[j];
          const { HomeTeam, AwayTeam } = seasonGameTable.records[currentGameRow];

          if (userTeam === HomeTeam || userTeam === AwayTeam) {
            assignedSeasonGame = getBinaryReferenceData(seasonGameTable.header.tableId, currentGameRow);
            break;
          }
        }
      }
      seasonGameRequest.records[i]['DefaultResponse'] = assignedSeasonGame;
    }
  }
};
  
async function processGame(game, seasonGameTable, weekStartOccurrences,numGamesHandled,seasonWeek, seasonGameNum,
  gameEventTable,schedulerTable,handledRows,teamTable) {
  const dayOfWeek = getDayOfWeek(game.day);
  const time = convertTimeToMinutes(game.time);
  const homeTeamRow = getTeamRow(game.homeTeam);
  const awayTeamRow = getTeamRow(game.awayTeam);

  const homeTeam = getBinaryReferenceData(teamTable.header.tableId, homeTeamRow);
  const awayTeam = getBinaryReferenceData(teamTable.header.tableId, awayTeamRow);


  if (typeof(homeTeam) === 'undefined' || typeof(awayTeam) === 'undefined') {
    console.log(`ERROR transferring over one of your source games. Please let Sinthros know immediately. Exiting program.`);
    prompt();
    process.exit(0);
  }


  for (let j = 0; j < seasonGameTable.header.recordCapacity; j++) {
    const record = seasonGameTable.records[j];

    const isRegularSeasonPractice = record.SeasonWeekType === 'RegularSeason' && record.IsPractice === true;

    if (!record.isEmpty && VALID_WEEK_TYPES.includes(record['SeasonWeekType']) && !handledRows.includes(j) && !(isRegularSeasonPractice)) {
      resetGameRecordValues(record);

      record.HomeTeam = homeTeam;
      record.AwayTeam = awayTeam;
      record.SeasonWeek = seasonWeek;
      record.SeasonGameNum = seasonGameNum;
      record.DayOfWeek = dayOfWeek;
      record.TimeOfDay = time;
      record.SeasonWeekType = 'RegularSeason';
      record.IsPractice = false;

      const seasonRowBinary = getBinaryReferenceData(seasonGameTable.header.tableId, j);
      const gameEventBinary = findGameEventBinary(seasonRowBinary, gameEventTable);

      schedulerTable.records
        .filter(record => !record.isEmpty && record['StartEvent'] === gameEventBinary)
        .forEach(record => {
    
          const result = weekStartOccurrences;
          const startOccurrence = result.find(item => item.currentWeek === seasonWeek);
          record['StartOccurrenceTime'] = startOccurrence.startOccurrence;
          // console.log(`${startOccurrence.startOccurrence}: ${SeasonWeek}`);
        });
      

      handledRows.push(j);
      numGamesHandled++;
      // Return the updated values
      return numGamesHandled;
    }
  }
};


async function convertSchedule(sourceScheduleJson, seasonGameTable, TOTAL_GAMES, targetFranchise) {

  console.log("Now working on inserting the schedule from your selected year over to your target Madden 24 Franchise file...");

  // Separate the assignment from the promise
  const [
    pendingSeasonGames,
    practiceEvalTable,
    seasonInfoTable,
    seasonGameRequest,
    franchiseUser,
    gameEventTable,
    schedulerTable,
    teamTable
  ] = await Promise.all([
    targetFranchise.getTableByUniqueId(tables.pendingSeasonGamesTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.practiceEvalTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.seasonInfoTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.seasonGameRequestTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.franchiseUserTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.gameEventTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.schedulerAppointmentTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.teamTable).readRecords()
  ]);

  const {weekStartOccurrences,preseasonStartOccurrences} = await getAllStartOccurrences(targetFranchise);

  
  const currentWeek = seasonInfoTable.records[0]['CurrentWeek'];
  const isLeagueStarted = seasonInfoTable.records[0]['IsLeagueStarted'];
  const practiceTeam = practiceEvalTable.records[0]['PracticeTeam'];

  const expectedWeeks = Array.from({ length: 18 }, (_, i) => i);
  const currentWeeksSet = new Set(weekStartOccurrences.map(entry => entry.currentWeek));
  const isValidWeeks = expectedWeeks.every(week => currentWeeksSet.has(week));
  
  if (!isValidWeeks) {
    console.log("ERROR! Failed to transfer the schedule from your source file to your target file.");
    console.log("This is because the program couldn't find any relevant data relating to certain Regular Season weeks in your Target file.");
    console.log("You can try using a different/fresh target file to transfer your data to if you want to try this process again.");
    console.log("Exiting function without transferring your schedule...");
    return;
  }


  const handledRows = [];

  var numGamesHandled = 0;
  const weeks = sourceScheduleJson.weeks;
  const totalGames = weeks.reduce((acc, week) => acc + week.games.length, 0);

  for (let i = 0; i < weeks.length && numGamesHandled < TOTAL_GAMES; i++) {
    const currentWeek = i; // Adjust week numbering as needed
    const week = weeks[i];

    for (let j = 0; j < week.games.length && numGamesHandled < TOTAL_GAMES; j++) {
      const game = week.games[j];
      const seasonGameNum = j;

        numGamesHandled = await processGame(
          game,
          seasonGameTable,
          weekStartOccurrences,
          numGamesHandled,
          currentWeek,
          seasonGameNum, // Use the index within the week's games array
          gameEventTable,
          schedulerTable,
          handledRows,
          teamTable
        );
    }
  }

  


  for (let i = 0; i < seasonGameTable.header.recordCapacity; i++) {
    if (
      !seasonGameTable.records[i].isEmpty && // Not empty
      !seasonGameTable.records[i]['IsPractice'] && // Not a practice game
      ['RegularSeason'].includes(seasonGameTable.records[i]['SeasonWeekType']) && // Is PreSeason/RegularSeason
      !handledRows.includes(i) //Hasn't already been handled
    ) {
      const record = seasonGameTable.records[i];
      resetGameRecordValues(record);
      record.HomeTeam = practiceTeam;
      record.AwayTeam = practiceTeam;
      record.SeasonGameNum = 0;
      record.SeasonWeekType = 'OffSeason';
      record.IsPractice = true;
    }
  }

  //await processSeasonGameRequests(seasonGameRequest, pendingGames, franchiseUser, seasonGameTable);
  
};

async function transferSchedule(sourceScheduleJson,targetFranchise) {

  const [
    seasonGameTable,
  ] = await Promise.all([
    targetFranchise.getTableByUniqueId(tables.seasonGameTable).readRecords()
  ]);

  const TOTAL_GAMES = countTargetRowsWithSeasonWeekType(seasonGameTable);
  // Initialize a counter for the total number of games
  let SOURCE_TOTAL_GAMES = 0;

  // Iterate over each season and accumulate the count of games
  sourceScheduleJson.weeks.forEach(week => {
    SOURCE_TOTAL_GAMES += week.games.length;
  });

  if (TOTAL_GAMES < SOURCE_TOTAL_GAMES) { //If too many reg season games, quit
    console.log("ERROR! Json file has too many Regular Season games.");
    console.log(`Your Json file has ${SOURCE_TOTAL_GAMES} Regular Season games and your target file has ${TOTAL_GAMES}. The schedule CANNOT be transferred.`);
    return false;
  }

  if (TOTAL_GAMES > SOURCE_TOTAL_GAMES) {
    console.log(`Your Json file has ${SOURCE_TOTAL_GAMES} Regular Season games and your target file has ${TOTAL_GAMES}.`);
    console.log("This will still be able to transfer over to your target franchise file.");
  }  
  
  await convertSchedule(sourceScheduleJson, seasonGameTable, TOTAL_GAMES, targetFranchise);
  return true;
};

module.exports = {
  transferSchedule
};
