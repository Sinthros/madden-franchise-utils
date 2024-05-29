



const Franchise = require('madden-franchise');
const prompt = require('prompt-sync')();
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const fs = require('fs');
const CHARACTER_VISUALS_FUNCTIONS = require('../lookupFunctions/characterVisualsLookups/characterVisualFunctions');
const COACH_BASE_JSON = CHARACTER_VISUALS_FUNCTIONS.baseCoachVisualJson;
const FranchiseUtils = require('../lookupFunctions/FranchiseUtils');
const { tables } = require('../lookupFunctions/FranchiseTableId');
const YES_KWD = "YES";
const NO_KWD = "NO;"
const FORCE_QUIT_KWD = "FORCEQUIT";
const AUTOMATIC_KWD = 'a';
const MANUAL_KWD = 'm';

const offPlaybookLookup = JSON.parse(fs.readFileSync('lookupFiles/off_playbook_lookup.json', 'utf8'));
const defPlaybookLookup = JSON.parse(fs.readFileSync('lookupFiles/def_playbook_lookup.json', 'utf8'));
const philosophyLookup = JSON.parse(fs.readFileSync('lookupFiles/philosophy_lookup.json', 'utf8'));
const offSchemeLookup = JSON.parse(fs.readFileSync('lookupFiles/off_scheme_lookup.json', 'utf8'));
const defSchemeLookup = JSON.parse(fs.readFileSync('lookupFiles/def_scheme_lookup.json', 'utf8'));
const coachTalentsPositions = JSON.parse(fs.readFileSync('lookupFiles/coach_talents.json', 'utf8'));
const coachTalentsLookup = JSON.parse(fs.readFileSync('lookupFiles/coach_talents_lookup.json', 'utf8'));
const allCoachHeads = JSON.parse(fs.readFileSync('lookupFiles/coach_heads_lookup.json', 'utf8'));

// Don't believe these are needed anymore
const SKIN_TONES = ['SkinTone1','SkinTone2','SkinTone3','SkinTone4','SkinTone5','SkinTone6','SkinTone7'];
const APPAREL = ['Facility1','Facility2','Practice1','Practice2','Practice3','Staff1','Staff2','Staff3','Staff4'];

// Visual morph keys for players and coaches
const VISUAL_MORPH_KEYS = [
  "ArmSize",
  "CalfBlend",
  "Chest",
  "Feet",
  "Glute",
  "Gut",
  "Thighs"
];


const gameYear = '24';
const autoUnempty = true;
const dir = './coachPreviews';
const headsDirName = 'coachHeads';

console.log("Welcome to the Coach Creator Program for Madden NFL 24.")
console.log("In this program, you can create new free agent coaches for your franchise file.")

fs.rmSync(dir, { recursive: true, force: true }); //Remove this folder if it already exists and recreate it
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
};


const franchise = FranchiseUtils.selectFranchiseFile(gameYear,autoUnempty);

async function adjustPresentationId(presentationTable) {
  try {
    const record = presentationTable.records[0];
    const presentationId = record.PresentationId;
    record.PresentationId++;
    record.IdsRemaining--;
    return presentationId;

  } catch (error) {
    console.error('ERROR! Exiting program due to: ', error);
    process.exit(1);
  }
}

