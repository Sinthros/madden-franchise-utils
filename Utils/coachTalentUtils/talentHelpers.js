const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../FranchiseUtils");

const TALENT_SOURCES = {
  GAMEDAY: "GamedayTalentInfo",
  WEARANDTEAR: "WearAndTearTalentInfo",
  SEASON: "SeasonTalentInfo",
  PLAYSHEET: "PlaysheetTalentInfo",
};

const TALENT_TIER_STATUSES = {
  OWNED: "Owned",
  NOTOWNED: "NotOwned",
  PURCHASABLE: "Purchasable",
  MASTERED: "Mastered",
};

/* -------------------------------------------------------------
   Lookup helpers (lookups = { staffArchetype, talents, talentTiers,
   talentInfoArray, talentTiersArray } for the relevant game year)
------------------------------------------------------------- */

function getArchetypeTalents(lookups, coachRecord) {
  const archetypeRecord = lookups.staffArchetype.find((a) => a.Archetype === coachRecord.Archetype);
  if (!archetypeRecord) {
    throw new Error(`No staff archetype found for ${coachRecord.Archetype}`);
  }

  const talentInfo = lookups.talentInfoArray.find((t) => t.Binary === archetypeRecord.ArchetypeTalents);
  if (!talentInfo) {
    throw new Error(`No TalentInfoArray entry for binary ${archetypeRecord.ArchetypeTalents}`);
  }

  return talentInfo;
}

function resolveArchetypeTalents(lookups, talentInfoRecord) {
  if (!Array.isArray(talentInfoRecord.TalentInfo)) return [];

  return talentInfoRecord.TalentInfo.map((binary) => {
    const talent = lookups.talents.find((t) => t.Binary === binary);
    if (!talent) {
      console.warn(`Talent binary not found: ${binary}`);
      return null;
    }
    return talent;
  }).filter(Boolean);
}

function getTalentTierLookupRecord(lookups, talent) {
  return lookups.talentTiersArray.find((t) => t.Binary === talent.Tiers);
}

function getTalentTierRecordByIndex(lookups, tierArrayRecord, index) {
  const tierBinary = tierArrayRecord?.TalentTiers?.[index];
  if (!tierBinary) return null;

  const tierRecord = lookups.talentTiers.find((t) => t.Binary === tierBinary);
  if (!tierRecord) {
    console.warn(`Tier binary not found: ${tierBinary}`);
    return null;
  }
  return tierRecord;
}

function createTalentTierArray(franchise, tables) {
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);

  return (async () => {
    const record = await FranchiseUtils.getNextRecord(talentTierArrayTable);
    if (!record) throw new Error("No available records in TalentTierArray table");

    const tierColumns = FranchiseUtils.getColumnNames(talentTierArrayTable);
    for (let index = 0; index < tierColumns.length; index++) {
      const tierRecord = await FranchiseUtils.getNextRecord(talentTierTable);
      if (!tierRecord) throw new Error("No available records in TalentTier table");

      tierRecord.TierStatus = index === 0 ? TALENT_TIER_STATUSES.OWNED : TALENT_TIER_STATUSES.PURCHASABLE;
      record[tierColumns[index]] = getBinaryReferenceData(talentTierTable.header.tableId, tierRecord.index);
    }
    return record;
  })();
}

