/**
 * @fileoverview Draft class position strength modifyer tool (randomize, reset, or preset)
 * @author clclark01
 * @version 1.0.0
 */

//TODO: Add the result map to a user input option to allow individual adjustments before saving changes


//Required modules
const fs = require('fs');
const path = require('path');
const FranchiseUtils = require('../Utils/FranchiseUtils');

//Required lookups
const allPositions = JSON.parse(fs.readFileSync(path.join(__dirname, './positionsForDraftStrength.json')));

//Print tool header message
console.log("This program can be used to randomize, preset, or reset your draft class positional strength.\nThis is meant to be run before the class is auto-generated in week 1 of the regular season.\n");
console.log("Randomizer percentages:\n-40% chance to get Normal\n-40% chance to get Strong OR Weak\n-20% chance to get Very Weak OR Very Strong.\n");
console.log("There are also added distinctions between:\n-HB/FB\n-MLB/SAM&WILL\n-FS/SS\n-C/G\n*These will not be reflected in Madden's UI\n\n");

//Set up franchise file 
const validGames = [
    FranchiseUtils.YEARS.M26
];
const franchise = FranchiseUtils.init(validGames);
const tables = FranchiseUtils.getTablesObject(franchise);

/**
 * Randomizes the strength of each draft position
 * 
 * @param {int} veryWeakCounterLimit The limit on positions that can be "Very Weak"
 * @param {int} veryStrongCounterLimit The limit on positions that can be "Very Strong"
 * @returns {Map} A map of each position & each associated strength
 */
function randomizeDraftPosStrength(veryWeakCounterLimit, veryStrongCounterLimit) {
    let normalCounter = 0;
    let weakCounter = 0;
    let veryWeakCounter = 0;
    let strongCounter = 0;
    let veryStrongCounter = 0;
    let affectedCounter = 0;
    let result = new Map();
    let posTable = allPositions.PositionsInDraftTable;
    let pos = "";
    let str = "";

    for (let i = 0; i < posTable.length; i++) {
        pos = posTable[i];
        let rollDraftClassStrength = FranchiseUtils.getRandomNumber(1, 10);
        let rollDraftClassStrengthString = "";
        switch (rollDraftClassStrength) {
            case 1:
                rollDraftClassStrengthString = "Very_Weak";
                veryWeakCounter++;
                if (veryWeakCounter > veryWeakCounterLimit) {
                    veryWeakCounter--;
                    affectedCounter++;
                    weakCounter++;
                    rollDraftClassStrengthString = "Weak*";
                }
                break;
            case 2:
            case 3:
                rollDraftClassStrengthString = "Weak";
                weakCounter++;
                break;
            case 4:
            case 5:
            case 6:
            case 7:
                rollDraftClassStrengthString = "Normal";
                normalCounter++;
                break;
            case 8:
            case 9:
                rollDraftClassStrengthString = "Strong";
                strongCounter++;
                break;
            case 10:
                rollDraftClassStrengthString = "Very_Strong";
                veryStrongCounter++;
                if (veryStrongCounter > veryStrongCounterLimit) {
                    veryStrongCounter--;
                    affectedCounter++;
                    strongCounter++;
                    rollDraftClassStrengthString = "Strong*";
                }
                break;
            default:
                break;
        }
        //Output position and strength pairing
        console.log(pos + ": " + rollDraftClassStrengthString + "\n");
        //Trim the asterisk off the strength String
        str = rollDraftClassStrengthString.replace(/\*/g, '');
        //Replace actual positions w/ positions as they are in table
        if (pos == "EDGE") {
            pos = "DE";
        }
        if (pos == "WILL/SAM") {
            pos = "OLB";
        }
        //add result to map
        result.set(pos, str);
    }
    console.log("TOTALS: Very Weak: " + veryWeakCounter + "\n" + "Weak: " + weakCounter + "\n" + "Normal: " + normalCounter + "\n" + "Strong: " + strongCounter + "\n" + "Very Strong: " + veryStrongCounter);
    console.log("*" + affectedCounter + " strengths changed.");

    return result;
}

/**
 * Either preset OR the strength of each draft position
 * 
 * @param {String} type "Preset" for recommended preset, "Reset" to reset all to Normal
 * @returns {Map} A map of each position & each associated strength
 */