async function setDefaultCoachValues(coachRecord,presentationId) {
  try {
    // Self explanatory - These are the default values for the coach table
    coachRecord.SeasonsWithTeam = 0;
    coachRecord.IsCreated = false;
    coachRecord.CoachBackstory = 'TeamBuilder';
    coachRecord.ContractStatus = 'FreeAgent';
    coachRecord.ContractLength = 0;
    coachRecord.ContractYearsRemaining = 0;
    coachRecord.TeamIndex = 32;
    coachRecord.PrevTeamIndex = 0;
    coachRecord.Age = 35;
    coachRecord.COACH_DEFTENDENCYRUNPASS = 50;
    coachRecord.COACH_DEFTENDENCYAGGRESSCONSERV = 50;
    coachRecord.COACH_DEFTENDENCYRUNPASS = 50;
    coachRecord.COACH_OFFTENDENCYAGGRESSCONSERV = 50;
    coachRecord.COACH_RESIGNREPORTED = true;
    coachRecord.COACH_FIREREPORTED = true;
    coachRecord.COACH_LASTTEAMFIRED = 0;
    coachRecord.COACH_LASTTEAMRESIGNED = 0;
    coachRecord.COACH_WASPLAYER = false;
    coachRecord.CareerPlayoffsMade = 0;
    coachRecord.CareerPlayoffWins = 0;
    coachRecord.CareerPlayoffLosses = 0;
    coachRecord.CareerSuperbowlWins = 0;
    coachRecord.CareerSuperbowlLosses = 0;
    coachRecord.CareerWins = 0;
    coachRecord.CareerLosses = 0;
    coachRecord.CareerTies = 0;
    coachRecord.CareerProBowlPlayers = 0;
    coachRecord.WCPlayoffWinStreak = 0;
    coachRecord.ConfPlayoffWinStreak = 0;
    coachRecord.WinSeasStreak = 0;
    coachRecord.DivPlayoffWinStreak = 0;
    coachRecord.SeasWinStreak = 0;
    coachRecord.SuperbowlWinStreak = 0;
    coachRecord.SeasLosses = 0;
    coachRecord.SeasTies = 0;
    coachRecord.SeasWins = 0;
    coachRecord.RegularWinStreak = 0;
    coachRecord.YearsCoaching = 0;
    coachRecord.Level = 1;
    coachRecord.PresentationId = presentationId;
    coachRecord.TeamBuilding = 'ThroughFreeAgency';
    coachRecord.LegacyScore = 0;
    coachRecord.Face = 0;
    coachRecord.HairResid = 0;
    coachRecord.Geometry = 0;
    coachRecord.Personality = 'Unpredictable';
    coachRecord.MultipartBody = false;
    coachRecord.HasCustomBody = false;
    coachRecord.YearlyAwardCount = 0;
    coachRecord.SpeechId = 31;
    coachRecord.AssetName = '';
  } catch (e) {
    console.warn('ERROR! Exiting program due to; ', e);
    process.exit(1);
  }

}

async function setCoachName(coachRecord) {
  try {
    let coachFirstName, coachLastName;

    while (!coachFirstName) {
      console.log("Enter the first name of the coach. ");
      coachFirstName = prompt().trim(); // Remove leading/trailing whitespace
    }

    while (!coachLastName) {
      console.log("Enter the last name of the coach. ");
      coachLastName = prompt().trim(); // Remove leading/trailing whitespace
    }

    coachRecord.FirstName = coachFirstName;
    coachRecord.LastName = coachLastName;

    const coachName = `${coachFirstName[0]}. ${coachLastName}`;
    coachRecord.Name = coachName;

    return [coachFirstName, coachLastName];
  } catch (e) {
    console.warn('ERROR! Exiting program due to:', e);
    process.exit(0);
  }
}

async function setCoachPosition(coachRecord) {
  try {
    const validCoachPositions = ['HeadCoach', 'OffensiveCoordinator', 'DefensiveCoordinator'];
    let coachPosition;

    while (true) { // Infinite loop, until a valid position is entered
      console.log("Enter the position of the coach. Valid values are HeadCoach, OffensiveCoordinator, and DefensiveCoordinator.");
      coachPosition = prompt();

      const lowercaseInput = coachPosition.toLowerCase(); // Convert input to lowercase

      const matchingPosition = validCoachPositions.find(position => position.toLowerCase() === lowercaseInput);

      if (matchingPosition) {
        // If valid, set the position in its original case
        coachRecord.Position = matchingPosition;
        coachRecord.OriginalPosition = matchingPosition;
        return coachRecord.Position;
      } else {
        console.log("Invalid value. Please enter one of the valid options.");
      }
    }
  } catch (e) {
    console.warn('ERROR! Exiting program due to:', e);
    process.exit(0);
  }
}

