const helpers = require("./characterVisualHelpers");

const { baseCoachVisuals, baseFemaleVisuals, coachVisualsLookup } = helpers.loadVisualLookups("27");

const config = { baseCoachVisuals, baseFemaleVisuals, coachVisualsLookup, syncBodyType: true };

async function generateCoachVisuals(franchise, tables, coachRecord) {
  return helpers.generateCoachVisuals(franchise, tables, coachRecord, config);
}

module.exports = {
  ...helpers,
  baseFemaleVisuals,
  baseCoachVisuals,
  coachVisualsLookup,
  generateCoachVisuals,
};
