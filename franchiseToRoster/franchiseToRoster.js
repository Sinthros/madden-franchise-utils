// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const path = require('path');
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');
const fs = require('fs');

// Valid game years
const validGameYears = [
    FranchiseUtils.YEARS.M25,
    FranchiseUtils.YEARS.M26
];

// Required lookup files
const directTransferFields = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/directTransferFields.json'), 'utf8'));
const booleanFields = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/booleanFields.json'), 'utf8'));
const arithmeticFields = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/arithmeticFields.json'), 'utf8'));
const enumFields = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/enumFields.json'), 'utf8'));
const miscFields = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/miscFields.json'), 'utf8'));
const collegeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, '../Utils/JsonLookups/25/colleges.json'), 'utf8'));

// Visuals lookup files
const bodyTypeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/visualsLookups/bodyTypeLookup.json'), 'utf8'));
const loadoutLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/visualsLookups/loadoutLookup.json'), 'utf8'));
const slotLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/visualsLookups/slotTypeLookup.json'), 'utf8'));

console.log(`This program will allow you to convert a franchise file into a roster file. Madden ${FranchiseUtils.formatListString(validGameYears)} franchise files are supported.\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = franchise.schema.meta.gameYear;


let rosterPath = FranchiseUtils.getSaveFilePath(gameYear, FranchiseUtils.SAVE_TYPES.ROSTER);
const roster = new MaddenRosterHelper();

// Function to handle transferring direct transfer fields
async function handleDirectTransferPlayerFields(player, rosterPlayer)
{
    for(const field in directTransferFields)
    {
        let rosterField = directTransferFields[field];

        if(rosterField === "PLPM" && !rosterPlayer.fields.hasOwnProperty(rosterField))
        {
            rosterField = "PLPm";
        }

        rosterPlayer[rosterField] = player[field];

    }
}

// Function to handle transferring boolean fields
async function handleBooleanFields(player, rosterPlayer)
{
    const playerFields = Object.keys(player.fields);

    for(const field in booleanFields)
    {
        if(!playerFields.includes(field))
        {
            continue;
        }

        const rosterField = booleanFields[field];

        if(!Object.keys(rosterPlayer.fields).includes(rosterField))
        {
            continue;
        }

        rosterPlayer[rosterField] = player[field] ? 1 : 0;
    }
}

async function handleEnumFields(player, rosterPlayer)
{
    const playerFields = Object.keys(player.fields);

    for(const field in enumFields)
    {
        if(!playerFields.includes(field))
        {
            continue;
        }

        const rosterField = enumFields[field];

        const currLookup = JSON.parse(fs.readFileSync(path.join(__dirname, `lookupFiles/enumLookups/${gameYear.toString()}/${rosterField}Lookup.json`), 'utf8'));

        rosterPlayer[rosterField] = currLookup[player[field]];
    }
}

async function handleArithmeticFields(player, rosterPlayer)
{
    const playerFields = Object.keys(player.fields);

    for(const field in arithmeticFields)
    {
        if(!playerFields.includes(field))
        {
            continue;
        }

        const rosterField = arithmeticFields[field];

        if(field === "TeamIndex")
        {
            if(player[field] === 32)
            {
                rosterPlayer[rosterField] = 1009;
            }
            else
            {
                rosterPlayer[rosterField] = player[field] + 1;
            }

            continue;
        }

        if(field === "PLYR_DRAFTTEAM")
        {
            rosterPlayer[rosterField] = player[field] + 1;
            continue;
        }

        if(field === "ContractYear")
        {
            rosterPlayer[rosterField] = player['ContractLength'] - player[field];
        }
    }
}

async function handleMiscFields(player, rosterPlayer)
{
    const playerFields = Object.keys(player.fields);

    for(const field in miscFields)
    {
        if(!playerFields.includes(field))
        {
            continue;
        }

        const rosterField = miscFields[field];

        if(field === "College")
        {
            const playerCollegeId = FranchiseUtils.bin2Dec(player[field]);

            // Find object in college lookup with matching AssetId
            const college = collegeLookup.find(college => college.AssetId === playerCollegeId);

            if(!college)
            {
                rosterPlayer[rosterField] = 0;
                continue;
            }
            
            rosterPlayer[rosterField] = college.COLLEGE_ID;
        }
    }
}

async function handleCharacterVisuals(player, rosterPlayer, visualsTable, rosterVisualsTable)
{
    const playerVisualsRow = FranchiseUtils.bin2Dec(player.CharacterVisuals.slice(15));
    const rosterVisualsIndex = rosterPlayer.POID;

    //console.log(`Player Visuals Row: ${playerVisualsRow}`);

    const rosterVisuals = rosterVisualsTable.records.find(visuals => visuals.index === rosterVisualsIndex);

    const playerVisuals = JSON.parse(visualsTable.records[playerVisualsRow].RawData);

    // Set player body type (this is for franchise to work properly, thanks a bunch EA!)
    rosterPlayer.PCBT = bodyTypeLookup[player.CharacterBodyType];

    // Handle top level record fields
    rosterVisuals.ASNM = rosterPlayer.PEPS;
    rosterVisuals.BTYP = bodyTypeLookup[player.CharacterBodyType];
    rosterVisuals.CFNM = rosterPlayer.PFNA;
    rosterVisuals.CJNO = rosterPlayer.PJEN;
    rosterVisuals.CLNM = rosterPlayer.PLNA;
    rosterVisuals.GENR = player.GenericHeadAssetName;
    rosterVisuals.GNHD = rosterPlayer.PGHE;
    rosterVisuals.HINC = rosterPlayer.PHGT;
    rosterVisuals.SKNT = playerVisuals.skinTone || player.GenericHeadAssetName.slice(4, 5);
    rosterVisuals.WLBS = rosterPlayer.PWGT + 160;

    // Handle loadouts
    await handleLoadouts(playerVisuals, rosterVisuals);
}

async function handleLoadouts(playerVisuals, rosterVisuals)
{
    const loadouts = playerVisuals.loadouts;
    const rosterLoadouts = rosterVisuals.LOUT;

    if(!loadouts.find(loadout => loadout.hasOwnProperty("loadoutCategory") && loadout.loadoutCategory === "Base"))
    {
        for(let j = 0; j < rosterLoadouts.numEntries; j++)
        {
            const currRosterLoadout = rosterLoadouts.records[j];
            if(currRosterLoadout.fields.hasOwnProperty("LDCT") && currRosterLoadout.LDCT === 5)
            {
                rosterLoadouts.removeRecord(j);
                break;
            }
        }
    }

    for(let i = 0; i < loadouts.length; i++)
    {
        const currLoadout = loadouts[i];
        let rosterLoadout;

        

        if(currLoadout.hasOwnProperty("loadoutCategory") && currLoadout.loadoutCategory.toLowerCase() !== "gearonly")
        {
            const loadoutCategory = loadoutLookup["loadoutCategory"][currLoadout.loadoutCategory];
            rosterLoadout = rosterLoadouts.records.find(loadout => loadout.LDCT === loadoutCategory);

            if(!rosterLoadout || !rosterLoadout.PINS)
            {
                continue;
            }

            // For each loadout element, set the IBLD blends to 0
            for(let j = 0; j < rosterLoadout.PINS.numEntries; j++)
            {
                const currElement = rosterLoadout.PINS.records[j];

                if(!currElement.IBLD)
                {
                    continue;
                }

                const currBlend = currElement.IBLD.records[0];
                if(currBlend.BASE)
                {
                    currBlend.BASE = 0;
                }

                if(currBlend.BARY)
                {
                    currBlend.BARY = 0;
                }
            }
        }
        else if(currLoadout.hasOwnProperty("loadoutType") && currLoadout.loadoutType.toLowerCase() !== "head")
        {
            const loadoutType = loadoutLookup["loadoutType"][currLoadout.loadoutType];
            rosterLoadout = rosterLoadouts.records.find(loadout => loadout.LDTY === loadoutType);

            if(!rosterLoadout)
            {
                continue;
            }
        }
        else
        {
            continue;
        }

        const loadoutElements = currLoadout.loadoutElements;
        const rosterElements = rosterLoadout.PINS;

        if(!rosterElements)
        {
            continue;
        }

        //console.log("made it past defining rosterElements");

        if(rosterElements.numEntries === 0)
        {
            continue;
        }

        if(!loadoutElements)
        {
            // Remove each loadout element record from the target loadout elements
            for(let j = rosterElements.numEntries - 1; j >= 0; j--)
            {
                rosterElements.removeRecord(j);
            }

            continue;
        }

        // If there are two of a slot type in the loadout elements, remove one if any that has "_None" in the itemassetname
        Object.keys(slotLookup).forEach(slotType => {
            const slotElements = loadoutElements.filter(element => element.slotType === slotType);
            if(slotElements.length > 1)
            {
                const noneElement = slotElements.find(element => element.itemAssetName.toLowerCase().includes("_none"));
                if(noneElement)
                {
                    const index = loadoutElements.indexOf(noneElement);
                    loadoutElements.splice(index, 1);
                }
            }
        });

        if(loadoutElements.length > rosterElements.numEntries)
        {
            // Trim the loadout elements to match the roster elements
            //loadoutElements.splice(rosterElements.numEntries);
            //console.log("Trimming loadout elements");
            
            const numToAdd = loadoutElements.length - rosterElements.numEntries;
            //console.log(`Adding ${numToAdd} elements to the roster elements`);
            
            /*for(let j = 0; j < numToAdd; j++)
            {
                //console.log("adding record");
                rosterElements.addRecord(rosterElements.records[0].deepCopyRecord());
                //console.log("added record");
            }*/
        }

        //console.log("made it here");

        const usedSlots = [];

        for(let j = 0; j < loadoutElements.length; j++)
        {
            const currElement = loadoutElements[j];
            const currSlot = currElement.slotType ? slotLookup[currElement.slotType] : slotLookup["FaceMask"];
            let rosterElement = rosterElements.records.find(element => currSlot === slotLookup["FaceMask"] ? !element.SLOT || element.SLOT === currSlot : element.SLOT === currSlot);

            if(!rosterElement)
            {
                //continue; // Placeholder, deal with this later
                const newItem = rosterElements.records[0].deepCopyRecord();
                newItem.SLOT = currSlot ? currSlot : slotLookup["FaceMask"];
                rosterElements.addRecord(newItem);
                rosterElement = newItem;
            }

            if(currElement.hasOwnProperty("itemAssetName"))
            {
                rosterElement.ITAN = currElement.itemAssetName;
            }

            if(currElement.hasOwnProperty("blends"))
            {
                if(!rosterElement.IBLD)
                {
                    continue; // Placeholder, deal with this later
                }

                if(rosterElement.IBLD.records[0].fields.hasOwnProperty("BASE") && currElement.blends[0].hasOwnProperty("baseBlend"))
                {
                    rosterElement.IBLD.records[0].BASE = currElement.blends[0].baseBlend;
                }

                if(rosterElement.IBLD.records[0].fields.hasOwnProperty("BARY") && currElement.blends[0].hasOwnProperty("barycentricBlend"))
                {
                    rosterElement.IBLD.records[0].BARY = currElement.blends[0].barycentricBlend;
                }
            }

            usedSlots.push(currSlot);
        }

        // Remove any unused slot records
        for(let j = rosterElements.numEntries - 1; j >= 0; j--)
        {
            const currElement = rosterElements.records[j];
            const currSlot = currElement.SLOT ? currElement.SLOT : slotLookup["FaceMask"];

            if(!usedSlots.includes(currSlot))
            {
                rosterElements.removeRecord(j);
            }
        }
    }
}

function handleCharacterVisualsToJson(player, rosterPlayer, visualsTable, /*rosterVisualsTable,*/ visualsMap)
{
    const playerVisualsRow = FranchiseUtils.bin2Dec(player.CharacterVisuals.slice(15));
    const rosterVisualsIndex = rosterPlayer.POID;

    const rosterVisuals = {};
    const playerVisuals = JSON.parse(visualsTable.records[playerVisualsRow].RawData);

    // Handle top level record fields
    rosterVisuals.assetName = rosterPlayer.PEPS;
    rosterVisuals.bodyType = bodyTypeLookup[player.CharacterBodyType];
    rosterVisuals.firstName = rosterPlayer.PFNA;
    rosterVisuals.jerseyNum = rosterPlayer.PJEN;
    rosterVisuals.lastName = rosterPlayer.PLNA;
    rosterVisuals.genericHeadName = player.GenericHeadAssetName.trim() === "" ? "gen_" + player.PLYR_GENERICHEAD : player.GenericHeadAssetName;
    rosterVisuals.genericHead = JSON.parse(fs.readFileSync('lookupFiles/enumLookups/PGHELookup.json', 'utf8'))[rosterVisuals.genericHeadName];
    rosterVisuals.heightInches = rosterPlayer.PHGT;
    rosterVisuals.skinTone = playerVisuals.skinTone || player.GenericHeadAssetName.slice(4, 5);
    rosterVisuals.weightPounds = rosterPlayer.PWGT + 160;
    rosterVisuals.loadouts = playerVisuals.loadouts;

    visualsMap[rosterVisualsIndex] = rosterVisuals;
}

async function handleContractAmounts(rosterPlayer)
{
    const totalSalary = rosterPlayer.PSA0 + rosterPlayer.PSA1 + rosterPlayer.PSA2 + rosterPlayer.PSA3 + rosterPlayer.PSA4 + rosterPlayer.PSA5 + rosterPlayer.PSA6;
    const totalBonus = rosterPlayer.PSB0 + rosterPlayer.PSB1 + rosterPlayer.PSB2 + rosterPlayer.PSB3 + rosterPlayer.PSB4 + rosterPlayer.PSB5 + rosterPlayer.PSB6;

    rosterPlayer.PTSA = totalSalary;
    rosterPlayer.PSBO = totalBonus;
    rosterPlayer.PVCO = 0;
    rosterPlayer.PVBO = 0;
    rosterPlayer.PVTS = 0;
}

// Function to handle transferring player records
async function handlePlayerRecords(recordsToTransfer, playerTable, visualsTable, rosterPlayerTable, rosterVisualsTable) 
{
    const numPlayers = recordsToTransfer.length;
    
    for(let i = 0; i < numPlayers && i < rosterPlayerTable.records.length; i++)
    {
        const rosterPlayer = rosterPlayerTable.records[i];
        const player = recordsToTransfer[i];

        if(player.GenericHeadAssetName.trim() === "")
        {
            player.GenericHeadAssetName = "gen_" + player.PLYR_GENERICHEAD;
        }

        // Handle direct transfer fields
        await handleDirectTransferPlayerFields(player, rosterPlayer);

        // Handle contract amounts
        await handleContractAmounts(rosterPlayer);

        // Handle boolean fields
        await handleBooleanFields(player, rosterPlayer);

        // Handle arithmetic fields
        await handleArithmeticFields(player, rosterPlayer);

        // Handle enum fields
        await handleEnumFields(player, rosterPlayer);

        // Handle misc fields
        await handleMiscFields(player, rosterPlayer);

        // Handle CharacterVisuals
        await handleCharacterVisuals(player, rosterPlayer, visualsTable, rosterVisualsTable);
        
    }

    for(let i = numPlayers; i < rosterPlayerTable.records.length; i++)
    {
        const rosterPlayer = rosterPlayerTable.records[i];
        rosterPlayer.TGID = 1009;
        rosterPlayer.PFNA = ".";
        rosterPlayer.PLNA = ".";
        rosterPlayer.PPOS = 20;
        rosterPlayer.PSXP = 0;
        rosterPlayer.PAGE = 50;
        rosterPlayer.POID = 0;
        rosterPlayer.PEPS = "";
        
        // Set all rating columns to 0 and overall column to 12
        for(const field in directTransferFields)
        {
            if(field.includes("Rating") || field === "OverallRating")
            {
                const rosterField = directTransferFields[field];

                rosterPlayer[rosterField] = 0;

                if(field === "OverallRating")
                {
                    rosterPlayer[rosterField] = 12;
                }
            }
        }
    }
}

function clearInjuries(rosterInjuryTable)
{
    for(let i = 0; i < rosterInjuryTable.records.length; i++)
    {
        const currInjury = rosterInjuryTable.records[i];
        currInjury.PGID = 0;
    }
}

function inspectRecord(record, depth = 0) {
    console.log(`${' '.repeat(depth)}Record: ${Object.keys(record.fields).length} fields`);
    for (const key in record.fields) {
        const field = record.fields[key];
        if (field.type === 4) {
            console.log(`${' '.repeat(depth)}Subtable ${key} with ${field.value.records.length} records`);
            field.value.records.forEach(r => inspectRecord(r, depth + 2));
        }
    }
}

async function addRosterPlayers(rosterPlayerTable, rosterVisualsTable, numToAdd)
{
    //console.log("Inspecting PLEX[0]:");
    //inspectRecord(rosterVisualsTable.records[0]);
    const newPGID = getHighestPGID(rosterPlayerTable) + 1;

    for(let i = 0; i < numToAdd; i++)
    {
        const newPlayer = rosterPlayerTable.records[0].deepCopyRecord(null, new WeakMap(), true);
        console.log(`Duped player table record ${i}`);
        const newVisuals = rosterVisualsTable.records[0].deepCopyRecord(null, new WeakMap(), true);
        console.log(`Duped visuals table record ${i}`);
        newPlayer.PGID = newPGID + i;
        newPlayer.POID = newPGID + i;
        newVisuals.index = newPGID + i;

        rosterPlayerTable.addRecord(newPlayer);
        rosterVisualsTable.addRecord(newVisuals);
        /*if (i % 2 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
            console.log(`GC break at ${i}, Heap after: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
        }*/
    }
}