async function setSchemes(coachRecord) {
  try {
    const offSchemeKeys = Object.keys(offSchemeLookup);
    const defSchemeKeys = Object.keys(defSchemeLookup);

    const selectScheme = (promptMessage, validKeys, schemeLookup, coachField) => {
      while (true) {
        console.log(`${promptMessage} Valid values are: ${validKeys.join(", ")}`);
        const userScheme = prompt().toLowerCase();

        if (validKeys.some((key) => key.toLowerCase() === userScheme)) {
          const selectedScheme = validKeys.find((key) => key.toLowerCase() === userScheme);
          coachRecord[coachField] = schemeLookup[selectedScheme];
          break;
        } else {
          console.log("Invalid value. Please enter a valid listed value.");
        }
      }
    };

    selectScheme("Which offensive scheme should this coach have?", offSchemeKeys, offSchemeLookup, "OffensiveScheme");
    selectScheme("Which defensive scheme should this coach have?", defSchemeKeys, defSchemeLookup, "DefensiveScheme");
  } catch (e) {
    console.warn('ERROR! Exiting program due to:', e);
    process.exit(0);
  }
}

async function setPlaybooks(coachRecord) {
  try {
    const playbookKeys = Object.keys(offPlaybookLookup);

    while (true) {
      console.log("Which team's playbooks should this coach use (Bears, 49ers, etc)? ");
      const teamPlaybook = prompt().toLowerCase(); // Convert user input to lowercase

      const index = playbookKeys.findIndex((key) => key.toLowerCase() === teamPlaybook);
      if (index !== -1) {
        const selectedTeam = playbookKeys[index];
        const playbook = offPlaybookLookup[selectedTeam];
        const philosophy = philosophyLookup[selectedTeam];

        coachRecord.DefensivePlaybook = defPlaybookLookup[selectedTeam];
        coachRecord.TeamPhilosophy = philosophy;
        coachRecord.DefaultTeamPhilosophy = philosophy;
        coachRecord.OffensivePlaybook = playbook;

        break;
      } else {
        console.log("Invalid value. Enter only the display name of the team, such as Jets, Titans, etc. Options are not case sensitive.");
      }
    }
  } catch (e) {
    console.warn('ERROR! Exiting the program due to:', e);
    process.exit(0);
  }
}

async function setCoachAppearance(coachRecord) {
  try {

    const allCoachFaces = Object.keys(allCoachHeads); //Get all face values from dictionary
    const coachHeadArrayLength = allCoachFaces.length; // Get length of coach faces
    let filteredCoachHeads = [] //Array of coach heads based on skin tone shade


    for (let i = 0; i < coachHeadArrayLength; i++) { //Logic to get coach heads for current skin tone
        filteredCoachHeads.push(allCoachFaces[i])
    }
    for (let i = 0; i < filteredCoachHeads.length;i++) {
      currentHead = filteredCoachHeads[i]
      try { // Get all available coach head pngs - If we can't find one, don't crash the program
        fs.copyFileSync(`${headsDirName}/${currentHead}.png`,`coachPreviews/${currentHead}.png`);

      } catch {
        //
      }
    }

    let coachHead;
    while (true) {
      console.log('Please pick one of the following valid coach heads for this coach (Note: Case insensitive).');
      console.log("Note: You can view previews for these coach heads in the coachPreviews folder, which has been generated in the folder of this exe.");
      console.log(filteredCoachHeads.join(", "));
    
      coachHead = prompt().toLowerCase(); // Convert user input to lowercase
    
      if (filteredCoachHeads.some((head) => head.toLowerCase() === coachHead)) {
        const selectedHead = filteredCoachHeads.find((head) => head.toLowerCase() === coachHead);
        coachRecord.FaceShape = selectedHead;
        coachRecord.Portrait = allCoachHeads[selectedHead]; // Set portrait based on coach head
    
        try {
          const skinToneNum = selectedHead.charAt(10);
          const skinTone = "SkinTone".concat(skinToneNum);
          coachRecord.SkinTone = skinTone;
        } catch (e) {
          coachRecord.SkinTone = "SkinTone1";
        }
    
        break;
      } else {
        console.log("Invalid option, please try again.");
      }
    }

    try {
      const validCoachPositions = ['Thin', 'Base', 'Heavy'];
      let coachSize;
      var matchingPosition;
  
      while (true) { // Infinite loop, until a valid size is entered
        console.log("Enter the desired size of the coach. Valid inputs are Thin, Base, or Heavy. Thin is what the game defaults to for generated coaches.");
        coachSize = prompt();
  
        const lowercaseInput = coachSize.toLowerCase(); // Convert input to lowercase
  
        matchingPosition = validCoachPositions.find(position => position.toLowerCase() === lowercaseInput);
  
        if (matchingPosition) {
          // If valid, set the position in its original case
          coachRecord.BodySize = matchingPosition;
          break
        } else {
          console.log("Invalid value. Please enter one of the valid options.");
        }
      }
    } catch (e) {
      console.warn('ERROR! Exiting program due to:', e);
      prompt();
      process.exit(0);
    }


    if (coachRecord.FaceShape.includes("coachhead")) {
      coachRecord.Type = 'Generic';
    }
    else {
      coachRecord.Type = 'Existing';
    }

    return matchingPosition;
  } catch (e) {
  console.warn('ERROR! Exiting program due to; ', e);
  process.exit(0);
}
}

