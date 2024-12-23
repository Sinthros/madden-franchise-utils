// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const prompt = require('prompt-sync')();

// Print tool header message
console.log("This program will calculate the strength of victory for a selected team in a franchise file. Only Madden 25 franchise files are supported.\n");

// Set up franchise file
const validGames = [
    FranchiseUtils.YEARS.M25
];
const franchise = FranchiseUtils.init(validGames, {promptForBackup: false});
const tables = FranchiseUtils.getTablesObject(franchise);

function enumerateGames(teamRow, seasonGameTable, includeUnplayed = false)
{
    let games = [];

    for(let i = 0; i < seasonGameTable.header.recordCapacity; i++)
    {
        if(seasonGameTable.records[i].isEmpty 
            || seasonGameTable.records[i].IsPractice 
            || seasonGameTable.records[i]['SeasonWeekType'] !== 'RegularSeason' 
            || (seasonGameTable.records[i]['GameStatus'] === 'Unplayed' && !includeUnplayed)
            || (seasonGameTable.records[i]['AwayPlayerStatCache'] !== FranchiseUtils.ZERO_REF && !includeUnplayed)
        )
        {
            continue;
        }

        let homeTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['HomeTeam'].slice(15));
        let awayTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['AwayTeam'].slice(15));

        if(homeTeamRow === teamRow || awayTeamRow === teamRow)
        {
            games.push(seasonGameTable.records[i]);
        }
    }

    return games;
}

function enumerateWins(games, teamRow)
{
    let sovGames = [];

    for(let i = 0; i < games.length; i++)
    {
        let game = games[i];
        let homeTeamRow = FranchiseUtils.bin2Dec(game['HomeTeam'].slice(15));
        let awayTeamRow = FranchiseUtils.bin2Dec(game['AwayTeam'].slice(15));

        let opponentRow = homeTeamRow === teamRow ? awayTeamRow : homeTeamRow;

        if(game['HomeScore'] === game['AwayScore'])
        {
            let sovEntry = {
                opponent: opponentRow,
                sovFactor: 0.5
            }

            sovGames.push(sovEntry);

            continue;
        }

        if(opponentRow === homeTeamRow)
        {
            if(game['HomeScore'] < game['AwayScore'])
            {
                let sovEntry = {
                    opponent: opponentRow,
                    sovFactor: 1
                }

                sovGames.push(sovEntry);
            }
        }
        else
        {
            if(game['AwayScore'] < game['HomeScore'])
            {
                let sovEntry = {
                    opponent: opponentRow,
                    sovFactor: 1
                }

                sovGames.push(sovEntry);
            }
        }
    }

    return sovGames;
}

function calculateSov(sovGames, teamTable)
{
    let sovSum = 0;

    for(let i = 0; i < sovGames.length; i++)
    {
        let sovEntry = sovGames[i];
        let opponentRow = sovEntry.opponent;
        let sovFactor = sovEntry.sovFactor;

        let opponentPercentage = teamTable.records[opponentRow]['SeasonWinPct'] / 1000.0;

        sovSum += sovFactor * opponentPercentage;
    }

    let teamSov = sovSum / sovGames.length;

    return teamSov;
}

function calculateSos(games, teamRow, teamTable)
{
    let sosSum = 0;

    for(let i = 0; i < games.length; i++)
    {
        let game = games[i];
        let homeTeamRow = FranchiseUtils.bin2Dec(game['HomeTeam'].slice(15));
        let awayTeamRow = FranchiseUtils.bin2Dec(game['AwayTeam'].slice(15));

        let opponentRow = homeTeamRow === teamRow ? awayTeamRow : homeTeamRow;

        let opponentPercentage = teamTable.records[opponentRow]['SeasonWinPct'] / 1000.0;

        sosSum += opponentPercentage;
    }

    let teamSos = sosSum / games.length;

    return teamSos;
}

function getCommonOpponents(teamRow, secondTeamRow, games, secondGames)
{
    let commonOpponents = [];

    for(let i = 0; i < games.length; i++)
    {
        let game = games[i];
        let homeTeamRow = FranchiseUtils.bin2Dec(game['HomeTeam'].slice(15));
        let awayTeamRow = FranchiseUtils.bin2Dec(game['AwayTeam'].slice(15));

        let opponentRow = homeTeamRow === teamRow ? awayTeamRow : homeTeamRow;

        if(secondGames.some(g => FranchiseUtils.bin2Dec(g['HomeTeam'].slice(15)) === opponentRow || FranchiseUtils.bin2Dec(g['AwayTeam'].slice(15)) === opponentRow))
        {
            if(!commonOpponents.includes(opponentRow) && opponentRow !== teamRow && opponentRow !== secondTeamRow)
            {
                commonOpponents.push(opponentRow);
            }
        }
    }

    return commonOpponents;
}

