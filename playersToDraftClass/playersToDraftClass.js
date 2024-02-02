




// Requirements
const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const path = require('path');
const os = require('os');
const fs = require('fs');
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const genericHeadLookup = JSON.parse(fs.readFileSync('genericHeadLookup.json', 'utf-8'));

console.log("In this program, you can convert a specific year of players in your Franchise File into Draft Class players.")
console.log("This should NOT be used on a file you intend to keep playing on. Make a backup of your file first, because it won't be able to be played after doing this.")
console.log("This will delete all current Draft Class players and replace them with up to 450 new Draft Class players in your file. Then, you'll go inside the franchise file and export the Draft Class.")
const gameYear = "24"

const franchise = FranchiseUtils.selectFranchiseFile(gameYear);

async function deleteCurrentDraftClass(franchise) {
  const playerTable = franchise.getTableByUniqueId(1612938518);
  const draftPlayerTable = franchise.getTableByUniqueId(786598926);
  const branchingStoryArray = franchise.getTableByUniqueId(4109008792);
  const draftBoardEvalArray = franchise.getTableByUniqueId(2939766573);
  const scoutFocusArray = franchise.getTableByUniqueId(249904460);
  const scoutPrivateArray = franchise.getTableByUniqueId(621078202);
  await playerTable.readRecords();
  await draftPlayerTable.readRecords();
  await branchingStoryArray.readRecords();
  await draftBoardEvalArray.readRecords();
  await scoutFocusArray.readRecords();
  await scoutPrivateArray.readRecords();


  const filteredRecords = playerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  const allDraftPlayers = filteredRecords.filter(record => record.ContractStatus === 'Draft') // Filter nonempty players for where they're draft class players

  allDraftPlayers.forEach((draftClassRecord) => { // For each DC player, mark as deleted and empty the row
    const rowIndex = playerTable.records.indexOf(draftClassRecord);
    playerTable.records[rowIndex]['ContractStatus'] = 'Deleted'; //Mark as deleted and empty the table
    playerTable.records[rowIndex].empty();
  });

  var draftTableArrayId = ""
  const draftFilteredRecords = draftPlayerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  for (const record of draftFilteredRecords) {
    const rowIndex = draftPlayerTable.records.indexOf(record);
    const referencedRow = franchise.getReferencesToRecord(draftPlayerTable.header.tableId, rowIndex);

    for (const table of referencedRow) {
      if (table.name === 'DraftPlayer[]') {
        const draftArrayTable = franchise.getTableById(table.tableId);
        await draftArrayTable.readRecords();
        if (draftArrayTable.header.recordCapacity === 1) {
          draftTableArrayId = table.tableId;
          break;
        }
      }
    }
    if (draftTableArrayId !== "") {
      break
    }
  }

  for (const record of draftFilteredRecords) {
    const rowIndex = draftPlayerTable.records.indexOf(record);
    draftPlayerTable.records[rowIndex]['DisabledPicks'] = '00000000000000000000000000000000';
    draftPlayerTable.records[rowIndex]['AudioQueue'] = '0';
    draftPlayerTable.records[rowIndex]['SurnameAudioID'] = '0';
    draftPlayerTable.records[rowIndex]['HasBranchingStory'] = false;
    draftPlayerTable.records[rowIndex]['IsVisible'] = false;
    draftPlayerTable.records[rowIndex]['ProDayThreeConeDrill'] = '0';
    draftPlayerTable.records[rowIndex]['ProDayTwentyYardShuttle'] = '0';
    draftPlayerTable.records[rowIndex]['ProDayVerticalJump'] = '0';
    draftPlayerTable.records[rowIndex]['CanScoutRegularSeason'] = false;
    draftPlayerTable.records[rowIndex]['CanScoutSeniorBowl'] = false;
    draftPlayerTable.records[rowIndex]['CombineTwentyYardShuttle'] = '0';
    draftPlayerTable.records[rowIndex]['CombineVerticalJump'] = '0';
    draftPlayerTable.records[rowIndex]['ProDayFortyYardDash'] = '0';
    draftPlayerTable.records[rowIndex]['CanScoutIndividualWorkouts'] = false;
    draftPlayerTable.records[rowIndex]['CanScoutProDays'] = false;
    draftPlayerTable.records[rowIndex]['CombineFortyYardDash'] = '0';
    draftPlayerTable.records[rowIndex]['CombineOverallGrade'] = '0';
    draftPlayerTable.records[rowIndex]['CombineThreeConeDrill'] = '0';
    draftPlayerTable.records[rowIndex]['DraftPosition'] = 'QB';
    draftPlayerTable.records[rowIndex]['ProDayBroadJump'] = '0';
    draftPlayerTable.records[rowIndex]['InitialDraftRank'] = '0';
    draftPlayerTable.records[rowIndex]['TrueOverallRanking'] = '0';
    draftPlayerTable.records[rowIndex]['CanScoutCombine'] = false;
    draftPlayerTable.records[rowIndex]['CombineBenchPress'] = '0';
    draftPlayerTable.records[rowIndex]['ProDayBenchPress'] = '0';
    draftPlayerTable.records[rowIndex]['ProductionGrade'] = '0';
    draftPlayerTable.records[rowIndex]['CombineBroadJump'] = '0';  
    draftPlayerTable.records[rowIndex].empty()
  }


  if (draftTableArrayId !== "") {
    const draftArrayTable = franchise.getTableById(draftTableArrayId)
    await draftArrayTable.readRecords();
  
    for (let draftRow = 0; draftRow < draftArrayTable.header.numMembers;draftRow++) {
      draftArrayTable.records[0][`DraftPlayer${draftRow}`] = "00000000000000000000000000000000"
    }
  }


  for (let branchRow = 0; branchRow < branchingStoryArray.header.numMembers;branchRow++) {
    branchingStoryArray.records[0][`BranchingStory${branchRow}`] = "00000000000000000000000000000000"
  }

  for (let i = 0; i < draftBoardEvalArray.header.recordCapacity;i++) {
      for (let draftRow = 0; draftRow < draftBoardEvalArray.header.numMembers;draftRow++) {
        draftBoardEvalArray.records[i][`DraftBoardPlayerEvaluation${draftRow}`] = "00000000000000000000000000000000"
      }
  }

  for (let i = 0; i < scoutFocusArray.header.recordCapacity;i++) {
      for (let draftRow = 0; draftRow < scoutFocusArray.header.numMembers;draftRow++) {
        scoutFocusArray.records[i][`DraftPlayer${draftRow}`] = "00000000000000000000000000000000"
      }
  }

  for (let i = 0; i < scoutPrivateArray.header.recordCapacity;i++) {
      for (let draftRow = 0; draftRow < scoutPrivateArray.header.numMembers;draftRow++) {
        scoutPrivateArray.records[i][`DraftPlayer${draftRow}`] = "00000000000000000000000000000000"
      }
  }

  return draftTableArrayId;

};