function presetDraftPosStrength(type) {
    let result = new Map();
    if (type == "Reset") {
        let posTable = allPositions.PositionsInDraftTable;
        let pos = "";
        let str = "";
        for (let i = 0; i < posTable.length; i++) {
            pos = posTable[i];
            str = "Normal";
            console.log(pos + ": " + str + "\n");
            if (pos == "EDGE") {
                pos = "DE";
            }
            if (pos == "WILL/SAM") {
                pos = "OLB";
            }
            //add result to map
            result.set(pos, str);
        }
        console.log("All positions set to normal.");
        return result;
    }
    if (type == "Preset") {
        let posTable = allPositions.PositionsInDraftTable;
        for (let i = 0; i < posTable.length; i++) {
            let pos = "";
            let str = "";
            pos = posTable[i];
            str = "Normal";
            if (pos == "CB" || pos == "QB" || pos == "DT" || pos == "HB") {
                str = "Weak";
            }
            console.log(pos + ": " + str + "\n");
            if (pos == "EDGE") {
                pos = "DE";
            }
            if (pos == "WILL/SAM") {
                pos = "OLB";
            }
            //add result to map
            result.set(pos, str);
        }
        console.log("All positions preset to recommended.");
        return result;
    }
    else {
        return null; //error case, caught in main script
    }
}

/**
 * Updates the draft class positional strength table
 * 
 * @param {Object} table The draftClassPosStrength Table
 * @param {Map} result the Map output from  (Position => Strength)
 * @returns {Boolean} true on success, false on failure
 */
async function updateDraftClassPosStrengthTable(table, result) {
    rows = table.header.recordCapacity;
    if (!rows) {
        return false; //Something went wrong with getting rows in table
    }
    //Iterate through table rows
    for (i = 0; i < rows; i++) {
        //pull position from table
        pos = table.records[i]["DraftPosition"]; //C, CB, etc
        if (!pos) {
            return false; //null check for DraftPosition rows
        }
        strength = result.get(pos);
        if (!strength) {
            return false; //null check for missing key in result map
        }
        //update the table according to the strength from the result map
        table.records[i]["DraftClassStrength"] = strength;
    }
    return true;
}


franchise.on('ready', async function () {

    // Get required tables
    const draftClassPosStrengthTable = franchise.getTableByUniqueId(tables.draftClassPosStrengthTable);

    // Read required tables
    await FranchiseUtils.readTableRecords([draftClassPosStrengthTable]);

    //initialize map, confirmation (allows for rerolls)
    let newStrengthPositionMap = new Map();
    let confirmation = false;

    //set up user selection for draft strength settings
    getAction1 = "Enter 1 to randomize each positional strength\n";
    getAction2 = "Enter 2 to reset all positions back to Normal (Default)\n";
    getAction3 = "Enter 3 to set each positional strength to a recommended preset\n";
    getActionStr = getAction1 + getAction2 + getAction3;
    getVWeakCounterStr = "\nPlease enter the limit of 'Very Weak' positions (0 for all Very Weak --> Weak): ";
    getVStrongCounterStr = "\nPlease enter the limit of 'Very Strong' positions (0 for all Very Strong --> Strong): ";
    confirmationStr = "Confirm draft class changes?\n(Y)es to save draft class strength\n(N)o to reroll";

    validActions = [1, 2, 3];

    while (confirmation == false) { //until the user confirms a selection...
        let action = 0;
        newStrengthPositionMap = new Map(); //reset map on rerolls
        action = parseInt(FranchiseUtils.getUserSelection(getActionStr, validActions)); //get user selection
        if (action == 1) { //randomizer logic
            const veryWeakCounterLimit = FranchiseUtils.getUserInputNumber(getVWeakCounterStr, 0, 17);
            const veryStrongCounterLimit = FranchiseUtils.getUserInputNumber(getVStrongCounterStr, 0, 17);
            console.log("\n");
            newStrengthPositionMap = randomizeDraftPosStrength(veryWeakCounterLimit, veryStrongCounterLimit);
            console.log("\n");
            confirmation = FranchiseUtils.getYesOrNo(confirmationStr, true);
            console.log("\n");
        }
        if (action == 2) { //reset all to normal
            newStrengthPositionMap = presetDraftPosStrength("Reset");
            confirmation = FranchiseUtils.getYesOrNo(confirmationStr, true);
            console.log("\n");
        }
        if (action == 3) { //use recommended preset
            newStrengthPositionMap = presetDraftPosStrength("Preset")
            confirmation = FranchiseUtils.getYesOrNo(confirmationStr, true);
            console.log("\n");
        }
        if (action == 0) {
            console.log("Something went wrong when trying figure out what you wanted to do. :( ");
            FranchiseUtils.EXIT_PROGRAM();
        }
    }

    if (newStrengthPositionMap.size !== draftClassPosStrengthTable.header.recordCapacity) //error check for map creation
    {
        console.log("Something went wrong when trying to create the position to strength mapping. :( ");
        FranchiseUtils.EXIT_PROGRAM();
    }

    //Get result from update call
    result = updateDraftClassPosStrengthTable(draftClassPosStrengthTable, newStrengthPositionMap);
    if (result == false) {
        console.log("Something went wrong when trying to update the DraftClassPosStrength Table. :( ");
        FranchiseUtils.EXIT_PROGRAM();
    }

    // Program complete, so print success message and exit
    console.log(`\nDraft Board Updated Successfully.\n`);
    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
});