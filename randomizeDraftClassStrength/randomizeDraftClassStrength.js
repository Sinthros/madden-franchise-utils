/**
 * @fileoverview Draft class position strength randomizer tool
 * @author clclark01
 * @version 1.0.0
 */

//TODO: plug in user input for each table to allow changes before submitting the update
//allow re rolls
//use a preset/reset option

//Required modules
const fs = require('fs');
const path = require('path');
const prompt = require('prompt-sync')();
const FranchiseUtils = require('../Utils/FranchiseUtils');

//Required lookups
const allPositions = JSON.parse(fs.readFileSync(path.join(__dirname, './positionsForDraftStrength.json')));

//Print tool header message
console.log("This program can be used to randomize your draft class position strength.\n This is meant to be run before the class is auto-generated in week 1 of the regular season.\n");
console.log("40% chance to get Normal, 40% chance to get one of Strong or Weak, and a 20% chance to get Very Weak or Very Strong.\n");
console.log("This program also adds distinctions between HB/FB, MLB/SAM&WILL, FS/SS, and C/G, all of which will not be reflected in Madden's UI");

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

    for(let i = 0; i < posTable.length; i++)
    {
        pos = posTable[i];
        let rollDraftClassStrength = FranchiseUtils.getRandomNumber(1, 10);
        let rollDraftClassStrengthString = "";
            switch(rollDraftClassStrength)
            {   
            case 1:
                rollDraftClassStrengthString = "Very_Weak";
                veryWeakCounter++;
                if(veryWeakCounter > veryWeakCounterLimit)
                {
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
                if(veryStrongCounter > veryStrongCounterLimit)
                {
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
        let str = rollDraftClassStrengthString.replace(/\*/g, '');
        //Replace actual positions w/ positions as they are in table
            if(pos == "EDGE"){
                pos = "DE";
            }
            if(pos == "WILL/SAM"){
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
 * Updates the draft class positional strength table
 * 
 * @param {Object} table The draftClassPosStrength Table
 * @param {Map} result the Map output from randomizeDraftPosStrength (Position => Strength)
 * @returns {Boolean} true on success, false on failure
 */
async function updateDraftClassPosStrengthTable(table, result) {
    rows = table.header.recordCapacity;
    if(!rows)
    {
        return false; //Something went wrong with getting rows in table
    }
    //Iterate through table rows
    for(i=0; i<rows; i++)
    {
        //pull position from table
        pos = table.records[i]["DraftPosition"]; //C, CB, etc
        if(!pos)
        {
            return false; //null check for DraftPosition rows
        }
        strength = result.get(pos);
        if(!strength)
        {
            return false; //null check for missing key in result map
        }
        //update the table according to the strength from the result map
        table.records[i]["DraftClassStrength"] = strength;
    }
}


franchise.on('ready', async function () {

    // Get required tables
    const draftClassPosStrengthTable = franchise.getTableByUniqueId(tables.draftClassPosStrengthTable);

    // Read required tables
    await FranchiseUtils.readTableRecords([draftClassPosStrengthTable]);

    //Get user input for very weak/very strong limiter
	const veryWeakCounterLimit = FranchiseUtils.getUserInputNumber("\nPlease enter the limit of 'Very Weak' positions (or 0 for none): ", 0, 17);
	const veryStrongCounterLimit = FranchiseUtils.getUserInputNumber("\nPlease enter the limit of 'Very Strong' positions (or 0 for none): ", 0, 17);
    console.log("\n");

    //initialize result map
    let newStrengthPositionMap= new Map();

    //call draft randomizer logic
    newStrengthPositionMap = randomizeDraftPosStrength(veryWeakCounterLimit, veryStrongCounterLimit);

    //Get result from update call
    result = updateDraftClassPosStrengthTable(draftClassPosStrengthTable, newStrengthPositionMap);
    if(!result)
    {
        console.log("Something went wrong when trying to update the DraftClassPosStrength Table");
        FranchiseUtils.EXIT_PROGRAM();
    }
    // Program complete, so print success message and exit
    console.log(`\nDraft Board Updated Successfully.\n`);
    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
  
});