async function fillDraftPlayerRow(draftPlayerTable,index,draftPlayerRow,playerPosition,playerCommentId,currentBin,draftPick) {

  
  switch (playerPosition) {
    case "HB":
    case "FB":
      finalPosition = "RB";
      break;
    case "LT":
    case "RT":
      finalPosition = "OT";
      break;
    case "LG":
    case "C":
    case "RG":
      finalPosition = "IOL";
      break;
    case "LE":
    case "RE":
      finalPosition = "DE";
      break;
    case "LOLB":
    case "ROLB":
      finalPosition = "OLB";
      break;
    case "SS":
    case "FS":
      finalPosition = "S"
      break;
    default:
      finalPosition = playerPosition;
      break;
  }

  draftPlayerTable.records[draftPlayerRow]['Player'] = currentBin;
  draftPlayerTable.records[draftPlayerRow]['DisabledPicks'] = '00000000000000000000000000000000';
  draftPlayerTable.records[draftPlayerRow]['AudioQueue'] = '0';
  draftPlayerTable.records[draftPlayerRow]['SurnameAudioID'] = playerCommentId;
  draftPlayerTable.records[draftPlayerRow]['HasBranchingStory'] = false;
  draftPlayerTable.records[draftPlayerRow]['IsVisible'] = true;
  draftPlayerTable.records[draftPlayerRow]['ProDayThreeConeDrill'] = '0';
  draftPlayerTable.records[draftPlayerRow]['ProDayTwentyYardShuttle'] = '0';
  draftPlayerTable.records[draftPlayerRow]['ProDayVerticalJump'] = '0';
  draftPlayerTable.records[draftPlayerRow]['CanScoutRegularSeason'] = true;
  draftPlayerTable.records[draftPlayerRow]['CanScoutSeniorBowl'] = true;
  draftPlayerTable.records[draftPlayerRow]['CombineTwentyYardShuttle'] = '0';
  draftPlayerTable.records[draftPlayerRow]['CombineVerticalJump'] = '0';
  draftPlayerTable.records[draftPlayerRow]['ProDayFortyYardDash'] = '0';
  draftPlayerTable.records[draftPlayerRow]['CanScoutIndividualWorkouts'] = true;
  draftPlayerTable.records[draftPlayerRow]['CanScoutProDays'] = true;
  draftPlayerTable.records[draftPlayerRow]['CombineFortyYardDash'] = '0';
  draftPlayerTable.records[draftPlayerRow]['CombineOverallGrade'] = '0';
  draftPlayerTable.records[draftPlayerRow]['CombineThreeConeDrill'] = '0';
  draftPlayerTable.records[draftPlayerRow]['DraftPosition'] = finalPosition;
  draftPlayerTable.records[draftPlayerRow]['ProDayBroadJump'] = '0';
  draftPlayerTable.records[draftPlayerRow]['InitialDraftRank'] = index;
  draftPlayerTable.records[draftPlayerRow]['TrueOverallRanking'] = index;
  draftPlayerTable.records[draftPlayerRow]['CanScoutCombine'] = false;
  draftPlayerTable.records[draftPlayerRow]['CombineBenchPress'] = '0';
  draftPlayerTable.records[draftPlayerRow]['ProDayBenchPress'] = '0';
  draftPlayerTable.records[draftPlayerRow]['ProductionGrade'] = '0';
  draftPlayerTable.records[draftPlayerRow]['CombineBroadJump'] = '0';  

}
async function createNewDraftClass(franchise,draftTableArrayId) {
  const playerTable = franchise.getTableByUniqueId(1612938518);
  const draftPlayerTable = franchise.getTableByUniqueId(786598926);
  const draftPlayerArray = franchise.getTableById(draftTableArrayId);

  await playerTable.readRecords();
  await draftPlayerTable.readRecords();
  await draftPlayerArray.readRecords();

  console.log("Enter the YearsPro value of the players you want to convert into Draft Class players.")
  console.log("For example, if you wanted to convert rookies into DC players, you'd enter 0. Or, for second year players, you'd enter 1, etc.")
  console.log("Once converted to Draft Class players, they will have their YearsPro set to 0 after AND their age will be retroactively calculated.")
  var yearsProNumber;
  while (true) {
    const input = prompt();
    yearsProNumber = parseInt(input, 10);
  
    if (isNaN(yearsProNumber) || yearsProNumber < 0 || yearsProNumber > 25) {
      console.log('Invalid input. You have to enter a valid number between 0 and 25.');
      console.log("To reiterate, if you wanted to convert rookies into DC players, you'd enter 0. Or, for second year players, you'd enter 1, etc.")
    } else {
      console.log(`Converting all players with YearsPro = ${yearsProNumber} into Draft Class players.`);
      break; // Exit the loop when valid input is provided
    }
  }

  console.log("Would you like to update all Draft Player portraits to their respective Generic/CAP portraits?")
  console.log("Enter YES to update them or NO to leave portraits as is.")

  var portraitCheck;
  while (true) {
    const input = prompt();
  
    if (input.toLowerCase() === 'yes') {
      console.log("Replacing all Draft Player portraits with their generic/CAP portraits.");
      portraitCheck = true;
      break;
    }
    else if (input.toLowerCase() === 'no') {
      console.log("Leaving Draft Player portraits as is.");
      portraitCheck = false;
      break;
    } else {
      console.log("Invalid value. Valid values are YES or NO.")
    }
  }

  const draftPlayerNumMembers = draftPlayerArray.header.numMembers;
  const filteredRecords = playerTable.records.filter(record => !record.isEmpty); //Filter for where the rows aren't empty
  const targetPlayers = filteredRecords.filter(record => record.YearsPro === yearsProNumber && !['None'].includes(record.ContractStatus)); // Get valid players
  if (draftPlayerNumMembers < 450) {
    console.log(`Warning: This Franchise File can only handle a maximum of ${draftPlayerNumMembers} Draft Players. This is likely due to someone changing the Draft Class limit.`)
    console.log("Please note that this could result in not retrieving all desired players.");
  }

  const sortedTargetPlayers = targetPlayers.sort((a, b) => {
    if (a.PLYR_DRAFTROUND !== b.PLYR_DRAFTROUND) {
      // If the DRAFT_ROUND is different, sort by DRAFT_ROUND in ascending order
      return a.PLYR_DRAFTROUND - b.PLYR_DRAFTROUND;
    } else {
      // If DRAFT_ROUND is the same, sort by DRAFTPICK in ascending order
      return a.PLYR_DRAFTPICK - b.PLYR_DRAFTPICK;
    }
  }).slice(0, draftPlayerNumMembers);  
  const targetPlayersAmount = sortedTargetPlayers.length;

  if (targetPlayersAmount === 0) {
    console.log(`ERROR! No available players for a YearsPro value of ${yearsProNumber}.`);
    console.log("Enter anything to exit the program. This will not save your changes.");
    prompt();
    process.exit(0)
  }

  const allDraftPlayerBinary = [];
  for (let index = 0; index < sortedTargetPlayers.length; index++) {
    const targetRecord = sortedTargetPlayers[index];
    const rowIndex = playerTable.records.indexOf(targetRecord);
    let currentBin = getBinaryReferenceData(playerTable.header.tableId, rowIndex);

    

    playerTable.records[rowIndex]['ContractStatus'] = 'Draft';
    playerTable.records[rowIndex]['TeamIndex'] = 32;
    const playerPosition =  playerTable.records[rowIndex]['Position'];
    const playerCommentId =  playerTable.records[rowIndex]['PLYR_COMMENT'];
    const initialPlayerAge = playerTable.records[rowIndex]['Age'];
    const initialYearsPro = playerTable.records[rowIndex]['YearsPro'];

    if (portraitCheck === true) {
      const genHead = playerTable.records[rowIndex]['PLYR_GENERICHEAD'];
      const lookupValue = genericHeadLookup["PLYR_GENERICHEAD"][genHead] || genericHeadLookup["PLYR_GENERICHEAD"]["DefaultValue"];
      playerTable.records[rowIndex]['PLYR_PORTRAIT'] = lookupValue;

    }


    const finalPlayerAge = initialPlayerAge - initialYearsPro;
    playerTable.records[rowIndex]['Age'] = finalPlayerAge;
    playerTable.records[rowIndex]['YearsPro'] = 0;
    let draftPick = playerTable.records[rowIndex]['PLYR_DRAFTPICK']; 
    let draftRound = playerTable.records[rowIndex]['PLYR_DRAFTROUND'];

    if (draftPick <= 31) {
      draftPick -= 1;
      let draftPickIncrease = ((draftRound * 32) - 32);
      draftPick += draftPickIncrease;
    }

    for (let draftPlayerRow = 0; draftPlayerRow < draftPlayerTable.header.recordCapacity; draftPlayerRow++) {
      if (draftPlayerTable.records[draftPlayerRow].isEmpty === true) {
        await fillDraftPlayerRow(draftPlayerTable, index, draftPlayerRow,playerPosition,playerCommentId,currentBin,draftPick);
        let currentDraftBin = getBinaryReferenceData(draftPlayerTable.header.tableId, draftPlayerRow);
        allDraftPlayerBinary.push(currentDraftBin);
        break;
      }
    }
  }

    while (allDraftPlayerBinary.length < draftPlayerNumMembers) { //Fill up the remainder with zeroed out binary
      allDraftPlayerBinary.push('00000000000000000000000000000000')
    }
    
    //One liner to set the FA table binary = our free agent binary
    allDraftPlayerBinary.forEach((val, index) => { draftPlayerArray.records[0].fieldsArray[index].value = val; })

    return [yearsProNumber,targetPlayersAmount];
  };

franchise.on('ready', async function () {

  const draftTableArrayId = await deleteCurrentDraftClass(franchise);

  [yearsProNumber,targetPlayersAmount] = await createNewDraftClass(franchise,draftTableArrayId);

  console.log(`Successfully deleted current Draft Class players and converted ${targetPlayersAmount} players with YearsPro = ${yearsProNumber} into Draft Class players.`);
  await FranchiseUtils.saveFranchiseFile(franchise);
  console.log("Program completed. Enter anything to exit the program.");

  prompt();
});



