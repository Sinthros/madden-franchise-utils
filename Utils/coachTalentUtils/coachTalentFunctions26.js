const { TALENT_SOURCES, regenerateCoachTalents } = require("./talentHelpers");

const lookups = {
  staffArchetype: require("../JsonLookups/26/coachLookups/coachTalents/StaffArchetype.json"),
  talents: require("../JsonLookups/26/coachLookups/coachTalents/Talents.json"),
  talentTiers: require("../JsonLookups/26/coachLookups/coachTalents/TalentTiers.json"),
  talentInfoArray: require("../JsonLookups/26/coachLookups/coachTalents/TalentInfoArray.json"),
  talentTiersArray: require("../JsonLookups/26/coachLookups/coachTalents/TalentTiersArray.json"),
};

async function attachTalentArrays({ coachRecord, playsheetArrayRef, gamedayArrayRef }) {
  coachRecord.PlaysheetTalents = playsheetArrayRef;
  coachRecord.GamedayTalents = gamedayArrayRef;
}

async function regenerateTalents(franchise, tables, coachRecord) {
  return regenerateCoachTalents(franchise, tables, coachRecord, {
    lookups,
    supportedSources: Object.values(TALENT_SOURCES),
    attachTalentArrays,
  });
}

module.exports = { regenerateTalents };
