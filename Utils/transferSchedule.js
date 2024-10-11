




const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const zeroPad = (num, places) => String(num).padStart(places, '0')

const REGULAR_SEASON_WEEKS = 18;
const PRESEASON_WEEKS = 4;
const VALID_WEEK_TYPES = ['RegularSeason','PreSeason','OffSeason'];
const FranchiseUtils = require('./FranchiseUtils');
const { tables } = require('./FranchiseTableId');


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

function findStartOccurrence(gameEventBinary, i,schedulerTable,weekStartOccurrences) {
  for (let m = 0; m < schedulerTable.header.recordCapacity; m++) {
    if (!schedulerTable.records[m].isEmpty) {
      const startEvent = schedulerTable.records[m]['StartEvent'];
      if (startEvent === gameEventBinary) {
        //console.log(`${m}: ${i}: ${schedulerTable.records[m]['StartOccurrenceTime']}`)
        weekStartOccurrences.push({ currentWeek: i, startOccurrence: schedulerTable.records[m]['StartOccurrenceTime'] });
        return true; // Indicate that the week has been pushed
      }
    }
  }
  return false;
}

function countTargetRowsWithSeasonWeekType(table) {
  return table.records.reduce((count, record) => {
    if (!record.isEmpty && (record['SeasonWeekType'] === "PreSeason" && record['IsPractice'] === false) || (record['SeasonWeekType'] === "RegularSeason" && record['IsPractice'] === false) ||
    (record['SeasonWeekType'] === 'OffSeason')) {
      return count + 1;
    }
    return count;
  }, 0);
};

function countSourceRowsWithSeasonWeekType(table) {
  return table.records.reduce((count, record) => {
    if (!record.isEmpty && ((record['SeasonWeekType'] === "PreSeason" && record['IsPractice'] === false) || (record['SeasonWeekType'] === "RegularSeason" && record['IsPractice'] === false))) {
      return count + 1;
    }
    return count;
  }, 0);
};

async function handleOriginalCurrentTeamBin(currentTable, rows, currentCol) {
  const targetIndices = [
    // M22 has 68 team rows, M24 has 37. Here we manually reassign the indexes, where -1 = DON'T KEEP THE ROW
    0, 1, 2, 3, 4, 5, 6, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    10, 11, 12, 14, 15, 16, 17, 13, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 32, 33, 34, 35, 36
  ];

  let currentTeamBinVal = currentTable.records[rows][currentCol]; // Get currentBinVal

  const teamRowBinaryRef = currentTeamBinVal.slice(15);

  const actualRowRef = await FranchiseUtils.bin2Dec(teamRowBinaryRef);
  const targetRowRef = targetIndices[actualRowRef];

  const updatedBinaryRef = zeroPad(FranchiseUtils.dec2bin(targetRowRef), 17);

  const finalBinary = currentTeamBinVal.replace(teamRowBinaryRef, updatedBinaryRef);

  currentTable.records[rows][currentCol] = finalBinary;
}

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

async function processCurrentWeekPreseasonGame(
  sourceRecord,
  sourceSeasonGameTable,
  mergedTableMappings,
  seasonGameTable,
  pendingGameRow,
  i,
  is22To24
) {
  const { SeasonWeekType, SeasonWeek, SeasonGameNum, DayOfWeek, TimeOfDay, ChristmasFlag, NewYearsFlag, ThanksgivingFlag } =
    sourceRecord;

  if (is22To24) {
    await Promise.all([
      handleOriginalCurrentTeamBin(sourceSeasonGameTable, i, "HomeTeam"),
      handleOriginalCurrentTeamBin(sourceSeasonGameTable, i, "AwayTeam"),
    ]);
  }

  const { homeTeam, awayTeam } = replaceTeamNames(sourceRecord, mergedTableMappings);

  const record = seasonGameTable.records[pendingGameRow];

  resetGameRecordValues(record);

  // Update individual properties
  record.HomeTeam = homeTeam;
  record.AwayTeam = awayTeam;
  record.SeasonWeek = SeasonWeek;
  record.SeasonGameNum = SeasonGameNum;
  record.DayOfWeek = DayOfWeek;
  record.TimeOfDay = TimeOfDay;
  record.ChristmasFlag = ChristmasFlag;
  record.NewYearsFlag = NewYearsFlag;
  record.ThanksgivingFlag = ThanksgivingFlag;
  record.SeasonWeekType = SeasonWeekType;
  record.IsPractice = false;

  if (!record.HasBeenPublished) {
    resetGameStatusForUnpublishedGame(record);
  }

}

