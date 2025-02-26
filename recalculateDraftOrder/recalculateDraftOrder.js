// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const { getBinaryReferenceData } = require('madden-franchise/services/utilService');
const TiebreakerCalc = require('../teamTiebreakerCalculator/tiebreakerFunctions');
const validGameYears = [
    FranchiseUtils.YEARS.M24,
    FranchiseUtils.YEARS.M25
];

console.log("This program will recalculate the draft order, fixing issues related to duplicate picks.");

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

// Function to check if two teams are division rivals
function checkDivisionRivals(a, b, seasonGameTable)
{
    const numGameRows = seasonGameTable.header.recordCapacity;

    const aVsBGames = [];

    for(let i = 0; i < numGameRows; i++)
    {
        if(seasonGameTable.records[i].isEmpty || seasonGameTable.records[i]['IsPractice'] || seasonGameTable.records[i]['SeasonWeekType'] !== 'RegularSeason')
        {
            continue;
        }

        const awayTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['AwayTeam'].slice(15));
        const homeTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['HomeTeam'].slice(15));

        if((awayTeamRow === a && homeTeamRow === b) || (awayTeamRow === b && homeTeamRow === a))
        {
            aVsBGames.push(i);
        }
    }

    if(aVsBGames.length >= 2)
    {
        return true;
    }

    return false;
}

function checkSameConference(a, b, divisionTeamTable)
{
    const arraySizes = divisionTeamTable.arraySizes;
    const arraySize = divisionTeamTable.header.recordCapacity;

    let aConf;
    let bConf;

    for(let i = 0; i < arraySize; i++)
    {
        if(divisionTeamTable.records[i].isEmpty)
        {
            continue;
        }
        for(let j = 0; j < arraySizes[i]; j++)
        {
            const teamRow = FranchiseUtils.bin2Dec(divisionTeamTable.records[i][`Team${j}`].slice(15));
            if(teamRow === a)
            {
                if(i < 4)
                {
                    aConf = 0;
                }
                else
                {
                    aConf = 1;
                }
            }
            else if(teamRow === b)
            {
                if(i < 4)
                {
                    bConf = 0;
                }
                else
                {
                    bConf = 1;
                }
            }
        }
    }

    return aConf === bConf;
}

function checkHeadToHead(a, b, seasonGameTable)
{
    const numGameRows = seasonGameTable.header.recordCapacity;

    let aWins = 0;
    let bWins = 0;

    for(let i = 0; i < numGameRows; i++)
    {
        if(seasonGameTable.records[i].isEmpty || seasonGameTable.records[i]['IsPractice'] || seasonGameTable.records[i]['SeasonWeekType'] !== 'RegularSeason')
        {
            continue;
        }

        const awayTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['AwayTeam'].slice(15));
        const homeTeamRow = FranchiseUtils.bin2Dec(seasonGameTable.records[i]['HomeTeam'].slice(15));

        if((awayTeamRow === a && homeTeamRow === b))
        {
            if(seasonGameTable.records[i]['AwayScore'] > seasonGameTable.records[i]['HomeScore'])
            {
                aWins++;
            }
            else if(seasonGameTable.records[i]['AwayScore'] < seasonGameTable.records[i]['HomeScore'])
            {
                bWins++;
            }
            else
            {
                aWins += 0.5;
                bWins += 0.5;
            }
        }
        else if((awayTeamRow === b && homeTeamRow === a))
        {
            if(seasonGameTable.records[i]['AwayScore'] > seasonGameTable.records[i]['HomeScore'])
            {
                bWins++;
            }
            else if(seasonGameTable.records[i]['AwayScore'] < seasonGameTable.records[i]['HomeScore'])
            {
                aWins++;
            }
            else
            {
                aWins += 0.5;
                bWins += 0.5;
            }
        }
    }

    const aHeadToHead = aWins / (aWins + bWins);
    const bHeadToHead = bWins / (aWins + bWins);

    return aHeadToHead - bHeadToHead;
}

