const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../FranchiseUtils");

// Lookups
const staffArchetypeLookup = require("../JsonLookups/26/coachLookups/coachTalents/StaffArchetype.json");
const staffGoals = require("../JsonLookups/26/coachLookups/coachTalents/StaffGoals.json");
const talentDisplayStatLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentDisplayStat.json");
const talentsLookup = require("../JsonLookups/26/coachLookups/coachTalents/talents.json");
const talentTiersLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentTiers.json");
const talentInfoArrayLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentInfoArray.json");
const talentTiersArrayLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentTiersArray.json");

function getNextTalentArrayRecord(franchise, tables) {
  const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);
  const nextRow = talentArrayTable.header.nextRecordToUse;
  const record = talentArrayTable.records[nextRow];
  for (const col of FranchiseUtils.getColumnNames(talentArrayTable)) {
    record[col] = FranchiseUtils.ZERO_REF;
  }
  return record;
}

function getTalentTierLookupRecord(talent) {
  return talentTiersArrayLookup.find((t) => t.Binary === talent.Tiers);
}

function getArchetypeTalents(coachRecord) {
  // Find matching staff archetype
  const archetypeRecord = staffArchetypeLookup.find((a) => a.Archetype === coachRecord.Archetype);

  if (!archetypeRecord) {
    console.warn(`No staff archetype found for Archetype: ${coachRecord.Archetype}`);
  }

  const archetypeTalentsBinary = archetypeRecord.ArchetypeTalents;

  // Find matching TalentInfoArray entry
  const talentInfo = talentInfoArrayLookup.find((t) => t.Binary === archetypeTalentsBinary);

  if (!talentInfo) {
    console.warn(`No TalentInfoArray entry found for ArchetypeTalents binary: ${archetypeTalentsBinary}`);
  }

  return talentInfo;
}

function processArchetypeTalents(talentInfoRecord) {
  const resolvedTalents = [];

  for (const [key, binary] of Object.entries(talentInfoRecord)) {
    if (key === "Binary") continue;
    if (!binary || binary === "00000000000000000000000000000000") continue;

    const talentRecord = talentsLookup.find((t) => t.Binary === binary);

    if (!talentRecord) {
      console.warn(`Talent binary not found: ${binary}`);
      continue;
    }

    resolvedTalents.push({
      Slot: key,
      ...talentRecord,
    });
  }

  return resolvedTalents;
}

function getTalentTierBinaryByIndex(tierRecord, index) {
  if (!tierRecord || typeof tierRecord !== "object") return null;

  const tierKeys = Object.keys(tierRecord)
    .filter((k) => k.startsWith("TalentTierInfo"))
    .sort((a, b) => {
      const ai = parseInt(a.replace("TalentTierInfo", ""), 10);
      const bi = parseInt(b.replace("TalentTierInfo", ""), 10);
      return ai - bi;
    });

  if (index < 0 || index >= tierKeys.length) return null;

  return tierRecord[tierKeys[index]] ?? null;
}

function getTalentTierRecordByIndex(tierRecord, index) {
  const tierBinary = getTalentTierBinaryByIndex(tierRecord, index);
  if (!tierBinary) return null;

  const fullRecord = talentTiersLookup.find((t) => t.Binary === tierBinary);

  if (!fullRecord) {
    console.warn(`Tier talent binary not found: ${tierBinary}`);
    return null;
  }

  return fullRecord;
}

async function regenerateTalents(franchise, tables, coachRecord) {
  const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);
  const gamedayTalentTable = franchise.getTableByUniqueId(tables.gamedayTalentTable);
  const wearAndTearTalentTable = franchise.getTableByUniqueId(tables.wearAndTearTalentTable);
  const playsheetTalentTable = franchise.getTableByUniqueId(tables.playsheetTalentTable);
  const seasonTalentTable = franchise.getTableByUniqueId(tables.seasonTalentTable);
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);

  const playsheetTalentsRecord = getNextTalentArrayRecord(franchise, tables);
  const gamedayTalentsRecord = getNextTalentArrayRecord(franchise, tables);
  coachRecord.PlaysheetTalents = getBinaryReferenceData(talentArrayTable.header.tableId, playsheetTalentsRecord.index);
  coachRecord.GamedayTalents = getBinaryReferenceData(talentArrayTable.header.tableId, gamedayTalentsRecord.index);

  const archetypeTalents = getArchetypeTalents(coachRecord);
  const talentsList = processArchetypeTalents(archetypeTalents);

  for (const talent of talentsList) {
    const source = talent.Source;
    const isPlaysheet = source === "PlaysheetTalentInfo";
    const isSeasonTalent = source === "SeasonTalentInfo";
    const isGamedayTalent = source === "GamedayTalentInfo";
    const tableToUse = isPlaysheet ? playsheetTalentTable : isSeasonTalent ? seasonTalentTable : gamedayTalentTable;

    const nextRow = tableToUse.header.nextRecordToUse;

    const talentRecord = tableToUse.records[nextRow];
    const talentTierRecord = getTalentTierLookupRecord(talent);
    const firstTalentTier = getTalentTierRecordByIndex(talentTierRecord, 0);
    const secondTalentTier = getTalentTierRecordByIndex(talentTierRecord, 1);

    talentRecord.TalentInfo = talent.Binary;
    talentRecord.CurrentKnockoutCondition = firstTalentTier.KnockoutCondition;
    talentRecord.CurrentGoal = secondTalentTier.UnlockUpgradeGoal;
    talentRecord.CurrentTier = 0;
    talentRecord.Status = "None";
    talentRecord.GoalProgressValue = 0;
    talentRecord.KnockoutConditionProgressValue = 0;
    talentRecord.OwnerPosition = coachRecord.Position;
    talentRecord.IsRecommended = false;
    talentRecord.IsTalentActive = false;
    talentRecord.IsWeeklyLocked = false;

    if (isGamedayTalent) {
      talentRecord.IsOnCooldown = false;
      talentRecord.CooldownWeeks = 0;
      talentRecord.TalentDecayWeeksUsed = 0;
    }
    if (isSeasonTalent) {
      talentRecord.LockedWeeks = 0;
    }

    // Get talent array record
    const talentTierArrayRecord = getTalentTierArrayRecord(franchise, tables);
    talentRecord.Tiers = getBinaryReferenceData(talentTierArrayTable.header.tableId, talentTierArrayRecord.index);

    const indexToUse = isPlaysheet ? playsheetTalentsRecord.index : gamedayTalentsRecord.index;
    FranchiseUtils.addToArrayTable(
      talentArrayTable,
      getBinaryReferenceData(tableToUse.header.tableId, talentRecord.index),
      indexToUse
    );
  }
}

function getTalentTierArrayRecord(franchise, tables) {
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);
  const nextRow = talentTierArrayTable.header.nextRecordToUse;
  const record = talentTierArrayTable.records[nextRow];

  for (const col of FranchiseUtils.getColumnNames(talentTierArrayTable)) {
    const tierRecord = getTalentTierRecord(franchise, tables);
    tierRecord.TierStatus = col === "TalentTier0" ? "Owned" : "Purchasable";
    record[col] = getBinaryReferenceData(talentTierTable.header.tableId, tierRecord.index);
  }

  return record;
}

function getTalentTierRecord(franchise, tables) {
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);
  const nextRow = talentTierTable.header.nextRecordToUse;
  return talentTierTable.records[nextRow];
}

module.exports = {
  regenerateTalents,
};
