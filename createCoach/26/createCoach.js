const prompt = require("prompt-sync")();
const { getBinaryReferenceData } = require("madden-franchise").utilService;
const fs = require("fs");
const path = require("path");
const FranchiseUtils = require("../../Utils/FranchiseUtils");
const CharacterVisualFunctions = require("../../Utils/characterVisualsLookups/characterVisualFunctions26");
const CoachTalentFunctions = require("../../Utils/coachTalentUtils/coachTalentFunctions26");

// Lookups
const offPlaybookLookup = require("../../Utils/JsonLookups/26/coachLookups/offensivePlaybooks.json");
const defPlaybookLookup = require("../../Utils/JsonLookups/26/coachLookups/defensivePlaybooks.json");
const philosophyLookup = require("./lookupFiles/philosophy_lookup.json");
const offSchemeLookup = require("../../Utils/JsonLookups/26/coachLookups/offensiveSchemes.json");
const defSchemeLookup = require("../../Utils/JsonLookups/26/coachLookups/defensiveSchemes.json");
const allCoachHeads = require("../../Utils/JsonLookups/26/coachLookups/genericCoachHeadsLookup.json");

const COACH_ARCHETYPES = ["OffensiveGuru", "DefensiveGenius", "DevelopmentWizard", "MasterMotivator"];
const MALE_BODY_TYPES = CharacterVisualFunctions.MALE_BODY_TYPES;
const FEMALE_BODY_TYPES = CharacterVisualFunctions.FEMALE_BODY_TYPES;
const COACH_POSITIONS = ["HeadCoach", "OffensiveCoordinator", "DefensiveCoordinator"];

const gameYear = FranchiseUtils.YEARS.M26;

const allCoachPortraits = Object.values(allCoachHeads).sort((a, b) => Number(a) - Number(b));
const allCoachFaces = Object.keys(allCoachHeads);
const portraitToHeadMap = Object.fromEntries(allCoachFaces.map((face, i) => [allCoachPortraits[i], face]));

console.log(`This program will allow you to create new Free Agent coaches in your Madden ${gameYear} franchise file.`);

const previewsDir = path.join(process.cwd(), "coachPreviews");
fs.mkdirSync(previewsDir, { recursive: true });
const headsDir = path.join(__dirname, "coachHeads"); // this now points to a real folder outside snapshot

const franchise = FranchiseUtils.init(gameYear, { isAutoUnemptyEnabled: true, promptForBackup: true });
const tables = FranchiseUtils.getTablesObject(franchise);

function adjustPresentationId(coachRecord, presentationTable) {
  const record = presentationTable.records[0];
  const presentationId = record.PresentationId;
  record.PresentationId++;
  record.IdsRemaining--;
  coachRecord.PresentationId = presentationId;
}

