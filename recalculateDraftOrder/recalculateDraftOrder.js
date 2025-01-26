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

// Function to get the playoff draft order
function getPlayoffDraftOrder(teamTable, seasonGameTable)
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

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    divisionalLosers.sort((a, b) => {
        if(teamTable.records[a]['SeasonWinPct'] === teamTable.records[b]['SeasonWinPct'])
        {
            const firstSos = TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable);
            const secondSos = TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    conferenceLosers.sort((a, b) => {
        if(teamTable.records[a]['SeasonWinPct'] === teamTable.records[b]['SeasonWinPct'])
        {
            const firstSos = TiebreakerCalc.getTeamSos(a, seasonGameTable, teamTable);
            const secondSos = TiebreakerCalc.getTeamSos(b, seasonGameTable, teamTable);

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
    await FranchiseUtils.readTableRecords([teamTable, seasonGameTable]);

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

            return firstSos - secondSos;
        }
        
        return teamTable.records[a]['SeasonWinPct'] - teamTable.records[b]['SeasonWinPct']
    });

    // Concatenat the playoff team order
    const playoffTeams = getPlayoffDraftOrder(teamTable, seasonGameTable);
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

  