function getHighestPGID(rosterPlayerTable)
{
    let highestPGID = 0;

    for(let i = 0; i < rosterPlayerTable.records.length; i++)
    {
        const currPlayer = rosterPlayerTable.records[i];
        if(currPlayer.PGID > highestPGID)
        {
            highestPGID = currPlayer.PGID;
        }
    }

    return highestPGID;
}

franchise.on('ready', async function () {
    roster.load(rosterPath).then(async () => {
        // Set up tables from the franchise
        const playerTable = franchise.getTableByUniqueId(tables.playerTable);
        const visualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
        await FranchiseUtils.readTableRecords([playerTable, visualsTable]);

        // Set up tables from the roster
        const rosterPlayerTable = roster.file.PLAY;
        const rosterVisualsTable = gameYear >= FranchiseUtils.YEARS.M26 ? roster.file.BLOB.records[0].BLBM : roster.file.PLEX;
        const rosterInjuryTable = roster.file.INJY ? roster.file.INJY : null;

        // Number of rows in the player table
        const numRows = playerTable.header.recordCapacity;

        let recordsToTransfer = [];

        // Store all the player records we want to convert
        for (let i = 0; i < numRows; i++) 
        {
            // Check if this is a valid player
            if(!FranchiseUtils.isValidPlayer(playerTable.records[i]))
            {
                continue;
            }

            recordsToTransfer.push(playerTable.records[i]);
        }

        const numRosterPlayers = rosterPlayerTable.records.length;

        if(numRosterPlayers < recordsToTransfer.length)
        {            
            /*console.log("The roster does not have enough space to transfer all the players. This program cannot continue.");
            console.log(`The roster file has ${numRosterPlayers} players, but ${recordsToTransfer.length} players would be transferred.`);
            FranchiseUtils.EXIT_PROGRAM();*/

            const playersToAdd = recordsToTransfer.length - numRosterPlayers;
            console.log(`Adding ${playersToAdd} players to the roster...`);

            await addRosterPlayers(rosterPlayerTable, rosterVisualsTable, playersToAdd);
        }

        // Clear out excess players in the roster
        /*for(let i = recordsToTransfer.length; i < rosterPlayerTable.records.length; i++)
        {
            const rosterPlayer = rosterPlayerTable.records[i];
            const visualsId = rosterPlayer.POID;
    
            // Delete player record and associated visuals record
            rosterPlayerTable.removeRecord(i);
    
            // Find visuals record index of record matching the player's POID
            const visualsIndex = rosterVisualsTable.records.findIndex(visuals => visuals.index === visualsId);
            rosterVisualsTable.removeRecord(visualsIndex);
        }*/

        console.log("Working on conversion...");

        if(rosterInjuryTable)
        {
            clearInjuries(rosterInjuryTable);
        }
        await handlePlayerRecords(recordsToTransfer, playerTable, visualsTable, rosterPlayerTable, rosterVisualsTable);

        // Program complete, so print success message, save the franchise file, and exit
        console.log("\nFranchise converted to roster successfully.");
        console.log("\nIMPORTANT: Please note that you will have to manually reorder the depth chart in-game for each team before using the roster. Otherwise, you may run into crashes/other issues.\n");
        await saveRosterFile(roster);
        FranchiseUtils.EXIT_PROGRAM();
    });
});

async function saveRosterFile(roster) {
    const save = FranchiseUtils.getYesOrNo("Would you like to save the converted roster? Enter yes or no.");

    if(save) {
        await roster.save();
        console.log("Roster saved successfully.");
    }
    else {
        console.log("Roster not saved.");
    }
}

  