function setDefaultCoachValues(coachRecord) {
  try {
    // Self explanatory - These are the default values for the coach table
    coachRecord.SeasonsWithTeam = 0;
    coachRecord.IsCreated = false;
    coachRecord.IsLegend = false;
    coachRecord.CoachBackstory = "TeamBuilder";
    coachRecord.ContractStatus = "FreeAgent";
    coachRecord.ContractLength = 0;
    coachRecord.ContractYearsRemaining = 0;
    coachRecord.TeamIndex = 32;
    coachRecord.PrevTeamIndex = 0;
    coachRecord.Age = 35;
    coachRecord.COACH_RESIGNREPORTED = true;
    coachRecord.COACH_FIREREPORTED = true;
    coachRecord.COACH_LASTTEAMFIRED = 1023;
    coachRecord.COACH_LASTTEAMRESIGNED = 1023;
    coachRecord.COACH_WASPLAYER = false;
    coachRecord.COACH_DL = 50;
    coachRecord.COACH_LB = 50;
    coachRecord.COACH_WR = 50;
    coachRecord.COACH_K = 50;
    coachRecord.COACH_OFFENSE = 50;
    coachRecord.COACH_DEFENSE = 50;
    coachRecord.COACH_DEFENSETYPE = 50;
    coachRecord.COACH_DEFTENDENCYRUNPASS = 50;
    coachRecord.COACH_DEFTENDENCYAGGRESSCONSERV = 50;
    coachRecord.COACH_OFFTENDENCYAGGRESSCONSERV = 50;
    coachRecord.COACH_OFFTENDENCYRUNPASS = 50;
    coachRecord.COACH_S = 50;
    coachRecord.COACH_DB = 50;
    coachRecord.COACH_QB = 50;
    coachRecord.COACH_RB = 50;
    coachRecord.COACH_RBTENDENCY = 50;
    coachRecord.COACH_P = 50;
    coachRecord.COACH_OL = 50;
    coachRecord.CareerPlayoffsMade = 0;
    coachRecord.CareerPlayoffWins = 0;
    coachRecord.CareerPlayoffLosses = 0;
    coachRecord.CareerSuperbowlWins = 0;
    coachRecord.CareerSuperbowlLosses = 0;
    coachRecord.CareerWins = 0;
    coachRecord.CareerLosses = 0;
    coachRecord.CareerTies = 0;
    coachRecord.CareerProBowlPlayers = 0;
    coachRecord.CareerWinSeasons = 0;
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
    coachRecord.Level = 0;
    coachRecord.TeamBuilding = "Balanced";
    coachRecord.LegacyScore = 0;
    coachRecord.Face = 0;
    coachRecord.HairResid = 0;
    coachRecord.Geometry = 0;
    coachRecord.Personality = "Unpredictable";
    coachRecord.MultipartBody = false;
    coachRecord.HasCustomBody = false;
    coachRecord.YearlyAwardCount = 0;
    coachRecord.SpeechId = 31;
    coachRecord.AssetName = FranchiseUtils.EMPTY_STRING;
    coachRecord.Height = 70;
    coachRecord.Weight = 10;
    coachRecord.Portrait_Force_Silhouette = false;
    coachRecord.COACH_PERFORMANCELEVEL = 0;
    coachRecord.Probation = false;
    coachRecord.TraitExpertScout = false;

    // New M26 fields
    coachRecord.CurrentPurchasedTalentCosts = 0;
    coachRecord.IndexInUnlockList = 0;
    coachRecord.COACH_ADAPTIVE_AI = "Aggressive";
    coachRecord.COACH_DEMEANOR = "Classic";
    coachRecord.Archetype = "DevelopmentWizard";
    coachRecord.COACH_RATING = 50;
    coachRecord.COACH_STANCE = "Classic";
    coachRecord.IsMaxLevel = false;
    coachRecord.ContractSalary = 0;
    coachRecord.COACH_LASTCONTRACTTEAM = 0;
    coachRecord.AwardPoints = 0;
    coachRecord.IndexInUnlockList = 0;
  } catch (e) {
    console.warn("ERROR! Exiting program due to; ", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
}

function setCoachName(coachRecord) {
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
    console.warn("ERROR! Exiting program due to:", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
}

function setCoachPosition(coachRecord) {
  const position = FranchiseUtils.getUserSelection("Enter the position of the coach", COACH_POSITIONS);
  coachRecord.Position = position;
  coachRecord.OriginalPosition = position;
}

async function setSchemes(coachRecord) {
  try {
    const selectScheme = (promptMessage, schemes, coachField) => {
      while (true) {
        const validNames = schemes.map((s) => s.ShortName).join(", ");
        console.log(`${promptMessage} Valid values are: ${validNames}`);

        const input = prompt()?.trim().toLowerCase();
        if (!input) {
          console.log("Please enter a scheme name.");
          continue;
        }

        const selected = schemes.find((s) => s.ShortName.toLowerCase() === input);

        if (!selected) {
          console.log("Invalid value. Please enter a valid listed value.");
          continue;
        }

        coachRecord[coachField] = FranchiseUtils.dec2bin(selected.AssetId);

        break;
      }
    };

    selectScheme("Which offensive scheme should this coach have?", offSchemeLookup, "OffensiveScheme");

    selectScheme("Which defensive scheme should this coach have?", defSchemeLookup, "DefensiveScheme");
  } catch (e) {
    console.warn("ERROR! Exiting program due to:", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
}

async function setPlaybooks(coachRecord) {
  try {
    // Precompute case-insensitive philosophy map once
    const philosophyMap = Object.fromEntries(
      Object.entries(philosophyLookup).map(([key, value]) => [key.toLowerCase(), value])
    );

    while (true) {
      console.log("Which team's playbooks should this coach use (Bears, 49ers, etc)? ");
      const input = prompt()?.trim();

      if (!input) {
        console.log("Please enter a team name.");
        continue;
      }

      const teamKey = input.toLowerCase();

      // Find playbooks by ShortName
      const offensive = offPlaybookLookup.find((p) => p.ShortName.toLowerCase() === teamKey);
      const defensive = defPlaybookLookup.find((p) => p.ShortName.toLowerCase() === teamKey);

      if (!offensive || !defensive) {
        console.log(
          "Invalid value. Enter only the display name of the team, such as Jets, Titans, etc. Options are not case sensitive."
        );
        continue;
      }

      // Convert AssetIds → binary refs
      coachRecord.OffensivePlaybook = FranchiseUtils.dec2bin(offensive.AssetId);

      coachRecord.DefensivePlaybook = FranchiseUtils.dec2bin(defensive.AssetId);

      // Philosophy (fallback to 49ers)
      const philosophyBinary = philosophyMap[teamKey] ?? philosophyMap["49ers".toLowerCase()];

      coachRecord.TeamPhilosophy = philosophyBinary;
      coachRecord.DefaultTeamPhilosophy = philosophyBinary;

      break;
    }
  } catch (e) {
    console.warn("ERROR! Exiting the program due to:", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
}

function getBodyType(coachRecord) {
  const isFemale = CharacterVisualFunctions.isFemaleHead(coachRecord);

  const options = isFemale ? FEMALE_BODY_TYPES : MALE_BODY_TYPES;

  const message = "Select a body type for your coach.";
  const bodyType = FranchiseUtils.getUserSelection(message, options);
  coachRecord.CharacterBodyType = bodyType;
}

async function setCoachAppearance(coachRecord) {
  try {
    for (const portrait of allCoachPortraits) {
      const src = path.join(headsDir, `${portrait}.png`);
      const dest = path.join(previewsDir, `${portrait}.png`);

      try {
        fs.copyFileSync(src, dest);
      } catch (err) {
        console.warn(`Could not copy ${portrait}.png — skipping`, err.message);
      }
    }

    let selectedPortrait;
    while (true) {
      console.log("Please pick one of the following valid coach heads for this coach.");
      console.log(
        "Note: You can view previews for these coach portraits in the coachPreviews folder, which has been generated in the folder of this exe."
      );
      console.log(allCoachPortraits.join(", "));

      selectedPortrait = prompt(); // Get user input as a string

      if (allCoachPortraits.some((portrait) => String(portrait) === selectedPortrait.toLowerCase())) {
        const exactPortrait = allCoachPortraits.find((portrait) => String(portrait) === selectedPortrait.toLowerCase());
        const correspondingHead = portraitToHeadMap[exactPortrait];

        coachRecord.FaceShape = "Invalid_";
        coachRecord.GenericHeadAssetName = correspondingHead;
        coachRecord.Portrait = exactPortrait; // Set portrait based on selected value

        // Have the user select the body type
        getBodyType(coachRecord);

        break;
      } else {
        console.log("Invalid option, please try again.");
      }
    }

    const genHeadAssetName = coachRecord.GenericHeadAssetName;

    if (genHeadAssetName.includes("coachhead")) {
      coachRecord.Type = "Generic";
    } else {
      coachRecord.Type = "Existing";
    }
  } catch (e) {
    console.warn("ERROR! Exiting program due to; ", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
}

async function addCoachToFATable(freeAgentCoachTable, currentCoachBinary) {
  try {
    let i = 0;
    coachArrayNotFull = true;
    while (coachArrayNotFull) {
      // Find first zeroed out coach value in array table and insert our new coach there
      if (i > 63) {
        /// This means the coach array table is full; We can't add a new coach!
        coachArrayNotFull = false;
        break;
      }
      if (freeAgentCoachTable.records[0][`Coach${i}`] == FranchiseUtils.ZERO_REF) {
        if (i > 58) {
          console.log(
            `Warning: There are 64 total slots for free agent coaches and you've now taken up ${
              i + 1
            } slots out of 64. It's not advisable to completely fill up the Coach FA pool.`
          );
        }
        freeAgentCoachTable.records[0][`Coach${i}`] = currentCoachBinary;
        break;
      }
      i++;
    }
  } catch (e) {
    console.warn("ERROR! Exiting program due to; ", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
  if (!coachArrayNotFull) {
    console.log("ERROR! Cannot add new coach. You've reached the limit of 64 free agent coaches. Exiting program.");
    FranchiseUtils.EXIT_PROGRAM();
  }
}

async function updateCoachVisual(coachRecord) {
  const visuals = await CharacterVisualFunctions.generateCoachVisuals(franchise, tables, coachRecord);
}

function getArchetype(coachRecord) {
  const archetype = FranchiseUtils.getUserSelection("Please select an archetype for the coach", COACH_ARCHETYPES);
  coachRecord.Archetype = archetype;
}

async function createNewCoach() {
  const coachTable = franchise.getTableByUniqueId(tables.coachTable); // Get all the tables we'll need
  const freeAgentCoachTable = franchise.getTableByUniqueId(tables.freeAgentCoachTable);
  const presentationTable = franchise.getTableByUniqueId(tables.presentationTable);
  const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);
  const gamedayTalentTable = franchise.getTableByUniqueId(tables.gamedayTalentTable);
  const wearAndTearTalentTable = franchise.getTableByUniqueId(tables.wearAndTearTalentTable);
  const playsheetTalentTable = franchise.getTableByUniqueId(tables.playsheetTalentTable);
  const seasonTalentTable = franchise.getTableByUniqueId(tables.seasonTalentTable);
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);

  await FranchiseUtils.readTableRecords([
    coachTable,
    freeAgentCoachTable,
    presentationTable,
    talentArrayTable,
    gamedayTalentTable,
    wearAndTearTalentTable,
    playsheetTalentTable,
    seasonTalentTable,
    talentTierArrayTable,
    talentTierTable,
  ]);

  const nextCoachRecord = coachTable.header.nextRecordToUse; // Get next record to use for the coach table
  const coachBinary = getBinaryReferenceData(coachTable.header.tableId, nextCoachRecord); // Then, we need the current row binary for both tables

  const coachRecord = coachTable.records[nextCoachRecord];

  adjustPresentationId(coachRecord, presentationTable); // Get presentation id

  setDefaultCoachValues(coachRecord); // Set all default coach values

  const [coachFirstName, coachLastName] = setCoachName(coachRecord); // Get coach name from user

  setCoachPosition(coachRecord); // Get coach position

  await setSchemes(coachRecord); // Get coach schemes

  await setPlaybooks(coachRecord); // Get playbooks

  await setCoachAppearance(coachRecord);

  await updateCoachVisual(coachRecord);

  getArchetype(coachRecord);

  await CoachTalentFunctions.regenerateTalents(franchise, tables, coachRecord);

  await addCoachToFATable(freeAgentCoachTable, coachBinary);

  console.log(`Successfully created ${coachRecord.Position} ${coachFirstName} ${coachLastName}!`);
}

franchise.on("ready", async function () {
  do {
    // Do while loop to keep creating coaches
    await createNewCoach();

    const message = `Would you like to create another coach? Enter ${FranchiseUtils.YES_KWD} to create another coach or ${FranchiseUtils.NO_KWD} to quit the program. Alternatively, enter ${FranchiseUtils.FORCEQUIT_KWD} to exit the program WITHOUT saving your most recent added coach.`;

    const prompt = FranchiseUtils.getYesNoForceQuit(message);

    if (prompt === FranchiseUtils.NO_KWD) {
      // If no, save and quit
      await franchise.save();

      fs.rmSync(previewsDir, { recursive: true, force: true }); // Remove the coach previews folder
      console.log("Franchise file successfully saved.");
      FranchiseUtils.EXIT_PROGRAM();
    } else if (prompt === FranchiseUtils.FORCEQUIT_KWD) {
      fs.rmSync(previewsDir, { recursive: true, force: true }); // Remove the coach previews folder
      console.log("Exiting without saving your last added coach.");
      FranchiseUtils.EXIT_PROGRAM();
    } else if (prompt === FranchiseUtils.YES_KWD) {
      //Save the file and run the program again
      await franchise.save();
      console.log("Franchise file successfully saved.");
    }
  } while (true);
});
