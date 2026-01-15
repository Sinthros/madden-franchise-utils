const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../FranchiseUtils");

// Lookups
const staffArchetypeLookup = require("../JsonLookups/26/coachLookups/coachTalents/StaffArchetype.json");
const staffGoals = require("../JsonLookups/26/coachLookups/coachTalents/StaffGoals.json");
const talentDisplayStatLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentDisplayStat.json");
const talentsLookup = require("../JsonLookups/26/coachLookups/coachTalents/Talents.json");
const talentTiersLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentTiers.json");
const talentInfoArrayLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentInfoArray.json");
const talentTiersArrayLookup = require("../JsonLookups/26/coachLookups/coachTalents/TalentTiersArray.json");

const TALENT_SOURCES = {
  GAMEDAY: "GamedayTalentInfo",
  WEARANDTEAR: "WearAndTearTalentInfo",
  SEASON: "SeasonTalentInfo",
  PLAYSHEET: "PlaysheetTalentInfo",
};

const TALENT_TIER_SOURCES = {
  TALENTTIER: "TalentTierInfo",
  PLAYSHEET: "PlaysheetTalentTierInfo",
  WEARANDTEAR: "WearAndTearTalentTierInfo",
};

const TALENT_TIER_STATUSES = {
  OWNED: "Owned",
  NOTOWNED: "NotOwned",
  PURCHASABLE: "Purchasable",
  MASTERED: "Mastered",
};

/* -------------------------------------------------------------
   Helpers
------------------------------------------------------------- */

async function getNextTalentArrayRecord(franchise, tables) {
  const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);
  return await FranchiseUtils.getNextZeroedRecord(talentArrayTable);
}

function getArchetypeTalents(coachRecord) {
  const archetypeRecord = staffArchetypeLookup.find((a) => a.Archetype === coachRecord.Archetype);

  if (!archetypeRecord) {
    throw new Error(`No staff archetype found for ${coachRecord.Archetype}`);
  }

  const talentInfo = talentInfoArrayLookup.find((t) => t.Binary === archetypeRecord.ArchetypeTalents);

  if (!talentInfo) {
    throw new Error(`No TalentInfoArray entry for binary ${archetypeRecord.ArchetypeTalents}`);
  }

  return talentInfo;
}

function resolveArchetypeTalents(talentInfoRecord) {
  if (!Array.isArray(talentInfoRecord.TalentInfo)) return [];

  return talentInfoRecord.TalentInfo.map((binary) => {
    const talent = talentsLookup.find((t) => t.Binary === binary);
    if (!talent) {
      console.warn(`Talent binary not found: ${binary}`);
      return null;
    }
    return talent;
  }).filter(Boolean);
}

function getTalentTierLookupRecord(talent) {
  return talentTiersArrayLookup.find((t) => t.Binary === talent.Tiers);
}

function getTalentTierRecordByIndex(tierArrayRecord, index) {
  const tierBinary = tierArrayRecord?.TalentTiers?.[index];
  if (!tierBinary) return null;

  const tierRecord = talentTiersLookup.find((t) => t.Binary === tierBinary);

  if (!tierRecord) {
    console.warn(`Tier binary not found: ${tierBinary}`);
    return null;
  }

  return tierRecord;
}

/* -------------------------------------------------------------
   Talent Regeneration
------------------------------------------------------------- */