async function setCoachApparel(coachRecord) {

  try {
    coachRecord.Apparel = "Staff1";
  } catch (e) {
    console.warn('ERROR! Exiting program due to; ', e);
    process.exit(0);
  }


}

async function automaticallyFillTalents(activeTalentTree, activeTalentTreeNextRecord, coachPosition) {
  const pickedTalents = [];

  for (let i = 0; i < 3; i++) {
      let talentNum = i === 0 ? 'first' : i === 1 ? 'second' : 'third';
      let validChoices = coachTalentsPositions[coachPosition][talentNum];

      if (validChoices.length === 1) {
          let talentChoice = validChoices[0];
          console.log(`Setting ${talentChoice} as the ${talentNum} talent for this coach.`);
          let coachTalentBinary = coachTalentsLookup.find(obj => obj.coachTalent === talentChoice)?.binaryReference;

          if (i === 0) {
              activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeFirst = coachTalentBinary;
          } else if (i === 1) {
              activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeSecond = coachTalentBinary;
          } else {
              activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeThird = coachTalentBinary;
          }

          pickedTalents.push(talentChoice);
          continue;
      }

      validChoices = validChoices.filter(choice => !pickedTalents.includes(choice));

      const randomIndex = Math.floor(Math.random() * validChoices.length);
      const talentChoice = validChoices[randomIndex];
      console.log(`Setting ${talentChoice} as the ${talentNum} talent for this coach.`);

      let coachTalentBinary = coachTalentsLookup.find(obj => obj.coachTalent === talentChoice)?.binaryReference;

      if (i === 0) {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeFirst = coachTalentBinary;
      } else if (i === 1) {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeSecond = coachTalentBinary;
      } else {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeThird = coachTalentBinary;
      }

      pickedTalents.push(talentChoice);
  }
  return pickedTalents;
}

