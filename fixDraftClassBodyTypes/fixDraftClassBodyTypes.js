// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const path = require('path');
const fs = require('fs');
const { FileParser } = require('./FileParser');

// Valid game years
const validGameYears = [
    FranchiseUtils.YEARS.M26
];

const gameYear = FranchiseUtils.YEARS.M26;

// Required lookup files
const bodyTypeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookupFiles/bodyTypeLookup.json'), 'utf8'));

console.log("This tool fixes Madden 26 draft classes made before the 9/17 patch to have correct body types when importing them.\n");

const dcPath = FranchiseUtils.getSaveFilePath(gameYear, FranchiseUtils.SAVE_TYPES.DRAFTCLASS);

const dcBuf = fs.readFileSync(dcPath);

console.log("\nBeginning draft class repair...")

const dcParser = new FileParser(dcBuf);

dcParser.readBytes(10);

const headerSize = dcParser.readUInt();

dcParser.readBytes(headerSize);

const prospectCount = dcParser.readUInt();

const visualsSize = 4096;

for(let i = 0; i < prospectCount; i++)
{
    const visualsObject = JSON.parse(dcParser.readSizedString(visualsSize));

    let bodyType = 0;

    if(visualsObject.bodyType)
    {
        bodyType = bodyTypeLookup[visualsObject.bodyType] || 0;
    }
    else
    {
        if(visualsObject.loadouts)
        {
            for(const loadout of visualsObject.loadouts)
            {
                if(loadout.loadoutElements)
                {
                    const bodyTypeElement = loadout.loadoutElements.find(element => element.slotType === "CharacterBodyType");

                    if(bodyTypeElement)
                    {
                        bodyType = Object.keys(FranchiseUtils.BODY_TYPE_ITEMS).find(key => FranchiseUtils.BODY_TYPE_ITEMS[key] === bodyTypeElement.itemAssetName.toLowerCase());
                    }
                }
            }
        }
    }

    dcParser.readBytes(0x8D); // Skip to body type byte
    dcBuf[dcParser.offset++] = bodyType;

    dcParser.readBytes(0x3A); // Skip to next prospect
}

console.log("Draft class repair complete.\n");

const save = FranchiseUtils.getYesOrNo("Would you like to save changes? Enter yes or no.");

if(save)
{
    fs.writeFileSync(dcPath, dcBuf);
    console.log("Fixed draft class saved.\n");
}
else
{
    console.log("Draft class not saved.\n");
}

FranchiseUtils.EXIT_PROGRAM();