function checkCommonGames(a, b, seasonGameTable, teamTable, divisionRivals = false)
{
    let games = TiebreakerCalc.enumerateGames(a, seasonGameTable);
    let secondGames = TiebreakerCalc.enumerateGames(b, seasonGameTable);
    
    let commonOpps = TiebreakerCalc.getCommonOpponents(a, b, games, secondGames);
    

    let team1CommonWinPercentage = TiebreakerCalc.getCommonWinPercentage(a, games, commonOpps);
    let team2CommonWinPercentage = TiebreakerCalc.getCommonWinPercentage(b, secondGames, commonOpps);

    let team1CommonGameCount = TiebreakerCalc.getCommonGameCount(a, games, commonOpps);
    let team2CommonGameCount = TiebreakerCalc.getCommonGameCount(b, secondGames, commonOpps);

    if(!divisionRivals && (team1CommonGameCount < 4 || team2CommonGameCount < 4))
    {
        return 0;
    }

    return team1CommonWinPercentage - team2CommonWinPercentage;
}

// Function to calculate tiebreakers after SOS
function getRemainingTiebreaker(a, b, seasonGameTable, teamTable, divisionTeamTable)
{
    const divisionRivals = checkDivisionRivals(a, b, seasonGameTable);
    const sameConference = checkSameConference(a, b, divisionTeamTable);

    if(divisionRivals)
    {
        return doDivisionTiebreaker(a, b, seasonGameTable, teamTable);
    }

    if(sameConference)
    {
        return doConferenceTiebreaker(a, b, seasonGameTable, teamTable);
    }

    const headToHead = checkHeadToHead(a, b, seasonGameTable);

    if(headToHead !== 0)
    {
        return headToHead;
    }

    const commonGames = checkCommonGames(a, b, seasonGameTable, teamTable);

    if(commonGames !== 0)
    {
        return commonGames;
    }

    return TiebreakerCalc.getTeamSov(a, seasonGameTable, teamTable) - TiebreakerCalc.getTeamSov(b, seasonGameTable, teamTable);
}

function doDivisionTiebreaker(a, b, seasonGameTable, teamTable)
{
    const headToHead = checkHeadToHead(a, b, seasonGameTable);

    if(headToHead !== 0)
    {
        return headToHead;
    }

    const commonGames = checkCommonGames(a, b, seasonGameTable, teamTable, true);

    if(commonGames !== 0)
    {
        return commonGames;
    }

    const confA = teamTable.records[a]['ConfWin'] + 0.5 * (teamTable.records[a]['ConfTie']) / (teamTable.records[a]['ConfLoss'] + teamTable.records[a]['ConfTie'] + teamTable.records[a]['ConfWin']);
    const confB = teamTable.records[b]['ConfWin'] + 0.5 * (teamTable.records[b]['ConfTie']) / (teamTable.records[b]['ConfLoss'] + teamTable.records[b]['ConfTie'] + teamTable.records[b]['ConfWin']);

    if(confA !== confB)
    {
        return confA - confB;
    }

    const sovDiff = TiebreakerCalc.getTeamSov(a, seasonGameTable, teamTable) - TiebreakerCalc.getTeamSov(b, seasonGameTable, teamTable);

    if(sovDiff !== 0)
    {
        return sovDiff;
    }

    return TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable) - TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);
}

function doConferenceTiebreaker(a, b, seasonGameTable, teamTable)
{
    const headToHead = checkHeadToHead(a, b, seasonGameTable);

    if(headToHead !== 0)
    {
        return headToHead;
    }

    const confA = teamTable.records[a]['ConfWin'] + 0.5 * (teamTable.records[a]['ConfTie']) / (teamTable.records[a]['ConfLoss'] + teamTable.records[a]['ConfTie'] + teamTable.records[a]['ConfWin']);
    const confB = teamTable.records[b]['ConfWin'] + 0.5 * (teamTable.records[b]['ConfTie']) / (teamTable.records[b]['ConfLoss'] + teamTable.records[b]['ConfTie'] + teamTable.records[b]['ConfWin']);

    if(confA !== confB)
    {
        return confA - confB;
    }

    const commonGames = checkCommonGames(a, b, seasonGameTable, teamTable);

    if(commonGames !== 0)
    {
        return commonGames;
    }

    const sovDiff = TiebreakerCalc.getTeamSov(a, seasonGameTable, teamTable) - TiebreakerCalc.getTeamSov(b, seasonGameTable, teamTable);

    if(sovDiff !== 0)
    {
        return sovDiff;
    }

    return TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable) - TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);
}