async function manuallySelectTalents(activeTalentTree, activeTalentTreeNextRecord, coachPosition) {
  const pickedTalents = [];

  for (let i = 0; i < 3; i++) {
    let talentNum = i === 0 ? 'first' : i === 1 ? 'second' : 'third';
    let validChoices = coachTalentsPositions[coachPosition][talentNum];
    validChoices = validChoices.filter(choice => !pickedTalents.includes(choice)); // Exclude the chosen talents

    let caseInsensitiveChoices = validChoices.map(choice => choice.toLowerCase());

    if (validChoices.length === 1) {
      let talentChoice = validChoices[0];
      console.log(`Setting ${talentChoice} as the ${talentNum} talent for this coach.`);
      let coachTalentBinary = coachTalentsLookup.find(obj => obj.coachTalent === talentChoice)?.binaryReference;

      if (i === 0) {
        activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeFirst = coachTalentBinary;
      } else if (i === 1) {
        activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeSecond = coachTalentBinary;
      } else {
        activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeThird = coachTalentBinary;
      }

      pickedTalents.push(talentChoice);
      continue;
    }

    const csvOptions = validChoices.join(', '); // Join options as CSV
    console.log(`Please select the ${talentNum} talent for your ${coachPosition}. Valid options are as follows (case insensitive):`);
    console.log(csvOptions);

    let talentChoice = "";
    while (!caseInsensitiveChoices.includes(talentChoice.toLowerCase())) {
      talentChoice = prompt().toLowerCase(); // Make the input case-insensitive
      if (!caseInsensitiveChoices.includes(talentChoice)) {
        console.log("Invalid choice. As a reminder, choices are CASE INSENSITIVE.");
      } else {
        let coachTalentBinary = coachTalentsLookup.find(obj => obj.coachTalent.toLowerCase() === talentChoice)?.binaryReference;

        if (i === 0) {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeFirst = coachTalentBinary;
        } else if (i === 1) {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeSecond = coachTalentBinary;
        } else {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeThird = coachTalentBinary;
        }

        const originalTalentChoice = validChoices[caseInsensitiveChoices.indexOf(talentChoice.toLowerCase())];
        pickedTalents.push(originalTalentChoice); // Push the original (case-sensitive) talent to pickedTalents
        console.log(`Setting ${originalTalentChoice} as the ${talentNum} talent for this coach.`);
        break;
      }
    }
  }
  return pickedTalents;
}