async function regenerateTalents(franchise, tables, coachRecord) {
  const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);
  const gamedayTalentTable = franchise.getTableByUniqueId(tables.gamedayTalentTable);
  const wearAndTearTalentTable = franchise.getTableByUniqueId(tables.wearAndTearTalentTable);
  const playsheetTalentTable = franchise.getTableByUniqueId(tables.playsheetTalentTable);
  const seasonTalentTable = franchise.getTableByUniqueId(tables.seasonTalentTable);
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);

  const playsheetTalentsRecord = await getNextTalentArrayRecord(franchise, tables);
  const gamedayTalentsRecord = await getNextTalentArrayRecord(franchise, tables);

  coachRecord.PlaysheetTalents = getBinaryReferenceData(talentArrayTable.header.tableId, playsheetTalentsRecord.index);

  coachRecord.GamedayTalents = getBinaryReferenceData(talentArrayTable.header.tableId, gamedayTalentsRecord.index);

  const archetypeTalents = getArchetypeTalents(coachRecord);
  const talentsList = resolveArchetypeTalents(archetypeTalents);

  for (const talent of talentsList) {
    const source = talent.Source;

    const isPlaysheet = source === TALENT_SOURCES.PLAYSHEET;
    const isSeasonTalent = source === TALENT_SOURCES.SEASON;
    const isGamedayTalent = source === TALENT_SOURCES.GAMEDAY;

    const tableToUse = isPlaysheet ? playsheetTalentTable : isSeasonTalent ? seasonTalentTable : gamedayTalentTable;

    const talentRecord = tableToUse.records[tableToUse.header.nextRecordToUse];

    const tierArrayRecord = getTalentTierLookupRecord(talent);
    const firstTier = getTalentTierRecordByIndex(tierArrayRecord, 0);
    const secondTier = getTalentTierRecordByIndex(tierArrayRecord, 1);

    talentRecord.TalentInfo = talent.Binary;
    talentRecord.CurrentTier = 0;
    talentRecord.Status = "None";
    talentRecord.OwnerPosition = coachRecord.Position;
    talentRecord.IsTalentActive = false;
    talentRecord.IsWeeklyLocked = false;
    talentRecord.GoalProgressValue = 0;
    talentRecord.KnockoutConditionProgressValue = 0;

    if (firstTier) {
      talentRecord.CurrentKnockoutCondition = firstTier.KnockoutCondition;
    }

    if (secondTier) {
      talentRecord.CurrentGoal = secondTier.UnlockUpgradeGoal;
    }

    if (isGamedayTalent) {
      talentRecord.IsOnCooldown = false;
      talentRecord.CooldownWeeks = 0;
      talentRecord.TalentDecayWeeksUsed = 0;
    }

    if (isSeasonTalent) {
      talentRecord.LockedWeeks = 0;
    }

    const talentTierArrayRecord = await getTalentTierArrayRecord(franchise, tables);

    talentRecord.Tiers = getBinaryReferenceData(talentTierArrayTable.header.tableId, talentTierArrayRecord.index);

    const indexToUse = isPlaysheet ? playsheetTalentsRecord.index : gamedayTalentsRecord.index;

    FranchiseUtils.addToArrayTable(
      talentArrayTable,
      getBinaryReferenceData(tableToUse.header.tableId, talentRecord.index),
      indexToUse
    );
  }
}

/* -------------------------------------------------------------
   Talent Tier Array Creation
------------------------------------------------------------- */

async function getTalentTierArrayRecord(franchise, tables) {
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);

  await talentTierArrayTable.readRecords();
  await talentTierTable.readRecords();

  const record = talentTierArrayTable.records[talentTierArrayTable.header.nextRecordToUse];

  if (!record) {
    throw new Error("No available TalentTierArray records");
  }

  const tierCount = FranchiseUtils.getColumnNames(talentTierArrayTable).length;

  for (let i = 0; i < tierCount; i++) {
    const tierRecord = await getNextTalentTierRecord(franchise, tables);
    tierRecord.TierStatus = i === 0 ? TALENT_TIER_STATUSES.OWNED : TALENT_TIER_STATUSES.PURCHASABLE;

    record[`TalentTierInfo${i}`] = getBinaryReferenceData(talentTierTable.header.tableId, tierRecord.index);
  }

  return record;
}

async function getNextTalentTierRecord(franchise, tables) {
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);
  return await FranchiseUtils.getNextRecord(talentTierTable);
}

module.exports = {
  regenerateTalents,
};
