const fs = require('fs');
const path = require('path');

const oldToNewSlotMap = JSON.parse(fs.readFileSync(path.join(__dirname, './26/newSlotTypeMap.json'), 'utf-8'));
const allSlotTypes = Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname, './26/loadoutSlots.json'), 'utf-8')));

/**
 * Updates all applicable slot types in a Madden 25 visuals object to use the corresponding Madden 26 slot type
 *
 * @param {Object} visuals - The visuals object from Madden 25
 */
function updateVisualSlotTypes(visuals)
{
  for (const loadout of visuals.loadouts) 
  {
    if(loadout.loadoutElements)
    {
      for(let i = loadout.loadoutElements.length - 1; i >= 0; i--)
      {
        const loadoutElement = loadout.loadoutElements[i];
        const currentSlotType = loadoutElement.slotType.toLowerCase();
        const searchKey = Object.keys(oldToNewSlotMap).find(key => key.toLowerCase() === currentSlotType);
        
        // If the current slot has a new slot type for 26, update it
        if(searchKey)
        {
          loadoutElement.slotType = oldToNewSlotMap[searchKey];
        }
        else if(!allSlotTypes.find(slot => slot.toLowerCase() === currentSlotType)) // Otherwise, if the slot type is no longer in 26, remove the slot
        {
          loadout.loadoutElements.splice(i, 1);
        }
      }
    }
  }
}

module.exports = {
  updateVisualSlotTypes
};