async function handleTalentTree(coachRecord,talentNodeStatus,talentNodeStatusArray,activeTalentTree,activeTalentTreeNextRecord,activeTalentTreeCurrentBinary,talentSubTreeStatus) {

    const coachPosition = coachRecord.Position // Get coach position
    const coordinatorTalentNodeCount = 9;
    const headCoachTalentNodeCount = 8;
    
    const talentNodeCount = coachPosition === 'HeadCoach' ? headCoachTalentNodeCount : coordinatorTalentNodeCount;
    
    const firstTalentNodeCount = talentNodeCount;
    const secondTalentNodeCount = talentNodeCount;
    const thirdTalentNodeCount = talentNodeCount;

    try {
      console.log("Next, we're going to set the TALENT TREES for your coach.")
      
      let pickedTalents = [];

      let userChoice = '';

      while (userChoice !== AUTOMATIC_KWD && userChoice !== MANUAL_KWD) {
          if (coachPosition === 'HeadCoach') {
            userChoice = AUTOMATIC_KWD;
            console.log("Since this is a Head Coach, this is automatic.")
          }
          else {
            console.log("Would you like to AUTOMATICALLY fill in talents or MANUALLY select them? Valid choices are A or M.");
            userChoice = prompt().toLowerCase();

          }
      }
  
      if (userChoice === AUTOMATIC_KWD) {
          pickedTalents = await automaticallyFillTalents(
              activeTalentTree,
              activeTalentTreeNextRecord,
              coachPosition
          );
      } else if (userChoice === MANUAL_KWD) {
          pickedTalents = await manuallySelectTalents(
              activeTalentTree,
              activeTalentTreeNextRecord,
              coachPosition
          );
      }


      var talentNodeStatusNextRecord = talentNodeStatus.header.nextRecordToUse; // Get the next record for the TalentNodeStatus table
  
      }
      catch (e) {
        console.warn('ERROR! Exiting program due to; ', e);
        process.exit(0);
      }
      
    var talentNodeCountArray = [firstTalentNodeCount,secondTalentNodeCount,thirdTalentNodeCount]
    for (var currentTalentNodeCount = 0; currentTalentNodeCount < talentNodeCountArray.length;currentTalentNodeCount++) {
      try {
        var talentSubTreeStatusNextRecord = talentSubTreeStatus.header.nextRecordToUse;
        var talentNodeStatusArrayNextRecord = talentNodeStatusArray.header.nextRecordToUse;

        currentNodeArrayCount = talentNodeCountArray[currentTalentNodeCount]
        var i = 0;
        var talentNodeArray = [];
        while (i <= currentNodeArrayCount) {
            if (i == 0) {
              var currentBinary = getBinaryReferenceData(talentNodeStatus.header.tableId,talentNodeStatusNextRecord);
              if (currentTalentNodeCount === 2 && coachPosition !== 'HeadCoach') {
                talentNodeStatus.records[talentNodeStatusNextRecord].TalentStatus = 'Owned';
                talentNodeStatus.records[talentNodeStatusNextRecord].UpgradeCount = '1';
  
              }
              else {
                talentNodeStatus.records[talentNodeStatusNextRecord].TalentStatus = 'NotOwned';
                talentNodeStatus.records[talentNodeStatusNextRecord].UpgradeCount = 0;
  
              }
              talentNodeArray.push(currentBinary);
              var talentNodeStatusNextRecord = talentNodeStatus.header.nextRecordToUse;
    
            }
            else {
              var currentBinary = getBinaryReferenceData(talentNodeStatus.header.tableId,talentNodeStatusNextRecord);
              talentNodeStatus.records[talentNodeStatusNextRecord].TalentStatus = 'NotOwned';
              talentNodeStatus.records[talentNodeStatusNextRecord].UpgradeCount = 0;
              talentNodeArray.push(currentBinary);
              var talentNodeStatusNextRecord = talentNodeStatus.header.nextRecordToUse;
            }
            i++;
          }
    
          var j = 0;
          while (j <= 11) {
            if (currentNodeArrayCount >= j) { //Put each talent node from our resulting array into the array table
              var currentArrayElement = talentNodeArray.shift();
              talentNodeStatusArray.records[talentNodeStatusArrayNextRecord][`TalentNodeStatus${j}`] = currentArrayElement;
              j++;
            }
            else if (currentNodeArrayCount < j) { //Once our array is empty, make sure the rest of the row is zeroed out
              talentNodeStatusArray.records[talentNodeStatusArrayNextRecord][`TalentNodeStatus${j}`] = FranchiseUtils.ZERO_REF;
              j++;
            }
          }
        var talentNodeBinary = getBinaryReferenceData(talentNodeStatusArray.header.tableId,talentNodeStatusArrayNextRecord); //Get the binary for our row in the node status array table
        talentSubTreeStatus.records[talentSubTreeStatusNextRecord].TalentStatusOrderedList = talentNodeBinary; // Use the above binary in the TalentSubTreeStatus table
    
        var currentActiveTalentTreeBinary = getBinaryReferenceData(talentSubTreeStatus.header.tableId,talentSubTreeStatusNextRecord); //The final binary we need for the first active talent tree column
        if (currentTalentNodeCount == 0) {
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeStatusFirst = currentActiveTalentTreeBinary

        }
        else if (currentTalentNodeCount == 1) {
          currentActiveTalentTreeBinary = getBinaryReferenceData(talentSubTreeStatus.header.tableId,talentSubTreeStatusNextRecord) //The final binary we need for the second active talent tree column
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeStatusSecond = currentActiveTalentTreeBinary

        }

        else {
          currentActiveTalentTreeBinary = getBinaryReferenceData(talentSubTreeStatus.header.tableId,talentSubTreeStatusNextRecord) //The final binary we need for the second active talent tree column
          activeTalentTree.records[activeTalentTreeNextRecord].TalentSubTreeStatusThird = currentActiveTalentTreeBinary

        }
      } catch (e) {
        console.warn("ERROR! Exiting program due to; ", e);
        process.exit(0);
      }

    }
    coachRecord.ActiveTalentTree = activeTalentTreeCurrentBinary;
  
}

