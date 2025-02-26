const FranchiseUtils = require('../Utils/FranchiseUtils');

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

function getTeamSov(teamRow, seasonGameTable, teamTable)
{
    let games = enumerateGames(teamRow, seasonGameTable);
    let sovGames = enumerateWins(games, teamRow);

    let teamSov = sovGames.length === 0 ? 0 : calculateSov(sovGames, teamTable);

    // Round to 3 decimal places
    teamSov = Math.round(teamSov * 1000) / 1000;

    return teamSov;
}

function getTeamSos(teamRow, seasonGameTable, teamTable)
{
    let games = enumerateGames(teamRow, seasonGameTable, true);
    let teamSos = calculateSos(games, teamRow, teamTable);

    // Round to 3 decimal places
    teamSos = Math.round(teamSos * 1000) / 1000;

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

module.exports = {
    getTeamSov,
    getTeamSos,
    getCommonOpponents,
    getCommonWinPercentage,
    getCommonGameCount,
    enumerateGames
}