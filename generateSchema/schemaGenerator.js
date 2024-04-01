
// This allows you to generate a schema formatted for the madden-franchise API/Franchise Editor
// You only would need to use this if there's a new game update and you need the new schema.
// To use this properly, open up the Frosty Editor, and grab the franchise-schemas.FTX file from Legacy Explorer
// Then, replace the current franchise-schemas.FTX file in this directory with yours. Then, simply run node schemaGenerator.js

const schemaGenerationService = require('./schemaGenerationService.js');

try {
    schemaGenerationService.generate('franchise-schemas.FTX');
    console.log("Successfully generated a new schema.");
} catch (e) {
    console.log("Error: " + e);
}