async function getAllTables(franchise) {
  const coachTable = franchise.getTableByUniqueId(tables.coachTable); // Get all the tables we'll need
  const freeAgentCoachTable = franchise.getTableByUniqueId(tables.freeAgentCoachTable);
  const activeTalentTree = franchise.getTableByUniqueId(tables.activeTalentTree);
  const talentNodeStatus = franchise.getTableByUniqueId(tables.talentNodeStatus);
  const talentNodeStatusArray = franchise.getTableByUniqueId(tables.talentNodeStatusArray);
  const talentSubTreeStatus = franchise.getTableByUniqueId(tables.talentSubTreeStatus);
  const presentationTable = franchise.getTableByUniqueId(tables.presentationTable);
  const characterVisuals = franchise.getTableByUniqueId(tables.characterVisualsTable);

  //Put all of our tables into an array
  const allTables = [coachTable,freeAgentCoachTable,activeTalentTree,talentNodeStatus,talentNodeStatusArray,talentSubTreeStatus,presentationTable,characterVisuals];

  // Read all of our tables
  await FranchiseUtils.readTableRecords(allTables)

  return allTables;

}

async function addCoachToFATable(freeAgentCoachTable,currentCoachBinary) {
  try {
    let i = 0;
    coachArrayNotFull = true;
    while (coachArrayNotFull) { // Find first zeroed out coach value in array table and insert our new coach there
      if (i > 63) { /// This means the coach array table is full; We can't add a new coach!
        coachArrayNotFull = false;
        break
      }
      if (freeAgentCoachTable.records[0][`Coach${i}`] == ZERO_REF) {
        if (i > 58) {
          console.log(`Warning: There are 64 total slots for free agent coaches and you've now taken up ${i + 1} slots out of 64. It's not advisable to completely fill up the Coach FA pool.`)
        }
        freeAgentCoachTable.records[0][`Coach${i}`] = currentCoachBinary
        break

      }
      i++;
    }
  } catch (e) {
    console.warn("ERROR! Exiting program due to; ",e)
    process.exit(0);
  }
  if (coachArrayNotFull == false) {
    console.log("ERROR! Cannot add new coach. You've reached the limit of 64 free agent coaches. Exiting program.");
    prompt();
    process.exit(0);
  }
}

async function updateCoachVisual(coachTable,characterVisuals,nextCoachRecord, coachSize) {


  let jsonToUpdate = JSON.parse(JSON.stringify(COACH_BASE_JSON)); // Get our current base JSON

  const coachValues = await CHARACTER_VISUALS_FUNCTIONS.getCoachValues(coachTable, nextCoachRecord);

  jsonToUpdate = await CHARACTER_VISUALS_FUNCTIONS.updateCoachVisuals(coachValues,jsonToUpdate,VISUAL_MORPH_KEYS, coachSize)

  jsonToUpdate = await CHARACTER_VISUALS_FUNCTIONS.removeEmptyCoachBlends(jsonToUpdate)

  
  let characterVisualsRef = coachTable.records[nextCoachRecord]['CharacterVisuals'];
  let characterVisualsRow = await FranchiseUtils.bin2Dec(characterVisualsRef.slice(15));
  const visualsRecordCapacity = characterVisuals.header.recordCapacity;

  if (characterVisualsRef === ZERO_REF) { // If it's all zeroes, we need to set a new reference
    characterVisualsRow = characterVisuals.header.nextRecordToUse; // Get the first empty row
    if (characterVisualsRow >= visualsRecordCapacity) {
      console.log("ERROR - The CharacterVisuals table has run out of space. Your changes have not been saved.");
      console.log(`This means that the amount of players + coaches in your Franchise File exceeds ${visualsRecordCapacity}. Enter anything to exit.`)
      prompt();
      process.exit(0);
    }
    characterVisualsRef = getBinaryReferenceData(characterVisuals.header.tableId,characterVisualsRow); //Convert to binary
    coachTable.records[nextCoachRecord]['CharacterVisuals'] = characterVisualsRef;
  }
  else { //Else, simply convert the binary ref to the row number value
    characterVisualsRow = await FranchiseUtils.bin2Dec(characterVisualsRef.slice(15));
  }

  //console.log(JSON.stringify(jsonToUpdate))
  characterVisuals.records[characterVisualsRow]['RawData'] = jsonToUpdate; //Set the RawData of the CharacterVisuals row = our updated JSON
}

