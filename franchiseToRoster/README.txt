M25 Franchise to Roster Converter:
----------------------------------

HOW TO USE:

Phase 1 (Franchise Conversion):
- Run the franchiseToRoster exe
- Follow the included prompts
- Once the program is complete, you will see two new files created in the same folder: "convertedRoster_league.db" and "convertedRoster_visuals.json"

Phase 2 (Visuals Conversion):
- Run the h2Tools exe
- Choose option 3
- When prompted for a path to the visuals JSON file, enter "convertedRoster_visuals.json" (without quotes)
- When prompted for a filename to save the converted file, enter any filename of your choice
- Once the program is complete, you will see a new file created in the same folder, with the extension .H2 and the filename you specified

Phase 3 (Roster Modding):
- Open Frosty Editor
- Navigate to the Legacy Explorer
- Go to "common/database/gamemodes"
- Find the "league" DB file, right click it, select import, and import the "convertedRoster_league.db" over it
- Find the "leaguevisuals" H2 file (note, this is different from the leaguevisuals JSON file), right click it, select import, and import the H2 file that you created in the last phase

Phase 4 (Sideloading):
- In order for this to work, you must move all existing roster files out of your Madden saves folder (Documents/Madden NFL 25/saves)
- If your saves folder is in the default location (chances are it will be), you can run the "MoveSaves.bat" file in the tool folder, and it will do this for you
- Otherwise, just move all rosters out of your saves folder manually
- Once you have done that, launch the game through Frosty Editor

Phase 5 (Saving Roster):
- Once the game has loaded, go to edit rosters, and select the edit depth chart option
- You will need to use the auto-reorder depth chart button for each team to set the depth chart. So press the auto-reorder depth chart button, then go to the next team and do it again. Repeat until you've set depth charts for all 32 teams.
- After depth charts have been set, go to the manage players section of edit rosters, and you can now save the roster

Phase 6 (Restoring Saves):
- Once the roster is saved, you can close the game and restore all the rosters to your saves folder
- If you ran the "MoveSaves.bat" file earlier, you can just run it again to restore your rosters to the saves folder