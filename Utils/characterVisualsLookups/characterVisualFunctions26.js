const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../FranchiseUtils");
const fs = require("fs");
const path = require("path");

const oldToNewSlotMap = JSON.parse(fs.readFileSync(path.join(__dirname, "./26/newSlotTypeMap.json"), "utf-8"));
const baseFemaleVisuals = JSON.parse(
  fs.readFileSync(path.join(__dirname, "./26/baseFemaleCoachVisualLookup.json"), "utf-8")
);
const baseCoachVisuals = JSON.parse(fs.readFileSync(path.join(__dirname, "./26/baseCoachVisualLookup.json"), "utf-8"));
const coachVisualsLookup = JSON.parse(fs.readFileSync(path.join(__dirname, "./26/coachVisualsLookup.json"), "utf-8"));
const allSlotTypes = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, "./26/loadoutSlots.json"), "utf-8")));
const FEMALE_BODY_TYPES = ["Standard_Alternate", "Thin_Alternate"];

/**
 * Regenerates character visuals based on a coach record
 * We will first check if they exist in coachVisualsLookup, otherwise we will work off of baseCoachVisuals/baseFemaleVisuals
 * @param {Object} franchise - The franchise file object
 * @param {Object} tables - The franchise tables
 * @param {Object} coachRecord - The coach record object
 */
async function generateCoachVisuals(franchise, tables, coachRecord) {
  if (!coachRecord) return;
  const assetName = coachRecord.AssetName;
  // Get the current visuals record
  const visualsRecord = await getCharacterVisualsRecord(franchise, tables, coachRecord);

  let visuals = coachVisualsLookup[assetName];

  if (!visuals) {
    visuals = isFemaleHead(coachRecord) ? baseFemaleVisuals : baseCoachVisuals;
  }
}

/**
 * Gets the player/coach character visuals record
 * If it exists we pull that record, else we generate a new one and return that record
 * It will also updated the playerOrCoachRecord.CharacterVisuals reference if needed
 * @param {Object} franchise - The franchise file object
 * @param {Object} tables - The franchise tables
 * @param {playerOrCoachRecord} coachRecord - The player or coach record
 *
 */
async function getCharacterVisualsRecord(franchise, tables, playerOrCoachRecord) {
  let characterVisualsRef = playerOrCoachRecord.CharacterVisuals;
  const mainCharacterVisualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
  await mainCharacterVisualsTable.readRecords();
  const visualsRecordCapcity = mainCharacterVisualsTable.header.recordCapacity;
  let visualsRecord = null;

  if (characterVisualsRef === FranchiseUtils.ZERO_REF) {
    // If it's all zeroes, we need to set a new reference
    const nextRow = mainCharacterVisualsTable.header.nextRecordToUse; // Get the first empty row
    if (nextRow >= visualsRecordCapcity) {
      console.log("ERROR - The CharacterVisuals table has run out of space. Your changes have not been saved.");
      console.log(
        `This means that the amount of players + coaches in your Franchise File exceeds ${visualsRecordCapcity}.`
      );
      FranchiseUtils.EXIT_PROGRAM();
    }
    visualsRecord = mainCharacterVisualsTable.records[nextRow];
    characterVisualsRef = getBinaryReferenceData(mainCharacterVisualsTable.header.tableId, nextRow);
    playerOrCoachRecord.CharacterVisuals = characterVisualsRef;
  } else {
    //Else, simply convert the binary ref to the row number value
    const row = FranchiseUtils.getRowFromRef(characterVisualsRef);
    visualsRecord = mainCharacterVisualsTable.records[row];
  }

  return visualsRecord;
}

/**
 * Updates all applicable slot types in a Madden 25 visuals object to use the corresponding Madden 26 slot type
 *
 * @param {Object} visuals - The visuals object from Madden 25
 */
function updateVisualSlotTypes(visuals) {
  for (const loadout of visuals.loadouts) {
    if (loadout.loadoutElements) {
      for (let i = loadout.loadoutElements.length - 1; i >= 0; i--) {
        const loadoutElement = loadout.loadoutElements[i];
        const currentSlotType = loadoutElement.slotType.toLowerCase();
        const searchKey = Object.keys(oldToNewSlotMap).find((key) => key.toLowerCase() === currentSlotType);

        // If the current slot has a new slot type for 26, update it
        if (searchKey) {
          loadoutElement.slotType = oldToNewSlotMap[searchKey];
        } else if (!allSlotTypes.find((slot) => slot.toLowerCase() === currentSlotType)) {
          // Otherwise, if the slot type is no longer in 26, remove the slot
          loadout.loadoutElements.splice(i, 1);
        }
      }
    }
  }
}

function isFemaleHead(coachRecord) {
  const head = coachRecord?.GenericHeadAssetName;
  const bodyType = coachRecord?.CharacterBodyType;

  if (!head || bodyType == null) return false;

  return (
    FEMALE_BODY_TYPES.includes(bodyType) ||
    head.includes("Female") ||
    (FranchiseUtils.startsWithNumber(head) && FranchiseUtils.getCharacterAfterNthUnderscore(head, 1) === "F")
  );
}

function shouldAddHeadSection(coachRecord) {
  const head = coachRecord?.GenericHeadAssetName;
  return typeof head === "string" && head.endsWith("_HS");
}

module.exports = {
  updateVisualSlotTypes,
};