async function createNewCoach(franchise) {

  const allTables = await getAllTables(franchise);

  // Get all of our tables
  const [coachTable,freeAgentCoachTable,activeTalentTree,talentNodeStatus,talentNodeStatusArray,talentSubTreeStatus,presentationTable,characterVisuals] = allTables;
  
  const nextCoachRecord = coachTable.header.nextRecordToUse; // Get next record to use for the coach table and activeTalentTree table
  const activeTalentTreeNextRecord = activeTalentTree.header.nextRecordToUse;
  const currentCoachBinary = getBinaryReferenceData(coachTable.header.tableId,nextCoachRecord); // Then, we need the current row binary for both tables
  var activeTalentTreeCurrentBinary = getBinaryReferenceData(activeTalentTree.header.tableId,activeTalentTreeNextRecord);

  const coachRecord = coachTable.records[nextCoachRecord];

  const presentationId = await adjustPresentationId(presentationTable); // Get presentation id
  await setDefaultCoachValues(coachRecord,presentationId); // Set all default coach values
  
  const [coachFirstName,coachLastName] = await setCoachName(coachRecord); // Get coach name from user

  const coachPosition = await setCoachPosition(coachRecord); // Get coach position

  await setSchemes(coachRecord); // Get coach schemes

  await setPlaybooks(coachRecord); // Get playbooks

  const coachSize = await setCoachAppearance(coachRecord);

  await setCoachApparel(coachRecord);
  
  await handleTalentTree(coachTable,nextCoachRecord,talentNodeStatus,talentNodeStatusArray,activeTalentTree,activeTalentTreeNextRecord,activeTalentTreeCurrentBinary,talentSubTreeStatus);

  await addCoachToFATable(freeAgentCoachTable,currentCoachBinary);

  await updateCoachVisual(coachTable,characterVisuals,nextCoachRecord, coachSize);

  console.log(`Successfully created ${coachPosition} ${coachFirstName} ${coachLastName}!`);
  return;


}

franchise.on('ready', async function () {
 
  //THIS IS HOW WE CAN TELL WHAT GAME WE'RE WORKING WITH
  const gameYear = franchise.schema.meta.gameYear;

  if (gameYear !== gameYear) {
    console.log("FATAL ERROR! Selected franchise file is NOT a Madden 24 Franchise File. Enter anything to exit.");
    prompt();
    process.exit(0);
  }

  // Always run our main function at least once
  await createNewCoach(franchise);

  let continuePrompt;
  const validOptions = [YES_KWD,NO_KWD,FORCE_QUIT_KWD]
  while (!validOptions.includes(continuePrompt)) { // While loop to keep creating coaches
    console.log("Would you like to create another coach? Enter Yes to create another coach or No to quit the program. Either option will save your franchise file.");
    console.log("Alternatively, enter ForceQuit to exit the program WITHOUT saving your most recent added coach.")
    continuePrompt = prompt(); // Get user input
    if (continuePrompt.toUpperCase() === NO_KWD) { // If no, save and quit
      await franchise.save();

      fs.rmSync(dir, { recursive: true, force: true }); //Remove the coach previews folder
      console.log("Franchise file successfully saved. Enter anything to exit.");
      prompt();
      break
    }

    else if (continuePrompt.toUpperCase() === YES_KWD) { //Save the file and run the program again
      await franchise.save();

      console.log("Franchise file successfully saved.")
      await createNewCoach(franchise);
    }
    else if (continuePrompt.toUpperCase() === FORCE_QUIT_KWD) {
      fs.rmSync(dir, { recursive: true, force: true }); //Remove the coach previews folder
      console.log("Exiting WITHOUT saving your last added coach. Enter anything to exit.");
      prompt();
      break
    }
    else {
      console.log("Invalid option. Please try again.");
    }
  }
});

