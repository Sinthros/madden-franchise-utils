const fs = require('fs');

// Step 1: Read the file synchronously
try {
    const data = fs.readFileSync('./coachvisuals.json', 'utf8');
    const jsonData = JSON.parse(data);

    // Step 2: Initialize the object to store the reformatted data
    let reformattedData = {};

    // Step 3: Loop through each characterVisualsPlayerMap entry
    for (let [key, player] of Object.entries(jsonData.characterVisualsPlayerMap)) {
        const assetName = player.assetName; // Use assetName as the new key
        const containerId = player.containerId; // Store containerId

        // Initialize the new format object for each player
        let formattedPlayer = { "containerId": containerId.toString() };
        const bodyBlends = [
            "ArmSize", "CalfBlend", "Chest", "Feet", "Glute", "Gut", "Thighs"
        ];

        // Step 4: Process the loadouts for items (e.g., shoes, pants)
        player.loadouts.forEach(loadout => {
            loadout.loadoutElements.forEach(element => {
                // Only add clothing/equipment items, not blend values or body morphs
                if (!element.slotType.includes('Blend') && !bodyBlends.includes(element.slotType)) {
                    formattedPlayer[element.slotType] = element.itemAssetName || "0";
                }
            });
        });


        // Check if body blends exist and assign their blends
        player.loadouts.forEach(loadout => {
            if (loadout.loadoutCategory === "Base") {
                loadout.loadoutElements.forEach(element => {
                    const slotType = element.slotType;

                    if (bodyBlends.includes(slotType)) {
                        // Extract blend values if available, otherwise don't add at all
                        const baseBlend = element.blends?.[0]?.baseBlend || "0";
                        const barycentricBlend = element.blends?.[0]?.barycentricBlend || "0";

                        // Only assign blend values if they exist (i.e., not null or undefined)
                        if (baseBlend !== null && barycentricBlend !== null) {
                            formattedPlayer[`${slotType}BaseBlend`] = baseBlend.toString();
                            formattedPlayer[`${slotType}BarycentricBlend`] = barycentricBlend.toString();
                        }
                    }
                });
            }
        });

        // Step 6: Add the formatted player to the reformatted data using assetName as the key
        reformattedData[assetName] = formattedPlayer;
    }

    // Step 7 (Optional): Write the reformatted data to a new file
    fs.writeFileSync('./reformatted_coachvisuals.json', JSON.stringify(reformattedData, null, 2));

    console.log('Reformatted data saved to reformatted_coachvisuals.json');
} catch (err) {
    console.error('Error:', err);
}