async function regenerateCoachTalents(franchise, tables, coachRecord, config) {
  const { lookups, supportedSources, attachTalentArrays } = config;

  const talentArrayTable = franchise.getTableByUniqueId(tables.talentArrayTable);
  const gamedayTalentTable = franchise.getTableByUniqueId(tables.gamedayTalentTable);
  const playsheetTalentTable = franchise.getTableByUniqueId(tables.playsheetTalentTable);
  const seasonTalentTable = franchise.getTableByUniqueId(tables.seasonTalentTable);
  const talentTierArrayTable = franchise.getTableByUniqueId(tables.talentTierArrayTable);
  const talentTierTable = franchise.getTableByUniqueId(tables.talentTierTable);

  const gameYear = Number(franchise.schema.meta.gameYear);

  await FranchiseUtils.readTableRecords([
    talentArrayTable,
    gamedayTalentTable,
    playsheetTalentTable,
    seasonTalentTable,
    talentTierArrayTable,
    talentTierTable,
  ]);

  // Two TalentArray records: one for playsheet talents, one for gameday/season talents
  const playsheetArrayRecord = await FranchiseUtils.getNextZeroedRecord(talentArrayTable);
  const gamedayArrayRecord = await FranchiseUtils.getNextZeroedRecord(talentArrayTable);
  if (!playsheetArrayRecord || !gamedayArrayRecord) {
    throw new Error("No available records in TalentArray table");
  }

  await attachTalentArrays({
    franchise,
    tables,
    coachRecord,
    playsheetArrayRef: getBinaryReferenceData(talentArrayTable.header.tableId, playsheetArrayRecord.index),
    gamedayArrayRef: getBinaryReferenceData(talentArrayTable.header.tableId, gamedayArrayRecord.index),
  });

  const talentsList = resolveArchetypeTalents(lookups, getArchetypeTalents(lookups, coachRecord));

  for (const talent of talentsList) {
    const source = talent.Source;

    if (supportedSources && !supportedSources.includes(source)) {
      console.warn(`Skipping talent with unsupported source: ${source}`);
      continue;
    }

    const isPlaysheet = source === TALENT_SOURCES.PLAYSHEET;
    const isSeasonTalent = source === TALENT_SOURCES.SEASON;
    const isGamedayTalent = source === TALENT_SOURCES.GAMEDAY;

    const tableToUse = isPlaysheet ? playsheetTalentTable : isSeasonTalent ? seasonTalentTable : gamedayTalentTable;

    // getNextRecord (not header.nextRecordToUse) so successive talents never reuse the same row
    const talentRecord = await FranchiseUtils.getNextRecord(tableToUse);
    if (!talentRecord) throw new Error(`No available records in talent table for source ${source}`);

    const tierLookup = getTalentTierLookupRecord(lookups, talent);
    const firstTier = getTalentTierRecordByIndex(lookups, tierLookup, 0);
    const secondTier = getTalentTierRecordByIndex(lookups, tierLookup, 1);

    talentRecord.TalentInfo = talent.Binary;
    talentRecord.CurrentTier = 0;
    talentRecord.Status = "None";
    talentRecord.OwnerPosition = coachRecord.Position;
    talentRecord.IsTalentActive = false;
    talentRecord.IsWeeklyLocked = false;
    talentRecord.GoalProgressValue = 0;
    talentRecord.KnockoutConditionProgressValue = 0;

    if (gameYear >= 27) {
      talentRecord.IsRecommended = false;
      talentRecord.IsFavorited = false;
    }

    if (firstTier) talentRecord.CurrentKnockoutCondition = firstTier.KnockoutCondition;
    if (secondTier) talentRecord.CurrentGoal = secondTier.UnlockUpgradeGoal;

    if (isGamedayTalent) {
      talentRecord.IsOnCooldown = false;
      talentRecord.CooldownWeeks = 0;
      talentRecord.TalentDecayWeeksUsed = 0;
    }
    if (isSeasonTalent) {
      talentRecord.LockedWeeks = 0;
    }

    const tierArrayRecord = await createTalentTierArray(franchise, tables);
    talentRecord.Tiers = getBinaryReferenceData(talentTierArrayTable.header.tableId, tierArrayRecord.index);

    FranchiseUtils.addToArrayTable(
      talentArrayTable,
      getBinaryReferenceData(tableToUse.header.tableId, talentRecord.index),
      isPlaysheet ? playsheetArrayRecord.index : gamedayArrayRecord.index,
    );
  }
}

module.exports = {
  TALENT_SOURCES,
  TALENT_TIER_STATUSES,
  getArchetypeTalents,
  resolveArchetypeTalents,
  getTalentTierLookupRecord,
  getTalentTierRecordByIndex,
  createTalentTierArray,
  regenerateCoachTalents,
};
