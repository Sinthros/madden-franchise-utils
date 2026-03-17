const prompt = require("prompt-sync")();
const fs = require("fs");
const path = require("path");
const FranchiseUtils = require("../../Utils/FranchiseUtils");
const CharacterVisualFunctions = require("../../Utils/characterVisualsLookups/characterVisualFunctions26");

// Lookups
const allCoachHeads = require("../../Utils/JsonLookups/26/coachLookups/genericCoachHeadsLookup.json");

const POSITIONS = ["OffensiveCoordinator", "DefensiveCoordinator"];
const CONTRACT_STATUSES = [FranchiseUtils.CONTRACT_STATUSES.SIGNED, FranchiseUtils.CONTRACT_STATUSES.EXPIRING];

const MALE_BODY_TYPES = {
  S: "Standard",
  M: "Muscular",
  T: "Thin",
  H: "Heavy",
};

const FEMALE_BODY_TYPES = {
  S: "Standard_Alternate",
  T: "Thin_Alternate",
};

const gameYear = FranchiseUtils.YEARS.M26;

// Convert object to [face, portrait] entries
const entries = Object.entries(allCoachHeads);

// Sort entries by portrait number
entries.sort(([, aPortrait], [, bPortrait]) => Number(aPortrait) - Number(bPortrait));

// Unpack sorted portraits and faces
const allCoachFaces = entries.map(([face]) => face);
const allCoachPortraits = entries.map(([, portrait]) => portrait);

// Create portrait -> face map
const portraitToHeadMap = Object.fromEntries(entries.map(([face, portrait]) => [portrait, face]));

console.log(
  `This program will allow you to update coach coordinator heads/visuals in your Madden ${gameYear} franchise file.`,
);

const previewsDir = path.join(process.cwd(), "coachPreviews");
fs.mkdirSync(previewsDir, { recursive: true });
const headsDir = path.join(__dirname, "coachHeads");

const franchise = FranchiseUtils.init(gameYear, { isAutoUnemptyEnabled: true, promptForBackup: true });
const tables = FranchiseUtils.getTablesObject(franchise);
const isAdvancedEditing = true;

function getBodyType(coachRecord) {
  const isFemale = CharacterVisualFunctions.isFemaleHead(coachRecord);

  const options = isFemale ? FEMALE_BODY_TYPES : MALE_BODY_TYPES;

  const message = "Select a body type for your coach.";
  const bodyType = FranchiseUtils.getUserSelectionFromMap(message, options);
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
      console.log("Please pick one of the following valid coach heads for this coach (150, etc).");
      console.log(
        "Note: You can view previews for these coach portraits in the coachPreviews folder, which has been generated in the folder of this exe.",
      );

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

    if (isAdvancedEditing) {
      const message =
        "Enter the AssetName for the coach. Setting this will override GenericHeadAssetName to MustBeUnique. " +
        " If you want to enter nothing, just press enter. Only enter an asset name if you know what you're doing.";
      const assetName = FranchiseUtils.getStringInput(message, {
        allowEmpty: true,
        maxLength: FranchiseUtils.MAX_FIELD_LENGTH.AssetName,
      });
      if (!FranchiseUtils.isBlank(assetName)) {
        coachRecord.AssetName = assetName;
        coachRecord.GenericHeadAssetName = "MustBeUnique";
        coachRecord.Type = "Existing";
      }

      const editPortrait = FranchiseUtils.getYesOrNo(
        "Would you like to manually change the portrait ID? Enter yes or no. Enter no if you're not sure.",
        true,
      );
      if (editPortrait) {
        const portraitMessage =
          "Enter the desired portrait ID. 7999 will result in a black silhouette. If you changed your mind, enter -1 to not change the portrait ID.";
        const portrait = FranchiseUtils.getUserInputNumber(portraitMessage, -1, 8191);
        if (portrait !== -1) coachRecord.Portrait = portrait;
      }
    }
  } catch (e) {
    console.warn("ERROR! Exiting program due to; ", e);
    FranchiseUtils.EXIT_PROGRAM();
  }
}

async function updateCoachVisual(coachRecord) {
  const visualsRecord = await CharacterVisualFunctions.generateCoachVisuals(franchise, tables, coachRecord);
  if (isAdvancedEditing) {
    const headgearMessage =
      "Would you like to set the coach to have no hat and headset? Enter yes or no. Note that this may be overriden in game depending on the asset/head.";
    const removeHeadGear = FranchiseUtils.getYesOrNo(headgearMessage, true);

    if (removeHeadGear) {
      // Parse JSON string → object
      const visuals = JSON.parse(visualsRecord.RawData);

      CharacterVisualFunctions.updateVisualsSlot(visuals, "HeadWear", "Hat_None");

      CharacterVisualFunctions.updateVisualsSlot(visuals, "EarWear", "UC_Headset_None");

      // Serialize back to string
      visualsRecord.RawData = JSON.stringify(visuals);
    }
  }
}

franchise.on("ready", async function () {
  const coachTable = franchise.getTableByUniqueId(tables.coachTable);
  await coachTable.readRecords();
  /*for (const record of FranchiseUtils.getActiveRecords(coachTable)) {
    if (!POSITIONS.includes(record.Position) || !CONTRACT_STATUSES.includes(record.ContractStatus)) continue;
    const message = `Would you like to update visuals for ${record.Position} ${record.FirstName} ${record.LastName}? Enter y or n, or f to exit the loop entirely`;
    const result = FranchiseUtils.getYesNoForceQuitShort(message, true);
    if (result === FranchiseUtils.FORCEQUIT_KWD) break;
    if (result === FranchiseUtils.NO_KWD) continue;
    await setCoachAppearance(record);
    await updateCoachVisual(record);
  }*/

  while (true) {
    const index = FranchiseUtils.getUserInputNumber(
      "Select the index of the coach record you want to edit. Enter -1 to quit.",
      -1,
      469,
    );
    if (index === -1) break;
    const record = coachTable.records[index];
    if (!record) continue;

    await setCoachAppearance(record);
    await updateCoachVisual(record);
  }
  await FranchiseUtils.saveFranchiseFile(franchise);
  FranchiseUtils.EXIT_PROGRAM();
  fs.rmSync(previewsDir, { recursive: true, force: true }); // Remove the coach previews folder
});
