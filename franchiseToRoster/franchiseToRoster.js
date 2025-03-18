// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const MaddenRosterHelper = require('madden-file-tools/helpers/MaddenRosterHelper');
const TDBHelper = require('madden-file-tools/helpers/TDBHelper');
const prompt = require('prompt-sync')();
const fs = require('fs');

// Valid game years
const validGameYears = [
    FranchiseUtils.YEARS.M25
];

// Required lookup files
const directTransferFields = JSON.parse(fs.readFileSync('lookupFiles/directTransferFields.json', 'utf8'));
const booleanFields = JSON.parse(fs.readFileSync('lookupFiles/booleanFields.json', 'utf8'));
const arithmeticFields = JSON.parse(fs.readFileSync('lookupFiles/arithmeticFields.json', 'utf8'));
const enumFields = JSON.parse(fs.readFileSync('lookupFiles/enumFields.json', 'utf8'));
const miscFields = JSON.parse(fs.readFileSync('lookupFiles/miscFields.json', 'utf8'));
const collegeLookup = JSON.parse(fs.readFileSync('../Utils/JsonLookups/25/colleges.json', 'utf8'));

// VIsuals lookup files
const bodyTypeLookup = JSON.parse(fs.readFileSync('lookupFiles/visualsLookups/bodyTypeLookup.json', 'utf8'));
const loadoutLookup = JSON.parse(fs.readFileSync('lookupFiles/visualsLookups/loadoutLookup.json', 'utf8'));
const slotLookup = JSON.parse(fs.readFileSync('lookupFiles/visualsLookups/slotTypeLookup.json', 'utf8'));

console.log("This program will allow you to convert a franchise file into a roster file. Please ensure that you have read the README.txt file before using this tool.\n");

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears, {promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);


let rosterPath = "resources/league.db";
const roster = new TDBHelper();

// Function to handle transferring direct transfer fields
async function handleDirectTransferPlayerFields(player, rosterPlayer)
{
    for(const field in directTransferFields)
    {
        const rosterField = directTransferFields[field];

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

        const currLookup = JSON.parse(fs.readFileSync(`lookupFiles/enumLookups/${rosterField}Lookup.json`, 'utf8'));

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

    for(let i = 0; i < loadouts.length; i++)
    {
        const currLoadout = loadouts[i];
        let rosterLoadout;
        if(currLoadout.hasOwnProperty("loadoutCategory"))
        {
            const loadoutCategory = loadoutLookup["loadoutCategory"][currLoadout.loadoutCategory];
            rosterLoadout = rosterLoadouts.records.find(loadout => loadout.LDCT === loadoutCategory);

            if(!rosterLoadout)
            {
                continue;
            }
        }
        else if(currLoadout.hasOwnProperty("loadoutType"))
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
            console.log("made it to skipping this loadout");
            continue;
        }

        //console.log("made it past defining rosterElements");

        if(rosterElements.numEntries === 0)
        {
            continue;
        }

        if(loadoutElements.length > rosterElements.numEntries)
        {
            // Trim the loadout elements to match the roster elements
            loadoutElements.splice(rosterElements.numEntries);
            
            /*const numToAdd = loadoutElements.length - rosterElements.numEntries;
            console.log(`Adding ${numToAdd} elements to the roster elements`);
            
            for(let j = 0; j < numToAdd; j++)
            {
                console.log("adding record");
                rosterElements.addRecord(rosterElements.records[0].deepCopyRecord());
                console.log("added record");
            }*/
        }

        //console.log("made it here");

        for(let j = 0; j < loadoutElements.length; j++)
        {
            const currElement = loadoutElements[j];
            const currSlot = slotLookup[currElement.slotType];
            const rosterElement = rosterElements.records.find(element => element.SLOT === currSlot);

            if(!rosterElement)
            {
                continue; // Placeholder, deal with this later
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

                if(rosterElement.IBLD.records[0].BASE && currElement.blends.hasOwnProperty("baseBlend"))
                {
                    rosterElement.IBLD.records[0].BASE = currElement.blends.baseBlend;
                }

                if(rosterElement.IBLD.records[0].BARY && currElement.blends.hasOwnProperty("barycentricBlend"))
                {
                    rosterElement.IBLD.records[0].BARY = currElement.blends.barycentricBlend;
                }
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

// Function to handle transferring player records
async function handlePlayerRecords(recordsToTransfer, playerTable, visualsTable, rosterPlayerTable/*, rosterVisualsTable*/) 
{
    const numPlayers = recordsToTransfer.length;

    const visualsMap = {
        characterVisualsPlayerMap: {}
    };
    
    for(let i = 0; i < numPlayers && i < rosterPlayerTable.records.length; i++)
    {
        const rosterPlayer = rosterPlayerTable.records[i];
        const player = recordsToTransfer[i];

        // Handle direct transfer fields
        await handleDirectTransferPlayerFields(player, rosterPlayer);

        // Handle boolean fields
        await handleBooleanFields(player, rosterPlayer);

        // Handle arithmetic fields
        await handleArithmeticFields(player, rosterPlayer);

        // Handle enum fields
        await handleEnumFields(player, rosterPlayer);

        // Handle misc fields
        await handleMiscFields(player, rosterPlayer);

        // Handle CharacterVisuals
        handleCharacterVisualsToJson(player, rosterPlayer, visualsTable, /*rosterVisualsTable,*/ visualsMap.characterVisualsPlayerMap);
        
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

    fs.writeFileSync("convertedRoster_visuals.json", JSON.stringify(visualsMap, null, 4));
}

franchise.on('ready', async function () {
    roster.load(rosterPath).then(async () => {
        // Set up tables from the franchise
        const playerTable = franchise.getTableByUniqueId(tables.playerTable);
        const visualsTable = franchise.getTableByUniqueId(tables.characterVisualsTable);
        await FranchiseUtils.readTableRecords([playerTable, visualsTable]);

        // Set up tables from the roster
        const rosterPlayerTable = roster.file.PLAY;
        //const rosterVisualsTable = roster.file.PLEX;

        await rosterPlayerTable.readRecords();

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
            console.log("The roster does not have enough space to transfer all the players. This program cannot continue.");
            console.log(`The roster file has ${numRosterPlayers} players, but ${recordsToTransfer.length} players would be transferred.`);
            FranchiseUtils.EXIT_PROGRAM();
        }

        console.log("Working on conversion...");
        await handlePlayerRecords(recordsToTransfer, playerTable, visualsTable, rosterPlayerTable /*rosterVisualsTable*/);

        // Program complete, so print success message, save the franchise file, and exit
        console.log("\nFranchise converted successfully.\n");
        await saveRosterFile(roster);
        FranchiseUtils.EXIT_PROGRAM();
    });
});

async function saveRosterFile(roster) {
    const save = FranchiseUtils.getYesOrNo("Would you like to save the converted roster? Enter yes or no.");

    if(save) {
        await roster.save("convertedRoster_league.db");
        console.log("Roster saved successfully.");
    }
    else {
        console.log("Roster not saved.");
        if(fs.existsSync("convertedRoster_visuals.json")) {
            fs.unlinkSync("convertedRoster_visuals.json");
        }
    }
}

  