function getCommonWinPercentage(teamRow, games, commonOpponents)
{
    let commonWins = 0;
    let commonLosses = 0;

    for(let i = 0; i < games.length; i++)
    {
        let game = games[i];
        let homeTeamRow = FranchiseUtils.bin2Dec(game['HomeTeam'].slice(15));
        let awayTeamRow = FranchiseUtils.bin2Dec(game['AwayTeam'].slice(15));

        let opponentRow = homeTeamRow === teamRow ? awayTeamRow : homeTeamRow;

        if(!commonOpponents.includes(opponentRow))
        {
            continue;
        }

        if(opponentRow === homeTeamRow)
        {
            if(game['HomeScore'] > game['AwayScore'])
            {
                commonLosses++;
            }
            else if(game['HomeScore'] < game['AwayScore'])
            {
                commonWins++;
            }
            else
            {
                commonWins += 0.5;
                commonLosses += 0.5;
            }
        }
        else
        {
            if(game['AwayScore'] > game['HomeScore'])
            {
                commonLosses++;
            }
            else if(game['AwayScore'] < game['HomeScore'])
            {
                commonWins++;
            }
            else
            {
                commonWins += 0.5;
                commonLosses += 0.5;
            }
        }
    }

    let commonWinPercentage = commonWins / (commonWins + commonLosses);

    return commonWinPercentage;
}

function getCommonGameCount(teamRow, games, commonOpponents)
{
    let commonWins = 0;
    let commonLosses = 0;

    for(let i = 0; i < games.length; i++)
    {
        let game = games[i];
        let homeTeamRow = FranchiseUtils.bin2Dec(game['HomeTeam'].slice(15));
        let awayTeamRow = FranchiseUtils.bin2Dec(game['AwayTeam'].slice(15));

        let opponentRow = homeTeamRow === teamRow ? awayTeamRow : homeTeamRow;

        if(!commonOpponents.includes(opponentRow))
        {
            continue;
        }

        if(opponentRow === homeTeamRow)
        {
            if(game['HomeScore'] > game['AwayScore'])
            {
                commonLosses++;
            }
            else if(game['HomeScore'] < game['AwayScore'])
            {
                commonWins++;
            }
            else
            {
                commonWins += 0.5;
                commonLosses += 0.5;
            }
        }
        else
        {
            if(game['AwayScore'] > game['HomeScore'])
            {
                commonLosses++;
            }
            else if(game['AwayScore'] < game['HomeScore'])
            {
                commonWins++;
            }
            else
            {
                commonWins += 0.5;
                commonLosses += 0.5;
            }
        }
    }

    return commonWins + commonLosses;
}

