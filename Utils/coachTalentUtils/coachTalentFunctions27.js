const { getBinaryReferenceData, getReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require("../FranchiseUtils");
const { TALENT_SOURCES, regenerateCoachTalents } = require("./talentHelpers");

const lookups = {
  staffArchetype: require("../JsonLookups/27/coachLookups/coachTalents/StaffArchetype.json"),
  talents: require("../JsonLookups/27/coachLookups/coachTalents/Talents.json"),
  talentTiers: require("../JsonLookups/27/coachLookups/coachTalents/TalentTiers.json"),
  talentInfoArray: require("../JsonLookups/27/coachLookups/coachTalents/TalentInfoArray.json"),
  talentTiersArray: require("../JsonLookups/27/coachLookups/coachTalents/TalentTiersArray.json"),
};

const SUPPORTED_SOURCES = [TALENT_SOURCES.GAMEDAY, TALENT_SOURCES.SEASON, TALENT_SOURCES.PLAYSHEET];

async function attachTalentArrays({ franchise, tables, coachRecord, playsheetArrayRef, gamedayArrayRef }) {
  const staffTalentsTable = franchise.getTableByUniqueId(tables.staffTalentsTable);
  await staffTalentsTable.readRecords();
  const staffTalentsRecord = await FranchiseUtils.getNextZeroedRecord(staffTalentsTable);
  staffTalentsRecord.PlaysheetTalents = playsheetArrayRef;
  staffTalentsRecord.GamedayTalents = gamedayArrayRef;
  coachRecord.StaffTalents = getBinaryReferenceData(staffTalentsTable.header.tableId, staffTalentsRecord.index);
}

async function regenerateTalents(franchise, tables, coachRecord) {
  return regenerateCoachTalents(franchise, tables, coachRecord, {
    lookups,
    supportedSources: SUPPORTED_SOURCES,
    attachTalentArrays,
  });
}

module.exports = { regenerateTalents };