// Function to get the playoff draft order
function getPlayoffDraftOrder(teamTable, seasonGameTable, divisionTeamTable)
{
    let playoffTeams = [];
    let wildCardLosers = [];
    let divisionalLosers = [];
    let conferenceLosers = [];
    let superBowlLoser = -1;
    let superBowlWinner = -1;

    const numTeamRows = teamTable.header.recordCapacity;

    for (let i = 0; i < numTeamRows; i++)
    {
        if(teamTable.records[i].isEmpty || !teamTable.records[i]['TEAM_VISIBLE'] || teamTable.records[i]['PlayoffRoundReached'] === 'None')
        {
            continue;
        }

        if(teamTable.records[i]['PlayoffRoundReached'] === 'Wildcard')
        {
            wildCardLosers.push(i);
        }
        else if(teamTable.records[i]['PlayoffRoundReached'] === 'DivisionChampionship')
        {
            divisionalLosers.push(i);
        }
        else if(teamTable.records[i]['PlayoffRoundReached'] === 'ConferenceChampionship')
        {
            conferenceLosers.push(i);
        }
        else if(teamTable.records[i]['PlayoffRoundReached'] === 'LostSuperbowl')
        {
            superBowlLoser = i;
        }
        else if(teamTable.records[i]['PlayoffRoundReached'] === 'WonSuperbowl')
        {
            superBowlWinner = i;
        }
    }

    wildCardLosers.sort((a, b) => {
        if(teamTable.records[a]['SeasonWinPct'] === teamTable.records[b]['SeasonWinPct'])
        {
            const firstSos = TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable);
            const secondSos = TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);

            if(firstSos === secondSos)
            {                
                return getRemainingTiebreaker(a, b, seasonGameTable, teamTable, divisionTeamTable);
            }

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    divisionalLosers.sort((a, b) => {
        if(teamTable.records[a]['SeasonWinPct'] === teamTable.records[b]['SeasonWinPct'])
        {
            const firstSos = TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable);
            const secondSos = TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);

            if(firstSos === secondSos)
            {
                return getRemainingTiebreaker(a, b, seasonGameTable, teamTable, divisionTeamTable);
            }

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    conferenceLosers.sort((a, b) => {
        if(teamTable.records[a]['SeasonWinPct'] === teamTable.records[b]['SeasonWinPct'])
        {
            const firstSos = TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable);
            const secondSos = TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);

            if(firstSos === secondSos)
            {
                return getRemainingTiebreaker(a, b, seasonGameTable, teamTable, divisionTeamTable);
            }

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    playoffTeams = playoffTeams.concat(wildCardLosers, divisionalLosers, conferenceLosers, [superBowlLoser, superBowlWinner]);

    return playoffTeams;
}

// Function to calculate each team's draft position
async function calculateTeamDraftPositions(franchise, teamPositions)
{
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    const seasonGameTable = franchise.getTableByUniqueId(tables.seasonGameTable);
    const divisionTeamTable = franchise.getTableByUniqueId(tables.divisionTeamTable);
    await FranchiseUtils.readTableRecords([teamTable, seasonGameTable, divisionTeamTable]);

    const numTeamRows = teamTable.header.recordCapacity;

    let teams = [];

    for (let i = 0; i < numTeamRows; i++)
    {
        if(teamTable.records[i].isEmpty || FranchiseUtils.NFL_CONFERENCES.includes(teamTable.records[i]['DisplayName']) || !teamTable.records[i]['TEAM_VISIBLE'] || teamTable.records[i]['PlayoffRoundReached'] !== 'None')
        {
            continue;
        }

        teams.push(i);
    }

    // Sort the teams by win percentage, using SOS as a tiebreaker
    teams.sort((a, b) => {
        if(teamTable.records[a]['SeasonWinPct'] === teamTable.records[b]['SeasonWinPct'])
        {
            const firstSos = TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable);
            const secondSos = TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);

            if(firstSos === secondSos)
            {
                return getRemainingTiebreaker(a, b, seasonGameTable, teamTable, divisionTeamTable);
            }

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    // Concatenat the playoff team order
    const playoffTeams = getPlayoffDraftOrder(teamTable, seasonGameTable, divisionTeamTable);
    teams = teams.concat(playoffTeams);

    // Assign draft positions 0-31 to the teams
    for(let i = 0; i < 32; i++)
    {
        teamPositions[i] = teams[i];
    }

    return teamPositions;
}

// Function to set the draft pick order
function setDraftPickOrder(draftPickTable, draftPicks, teamPositions, teamTableId)
{    
    const tradedPicks = [];
    
    for(let i = 0; i < draftPicks.length; i++)
    {
        const newTeamBinary = getBinaryReferenceData(teamTableId, teamPositions[i % 32]);
        
        if(!(draftPickTable.records[draftPicks[i]]['CurrentTeam'] === draftPickTable.records[draftPicks[i]]['OriginalTeam']))
        {
            const tradedPick = {
                'OriginalTeam': draftPickTable.records[draftPicks[i]]['OriginalTeam'],
                'CurrentTeam': draftPickTable.records[draftPicks[i]]['CurrentTeam'],
                'Round': draftPickTable.records[draftPicks[i]]['Round']
            }

            tradedPicks.push(tradedPick);
        }
        
        draftPickTable.records[draftPicks[i]]['CurrentTeam'] = newTeamBinary;
        draftPickTable.records[draftPicks[i]]['OriginalTeam'] = newTeamBinary;
        draftPickTable.records[draftPicks[i]]['PickNumber'] = i;
    }

    for(let i = 0; i < tradedPicks.length; i++)
    {
        const searchRound = tradedPicks[i]['Round'];
        const searchOriginalTeam = tradedPicks[i]['OriginalTeam'];
        const newCurrentTeam = tradedPicks[i]['CurrentTeam'];

        for(let j = 0; j < draftPicks.length; j++)
        {
            if(draftPickTable.records[draftPicks[j]]['Round'] === searchRound && draftPickTable.records[draftPicks[j]]['OriginalTeam'] === searchOriginalTeam)
            {
                draftPickTable.records[draftPicks[j]]['CurrentTeam'] = newCurrentTeam;
            }
        }
    }
}

franchise.on('ready', async function () {

    if (franchise.schema.meta.gameYear >= 25) await FranchiseUtils.fixDraftPicks(franchise); 
    
    // Required tables 
    const draftPickTable = franchise.getTableByUniqueId(tables.draftPickTable);
    const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
    const teamTable = franchise.getTableByUniqueId(tables.teamTable);
    await FranchiseUtils.readTableRecords([draftPickTable, seasonInfoTable]);

    // Number of rows in the draft pick table
    const numRows = draftPickTable.header.recordCapacity;

    // Make sure the file is in staff week
    if(!(seasonInfoTable.records[0]['CurrentWeekType'] === 'OffSeason' && seasonInfoTable.records[0]['CurrentOffseasonStage'] === 1))
    {
        console.log("\nThis file is not in Staff Week. This tool can only be run during Staff Week.");
        FranchiseUtils.EXIT_PROGRAM();
    }

    // Array of all draft picks for this year
    let draftPicks = [];

    // Iterate through the draft pick table
    for (let i = 0; i < numRows; i++) 
    {
        // If not an empty row
        if (!draftPickTable.records[i].isEmpty && draftPickTable.records[i]['YearOffset'] === 0) 
        {
            draftPicks.push(i);
        }
    }

    // Sort the draft picks by pick number
    draftPicks.sort((a, b) => draftPickTable.records[a]['PickNumber'] - draftPickTable.records[b]['PickNumber']);

    // Calculate each team's draft position
    let teamPositions = {};

    await calculateTeamDraftPositions(franchise, teamPositions);

    setDraftPickOrder(draftPickTable, draftPicks, teamPositions, teamTable.header.tableId);

    // Program complete, so print success message, save the franchise file, and exit
    console.log("\nDraft order recalculated successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
});

  