franchise.on('ready', async function () {
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
    await FranchiseUtils.readTableRecords([teamTable, seasonGameTable]);

    console.log("\nAvailable calculations: ");
    console.log("1 - Calculate the strength of victory for a team");
    console.log("2 - Calculate the strength of schedule for a team");
    console.log("3 - Calculate the common game record for two teams");

    let userSelection;

    do
    {
        console.log("\nPlease enter the number of the calculation you want to perform:");
        userSelection = parseInt(prompt());

        if (isNaN(userSelection) || userSelection < 1 || userSelection > 3)
        {
            console.log("Invalid selection. Please try again.");
        }
    }
    while(isNaN(userSelection) || userSelection < 1 || userSelection > 3);

    const teamCount = teamTable.header.recordCapacity;

    let teamList = [];

    for(let i = 0; i < teamCount; i++)
    {
        const teamRecord = teamTable.records[i];

        if (teamRecord.isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(teamRecord.DisplayName) || !teamRecord.TEAM_VISIBLE)
        {
            continue;
        }

        let teamEntry = {
            rowNum: i,
            teamRecord: teamRecord
        };

        teamList.push(teamEntry);
    }

    let userTeamSelection;
    let userSecondTeamSelection;
    let divisionTeams = false;

    console.log("\nAvailable teams:")

    for(let i = 0; i < teamList.length; i++)
    {
        const teamEntry = teamList[i];
        const teamRecord = teamEntry.teamRecord;

        console.log(`${i} - ${teamRecord.DisplayName}`);
    }

    if(userSelection === 1)
    {
        do
        {
            console.log("\nPlease enter the number of the team you want to calculate the strength of victory for:");
            userTeamSelection = parseInt(prompt());

            if (isNaN(userTeamSelection) || userTeamSelection < 0 || userTeamSelection >= teamList.length)
            {
                console.log("Invalid selection. Please try again.");
            }
        }
        while(isNaN(userTeamSelection) || userTeamSelection < 0 || userTeamSelection >= teamList.length);
    }
    else if(userSelection === 2)
    {
        do
        {
            console.log("\nPlease enter the number of the team you want to calculate the strength of schedule for:");
            userTeamSelection = parseInt(prompt());

            if (isNaN(userTeamSelection) || userTeamSelection < 0 || userTeamSelection >= teamList.length)
            {
                console.log("Invalid selection. Please try again.");
            }
        }
        while(isNaN(userTeamSelection) || userTeamSelection < 0 || userTeamSelection >= teamList.length);
    }
    else if(userSelection === 3)
    {
        do
        {
            console.log("\nPlease enter the number of the first team:");
            userTeamSelection = parseInt(prompt());

            if (isNaN(userTeamSelection) || userTeamSelection < 0 || userTeamSelection >= teamList.length)
            {
                console.log("Invalid selection. Please try again.");
            }
        }
        while(isNaN(userTeamSelection) || userTeamSelection < 0 || userTeamSelection >= teamList.length);

        do
        {
            console.log("\nPlease enter the number of the second team:");
            userSecondTeamSelection = parseInt(prompt());

            if (isNaN(userSecondTeamSelection) || userSecondTeamSelection < 0 || userSecondTeamSelection >= teamList.length)
            {
                console.log("Invalid selection. Please try again.");
            }
        }
        while(isNaN(userSecondTeamSelection) || userSecondTeamSelection < 0 || userSecondTeamSelection >= teamList.length);

        divisionTeams = FranchiseUtils.getYesOrNo("\nAre these teams in the same division? (yes/no):");
    }

    const selectedTeamRow = teamList[userTeamSelection].rowNum;
    const selectedTeamRecord = teamList[userTeamSelection].teamRecord;

    const selectedSecondTeamRow = userSelection === 3 ? teamList[userSecondTeamSelection].rowNum : null;
    const selectedSecondTeamRecord = userSelection === 3 ? teamList[userSecondTeamSelection].teamRecord : null;

    let games = userSelection === 2 ? enumerateGames(selectedTeamRow, seasonGameTable, true) : enumerateGames(selectedTeamRow, seasonGameTable);
    let secondGames = userSelection === 3 ? enumerateGames(selectedSecondTeamRow, seasonGameTable) : null;

    let sovGames = userSelection === 1 ? enumerateWins(games, selectedTeamRow) : [];

    let teamSov = sovGames.length === 0 ? 0 : calculateSov(sovGames, teamTable);

    let teamSos = calculateSos(games, selectedTeamRow, teamTable);

    if(userSelection === 1)
    {
        // Print the strength of victory for the selected team to 3 decimal places
        console.log(`\nThe strength of victory for the ${selectedTeamRecord.DisplayName} is: ${teamSov.toFixed(3)}`);
    }
    else if(userSelection === 2)
    {
        // Print the strength of schedule for the selected team to 3 decimal places
        console.log(`\nThe strength of schedule for the ${selectedTeamRecord.DisplayName} is: ${teamSos.toFixed(3)}`);
    }
    else if(userSelection === 3)
    {
        let commonOpps = getCommonOpponents(selectedTeamRow, selectedSecondTeamRow, games, secondGames);
        let commonOppNames = [];

        for(let i = 0; i < commonOpps.length; i++)
        {
            commonOppNames.push(teamTable.records[commonOpps[i]].DisplayName);
        }
        

        let team1CommonWinPercentage = getCommonWinPercentage(selectedTeamRow, games, commonOpps);
        let team2CommonWinPercentage = getCommonWinPercentage(selectedSecondTeamRow, secondGames, commonOpps);

        let team1CommonGameCount = getCommonGameCount(selectedTeamRow, games, commonOpps);
        let team2CommonGameCount = getCommonGameCount(selectedSecondTeamRow, secondGames, commonOpps);

        if(!divisionTeams && (team1CommonGameCount < 4 || team2CommonGameCount < 4))
        {
            console.log("\nThese teams do not have enough common games to calculate a common game record. Non-divisional teams must have at least 4 common games each.");
        }
        else
        {
            console.log(`\nCommon opponents: ${commonOppNames.join(", ")}`);
            console.log(`\n${selectedTeamRecord.DisplayName} common game win percentage: ${team1CommonWinPercentage.toFixed(3)}`);
            console.log(`${selectedSecondTeamRecord.DisplayName} common game win percentage: ${team2CommonWinPercentage.toFixed(3)}\n`);
        }
    }

    FranchiseUtils.EXIT_PROGRAM();

});