function replaceTeamNames(sourceRecord, mergedTableMappings) {
  let homeTeam = sourceRecord["HomeTeam"];
  let awayTeam = sourceRecord["AwayTeam"];

  const outputBin = zeroPad(FranchiseUtils.dec2bin(sourceRecord.fields["HomeTeam"]["referenceData"]["tableId"]), 15);
  const currentTableDict = mergedTableMappings.find((table) => table.sourceIdBinary === outputBin);

  if (!currentTableDict) {
    console.log(`This shouldn't happen, there's been an error. Please inform Sinthros immediately.`);
    return { homeTeam, awayTeam };
  }

  const replaceBin = currentTableDict.targetIdBinary;

  // Replace the outputBin with the currentDictValue
  homeTeam = homeTeam.replace(outputBin, replaceBin);
  awayTeam = awayTeam.replace(outputBin, replaceBin);

  return { homeTeam, awayTeam };
};

function resetGameRecordValues(record) {
  record.GameGoal = FranchiseUtils.ZERO_REF;
  record.GameSetup = FranchiseUtils.ZERO_REF;
  record.HomePlayerStatCache = FranchiseUtils.ZERO_REF;
  record.HomeTeamStatCache = FranchiseUtils.ZERO_REF;
  record.InjuryCache = FranchiseUtils.ZERO_REF;
  record.AwayPlayerStatCache = FranchiseUtils.ZERO_REF;
  record.AwayTeamStatCache = FranchiseUtils.ZERO_REF;
  record.ScoringSummaries = FranchiseUtils.ZERO_REF;
  record.Stadium = FranchiseUtils.ZERO_REF;
};

function resetGameStatusForUnpublishedGame(record) {
  if (record.HasBeenPublished === false) {
    record.IsSimmed = false;
    record.GameStatus = 'Unplayed';
  }
};

