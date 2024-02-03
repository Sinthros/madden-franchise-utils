
const fs = require('fs');
const prompt = require('prompt-sync')();
const path = require('path');
const os = require('os');
const Franchise = require('madden-franchise');


console.log("This program will update your Madden 24 franchise file to use the 6 team playoff format. This tool must be run during wildcard week.")
var gamePrompt = '24';

const documentsDir = path.join(os.homedir(), `Documents\\Madden NFL ${gamePrompt}\\saves\\`); //Two paths - One using default, one with OneDrive
const oneDriveDir = path.join(os.homedir(),`OneDrive\\Documents\\Madden NFL ${gamePrompt}\\saves\\`)
default_path = documentsDir // Set to default dir first

if (fs.existsSync(documentsDir)) { //First, check if our Madden saves are in the default location
  default_path = documentsDir
}
else if (fs.existsSync(oneDriveDir)) {
  default_path = oneDriveDir
}
else {
  console.log(`IMPORTANT! Couldn't find the path to your Madden ${gamePrompt} save files. When selecting your file, make sure to give the FULL PATH.`)
}

//Our franchise file
function selectFranchiseFile(franchise,default_path) {
  while (franchise == "") { //While we haven't selected a franchise file...
    try {
      console.log("Please enter the name of your franchise file. Either give the full path of the file OR just give the file name (ie CAREER-BEARS) if it's in your documents folder. ")
      var fileName = prompt()
      if (fileName.startsWith("CAREER-")) {
        let fullPath = default_path.concat(fileName);
        var franchise = new Franchise(fullPath);
        return franchise;

      }
      else {
        var search = '/'
        var replacer = new RegExp(search, 'g')
        var fileName = fileName.replace(replacer,'\\')
        var franchise = new Franchise(fileName);
        return franchise;
      }

    }
    catch (e) {
      console.log(e)
      console.log("Invalid franchise file name/path given. Please try again.")
      continue

    }

  }
}

async function bin2Dec(binary) {
  return parseInt(binary, 2);
};

var franchise = "";
franchise = selectFranchiseFile(franchise,default_path)

franchise.on('ready', async function () {
    const teamTable = franchise.getTableByUniqueId(502886486);
	const seasonInfoTable = franchise.getTableByUniqueId(3123991521);
	await seasonInfoTable.readRecords();
	const currentWeek = parseInt(seasonInfoTable.records[0]['CurrentWeek']);
	
	var twoSeedTeamRows = [];
	
	if (currentWeek !== 18) // Check if file is in wildcard round, exit if not
	{
		console.log("Selected file is not in the Wildcard Round. Only Franchise Files in the Wildcard Round are supported by this tool. Enter anything to exit.")
		prompt();
		process.exit(0);
	}

    await teamTable.readRecords();
    const numRowsTeam = teamTable.header.recordCapacity //Number of rows in the team table
    for (i=0; i < numRowsTeam; i++) { //Iterate through the team table
        if (teamTable.records[i].isEmpty == true) { // If an empty row, continue
          continue
        }

        var teamSeed = parseInt(teamTable.records[i]['CurSeasonConfStanding']);
		if(teamSeed === 1) // If this team is the 2 seed
		{
			twoSeedTeamRows.push(i);
		}
    }
	
	const seasonGameTable = franchise.getTableByUniqueId(1607878349);
	await seasonGameTable.readRecords();
	const numRowsSeasonGame = seasonGameTable.header.recordCapacity;
	for (j=0; j < numRowsSeasonGame; j++) { //Iterate through the schedule table
        if (seasonGameTable.records[j].isEmpty == true) { // If an empty row, continue
          continue
        }

        if(seasonGameTable.records[j]['SeasonWeekType'] === 'WildcardPlayoff')
		{
			let homeTeamBinVal = seasonGameTable.records[j]['HomeTeam'];
			var teamRowBinVal = homeTeamBinVal.slice(15);
			var homeTeamRowNum = await bin2Dec(teamRowBinVal);
			
			if(homeTeamRowNum === twoSeedTeamRows[0] || homeTeamRowNum === twoSeedTeamRows[1])
			{
				seasonGameTable.records[j]['SeasonWeekType'] = 'OffSeason';
			}
		}
    }
	
    await franchise.save();
    console.log("Playoff format updated successfully. Enter anything to exit the program.");
    prompt();
  
});
  