async function processSeasonGameRequests(seasonGameRequest, pendingGames, franchiseUser, seasonGameTable) {
  for (let i = 0; i < seasonGameRequest.header.recordCapacity; i++) {
    if (seasonGameRequest.header.isEmpty) {
      continue;
    }

    const currentUser = seasonGameRequest.records[i]['Response'];
    let assignedSeasonGame = FranchiseUtils.ZERO_REF;

    if (currentUser !== FranchiseUtils.ZERO_REF) {
      const franchiseUserRow = await FranchiseUtils.bin2Dec(currentUser.slice(15));
      const userTeam = franchiseUser.records[franchiseUserRow]['Team'];

      if (userTeam !== FranchiseUtils.ZERO_REF) {
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
  
async function processGame(sourceRecord, sourceSeasonGameTable,mergedTableMappings, seasonGameTable, weekStartOccurrences, preseasonStartOccurrences,numGamesHandled,i,
  gameEventTable,schedulerTable,is22To24,handledRows) {
  const { SeasonWeekType, SeasonWeek, SeasonGameNum, DayOfWeek, TimeOfDay, ChristmasFlag, NewYearsFlag, ThanksgivingFlag } = sourceRecord;

  if (is22To24) {
    await handleOriginalCurrentTeamBin(sourceSeasonGameTable, i, "HomeTeam");
    await handleOriginalCurrentTeamBin(sourceSeasonGameTable, i, "AwayTeam");
  }

  let homeTeam = sourceRecord["HomeTeam"];
  let awayTeam = sourceRecord['AwayTeam'];

  const outputBin = zeroPad(FranchiseUtils.dec2bin(sourceRecord.fields["HomeTeam"]["referenceData"]["tableId"]), 15);
  const currentTableDict = mergedTableMappings.find(table => table.sourceIdBinary === outputBin);

  if (!currentTableDict) {
    console.log(`ERROR transferring over one of your source games. Please let Sinthros know immediately.`);
    return numGamesHandled;
  }

  const replaceBin = currentTableDict.targetIdBinary;

  // Replace the outputBin with the currentDictValue
  homeTeam = homeTeam.replace(outputBin, replaceBin);
  awayTeam = awayTeam.replace(outputBin, replaceBin);

  for (let j = 0; j < seasonGameTable.header.recordCapacity; j++) {
    const record = seasonGameTable.records[j];

    const isPreSeasonPractice = record.SeasonWeekType === 'PreSeason' && record.IsPractice === true;
    const isRegularSeasonPractice = record.SeasonWeekType === 'RegularSeason' && record.IsPractice === true;

    if (!record.isEmpty && VALID_WEEK_TYPES.includes(record['SeasonWeekType']) && !handledRows.includes(j) && !(isPreSeasonPractice || isRegularSeasonPractice)) {
      resetGameRecordValues(record);

      record.HomeTeam = homeTeam;
      record.AwayTeam = awayTeam;
      record.SeasonWeek = SeasonWeek;
      record.SeasonGameNum = SeasonGameNum;
      record.DayOfWeek = DayOfWeek;
      record.TimeOfDay = TimeOfDay;
      record.ChristmasFlag = ChristmasFlag;
      record.NewYearsFlag = NewYearsFlag;
      record.ThanksgivingFlag = ThanksgivingFlag;
      record.SeasonWeekType = SeasonWeekType;
      record.IsPractice = false;

      const seasonRowBinary = getBinaryReferenceData(seasonGameTable.header.tableId, j);
      const gameEventBinary = findGameEventBinary(seasonRowBinary, gameEventTable);

      schedulerTable.records
        .filter(record => !record.isEmpty && record['StartEvent'] === gameEventBinary)
        .forEach(record => {
    
          const result = SeasonWeekType === 'PreSeason' ? preseasonStartOccurrences : weekStartOccurrences;
          const startOccurrence = result.find(item => item.currentWeek === SeasonWeek);
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

function shouldProcessGame(record, currentWeek, weekType,isLeagueStarted) {
  const isNotEmpty = !record.isEmpty;
  const isNotCurrentPreSeasonWeek = (!(record['SeasonWeek'] === currentWeek && record['SeasonWeekType'] === 'PreSeason') || !isLeagueStarted);
  const isNotPractice = !record['IsPractice'];
  const isValidWeekType = record['SeasonWeekType'] === weekType;
  return isNotEmpty && isNotCurrentPreSeasonWeek && isNotPractice && isValidWeekType;
};

async function convertSchedule(sourceSeasonGameTable, seasonGameTable, mergedTableMappings, TOTAL_GAMES,is22To24, targetFranchise) {

  console.log("Now working on converting the schedule from your source Franchise file over to your target Franchise file...");

  // Separate the assignment from the promise
  const [
    pendingSeasonGames,
    practiceEvalTable,
    seasonInfoTable,
    seasonGameRequest,
    franchiseUser,
    gameEventTable,
    schedulerTable,
  ] = await Promise.all([
    targetFranchise.getTableByUniqueId(tables.pendingSeasonGamesTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.practiceEvalTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.seasonInfoTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.seasonGameRequestTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.franchiseUserTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.gameEventTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.schedulerAppointmentTable).readRecords()
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

  const pendingGames = await Promise.all(
    Array.from({ length: pendingSeasonGames.header.recordCapacity }, (_, i) => i)
      .filter(i => !pendingSeasonGames.records[i].isEmpty)
      .map(async i => await FranchiseUtils.bin2Dec(pendingSeasonGames.records[i]['SeasonGame'].slice(15)))
  );
  

  let pendingGamesIndex = 0; // Initialize index for pendingGames

  for (let i = 0; i < sourceSeasonGameTable.header.recordCapacity && (pendingGamesIndex !== pendingGames.length); i++) {
    const record = sourceSeasonGameTable.records[i];
    
    const isNotEmpty = !record.isEmpty;
    const isPreSeasonWeek = record['SeasonWeekType'] === 'PreSeason';
    const isCurrentWeek = record['SeasonWeek'] === currentWeek;
    const isNotPractice = !record['IsPractice'];
  
    // Extract complex conditions into a separate variable or helper function if needed
    const shouldProcess = isNotEmpty && isPreSeasonWeek && isCurrentWeek && isNotPractice;
  
    if (shouldProcess) {

      const currentRow = pendingGames[pendingGamesIndex];
      await processCurrentWeekPreseasonGame(
        record,
        sourceSeasonGameTable,
        mergedTableMappings,
        seasonGameTable,
        currentRow,
        i,
        is22To24,
        handledRows
      );
  
      pendingGamesIndex++;
    }
  }
  
  handledRows.push(...pendingGames);
  numGamesHandled += pendingGames.length;

  for (let i = 0; i < sourceSeasonGameTable.header.recordCapacity && numGamesHandled < TOTAL_GAMES; i++) {
    const record = sourceSeasonGameTable.records[i];
  
    if (shouldProcessGame(record, currentWeek, 'RegularSeason',isLeagueStarted)) {
      numGamesHandled = await processGame(
        record,
        sourceSeasonGameTable,
        mergedTableMappings,
        seasonGameTable,
        weekStartOccurrences,
        preseasonStartOccurrences,
        numGamesHandled,
        i,
        gameEventTable,
        schedulerTable,
        is22To24,
        handledRows
      );
    }
  }
  
  for (let i = 0; i < sourceSeasonGameTable.header.recordCapacity && numGamesHandled < TOTAL_GAMES; i++) {
    const record = sourceSeasonGameTable.records[i];
  
    if (shouldProcessGame(record, currentWeek, 'PreSeason',isLeagueStarted)) {
      numGamesHandled = await processGame(
        record,
        sourceSeasonGameTable,
        mergedTableMappings,
        seasonGameTable,
        weekStartOccurrences,
        preseasonStartOccurrences,
        numGamesHandled,
        i,
        gameEventTable,
        schedulerTable,
        is22To24,
        handledRows
      );
    }
  }


  for (let i = 0; i < seasonGameTable.header.recordCapacity; i++) {
    if (
      !seasonGameTable.records[i].isEmpty && // Not empty
      !seasonGameTable.records[i]['IsPractice'] && // Not a practice game
      ['PreSeason', 'RegularSeason'].includes(seasonGameTable.records[i]['SeasonWeekType']) && // Is PreSeason/RegularSeason
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

  await processSeasonGameRequests(seasonGameRequest, pendingGames, franchiseUser, seasonGameTable);
  
};

async function transferSchedule(sourceFranchise,targetFranchise,mergedTableMappings) {

  const [
    sourceSeasonGameTable,
    seasonGameTable,
  ] = await Promise.all([
    sourceFranchise.getTableByUniqueId(tables.seasonGameTable).readRecords(),
    targetFranchise.getTableByUniqueId(tables.seasonGameTable).readRecords()
  ]);

  const sourceGameYear = sourceFranchise.schema.meta.gameYear // Get the game year of the source file
  const targetGameYear = targetFranchise.schema.meta.gameYear // Get the game year of the target file
  const is22To24 = sourceGameYear === FranchiseUtils.YEARS.M22 && targetGameYear === FranchiseUtils.YEARS.M24;

  const TOTAL_GAMES = countTargetRowsWithSeasonWeekType(seasonGameTable);
  const SOURCE_TOTAL_GAMES = countSourceRowsWithSeasonWeekType(sourceSeasonGameTable);

  if (TOTAL_GAMES < SOURCE_TOTAL_GAMES) { //If too many reg season games, quit
    console.log("ERROR! Source file has too many Regular Season games.");
    console.log(`Your source file has ${SOURCE_TOTAL_GAMES} Regular Season games and your target file has ${TOTAL_GAMES}. The schedule CANNOT be transferred.`);
    return
  }

  if (TOTAL_GAMES > SOURCE_TOTAL_GAMES) {
    console.log(`Your source file has ${SOURCE_TOTAL_GAMES} Regular Season games and your target file has ${TOTAL_GAMES}.`);
    console.log("This will still be able to transfer over to your target franchise file.");
  }  
  
  await convertSchedule(sourceSeasonGameTable, seasonGameTable, mergedTableMappings, TOTAL_GAMES, is22To24, targetFranchise);

};

module.exports = {
  transferSchedule
};
