// Required modules
const fs = require('fs');
const path = require('path');
const { getBinaryReferenceData } = require("madden-franchise").utilService;
const FranchiseUtils = require('../Utils/FranchiseUtils');
const CharacterVisualFunctions = require("../Utils/characterVisualsLookups/characterVisualFunctions26");
const CoachTalentFunctions = require("../Utils/coachTalentUtils/coachTalentFunctions26");

// Required lookups
const seasonStatsLookup = require("./lookupFiles/seasonStatsLookup.json");
const offPlaybookLookup = require("../Utils/JsonLookups/26/coachLookups/offensivePlaybooks.json");
const defPlaybookLookup = require("../Utils/JsonLookups/26/coachLookups/defensivePlaybooks.json");
const philosophyLookup = require("./lookupFiles/philosophy_lookup.json");
const offSchemeLookup = require("../Utils/JsonLookups/26/coachLookups/offensiveSchemes.json");
const defSchemeLookup = require("../Utils/JsonLookups/26/coachLookups/defensiveSchemes.json");

// Valid years
const validGames = [
	FranchiseUtils.YEARS.M26
];

// Print tool header message
console.log(`This tool will select some retired players and turn them into coaches based on various criteria. Madden ${FranchiseUtils.formatListString(validGames)} franchise files are supported.\n`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGames, {isAutoUnemptyEnabled: true});
const tables = FranchiseUtils.getTablesObject(franchise);
const gameYear = parseInt(franchise.schema.meta.gameYear);

const offTeamSchemeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, `lookupFiles/offensiveSchemes${gameYear}.json`)));
const defTeamSchemeLookup = JSON.parse(fs.readFileSync(path.join(__dirname, `lookupFiles/defensiveSchemes${gameYear}.json`)));

async function getSeasonStatsRecord(player)
{
	const seasonStatsBinary = player.SeasonStats;

	if(seasonStatsBinary === FranchiseUtils.ZERO_REF || FranchiseUtils.isFtcReference(player, 'SeasonStats'))
	{
		return null; 
	}

	const seasonStatsRefInfo = await FranchiseUtils.getRowAndTableIdFromRef(seasonStatsBinary);

	const seasonStatsTable = franchise.getTableById(seasonStatsRefInfo.tableId);
	await seasonStatsTable.readRecords();

	const seasonStatsRecord = seasonStatsTable.records[seasonStatsRefInfo.row];

	return seasonStatsRecord;
}

async function isPlayerHofer(player)
{
	const seasonStatsRecord = await getSeasonStatsRecord(player);

	if(!seasonStatsRecord)
	{
		return false;
	}

	if(seasonStatsRecord.SeasonStats0 === FranchiseUtils.ZERO_REF)
	{
		return true;
	}

	return false;
}

async function getTeamsFromSeasonStats(seasonStatsRecord)
{
	const numSeasons = seasonStatsRecord.arraySize;

	let teams = [];

	for(let i = 0; i < numSeasons; i++)
	{
		const seasonStatsRef = seasonStatsRecord[`SeasonStats${i}`];

		let seasonStats = null;

		// If the ref begins with 1, it's a FTC reference
		if(seasonStatsRef.startsWith('1'))
		{
			seasonStats = seasonStatsLookup[seasonStatsRef];
		}
		else
		{
			const seasonStatsRefInfo = await FranchiseUtils.getRowAndTableIdFromRef(seasonStatsRef);

			const seasonStatsTable = franchise.getTableById(seasonStatsRefInfo.tableId);
			await seasonStatsTable.readRecords();

			seasonStats = seasonStatsTable.records[seasonStatsRefInfo.row];
		}

		const teamIndex = seasonStats.YEARBYYEARTEAMINDEX;

		if(!teams.includes(teamIndex))
		{
			teams.push(teamIndex);
		}
	}

	return teams;
}

async function getLongestTeamFromSeasonStats(seasonStatsRecord)
{
	const numSeasons = seasonStatsRecord.arraySize;

	let teamMap = {};

	for(let i = 0; i < numSeasons; i++)
	{
		const seasonStatsRef = seasonStatsRecord[`SeasonStats${i}`];

		let seasonStats = null;

		// If the ref begins with 1, it's a FTC reference
		if(seasonStatsRef.startsWith('1'))
		{
			seasonStats = seasonStatsLookup[seasonStatsRef];
		}
		else
		{
			const seasonStatsRefInfo = await FranchiseUtils.getRowAndTableIdFromRef(seasonStatsRef);

			const seasonStatsTable = franchise.getTableById(seasonStatsRefInfo.tableId);
			await seasonStatsTable.readRecords();

			seasonStats = seasonStatsTable.records[seasonStatsRefInfo.row];
		}

		const teamIndex = seasonStats.YEARBYYEARTEAMINDEX;

		if(!teamMap.hasOwnProperty(teamIndex))
		{
			teamMap[teamIndex] = 1;
		}
		else
		{
			teamMap[teamIndex]++;
		}
	}

	const teamsListSorted = Object.keys(teamMap).sort((teamIndexA, teamIndexB) => {
		return teamMap[teamIndexA] - teamMap[teamIndexB];
	});

	const longestTeamIndex = parseInt(teamsListSorted[0]);

	const teamTable = franchise.getTableByUniqueId(tables.teamTable);
	await teamTable.readRecords();

	for(let i = 0; i < teamTable.header.recordCapacity; i++)
	{
		const team = teamTable.records[i];

		if(team.TeamIndex === longestTeamIndex)
		{
			return team;
		}
	}

	return null;
}


async function isPlayerJourneyman(player)
{
	const seasonStatsRecord = await getSeasonStatsRecord(player);

	if(!seasonStatsRecord)
	{
		return false;
	}

	const numTeamsPlayedFor = (await getTeamsFromSeasonStats(seasonStatsRecord)).length;

	if(numTeamsPlayedFor > 2)
	{
		return true;
	}

	return false;
}

function adjustPresentationId(coachRecord, presentationTable) 
{
	const record = presentationTable.records[0];
	const presentationId = record.PresentationId;
	record.PresentationId++;
	record.IdsRemaining--;
	coachRecord.PresentationId = presentationId;
}

function setDefaultCoachValues(coachRecord) 
{
	try 
	{
		// Self explanatory - These are the default values for the coach table
		coachRecord.SeasonsWithTeam = 0;
		coachRecord.IsCreated = false;
		coachRecord.IsLegend = false;
		coachRecord.CoachBackstory = "TeamBuilder";
		coachRecord.ContractStatus = "FreeAgent";
		coachRecord.ContractLength = 0;
		coachRecord.ContractYearsRemaining = 0;
		coachRecord.TeamIndex = 32;
		coachRecord.PrevTeamIndex = 0;
		coachRecord.Age = 35;
		coachRecord.COACH_RESIGNREPORTED = true;
		coachRecord.COACH_FIREREPORTED = true;
		coachRecord.COACH_LASTTEAMFIRED = 1023;
		coachRecord.COACH_LASTTEAMRESIGNED = 1023;
		coachRecord.COACH_WASPLAYER = false;
		coachRecord.COACH_DL = 50;
		coachRecord.COACH_LB = 50;
		coachRecord.COACH_WR = 50;
		coachRecord.COACH_K = 50;
		coachRecord.COACH_OFFENSE = 50;
		coachRecord.COACH_DEFENSE = 50;
		coachRecord.COACH_DEFENSETYPE = 50;
		coachRecord.COACH_DEFTENDENCYRUNPASS = 50;
		coachRecord.COACH_DEFTENDENCYAGGRESSCONSERV = 50;
		coachRecord.COACH_OFFTENDENCYAGGRESSCONSERV = 50;
		coachRecord.COACH_OFFTENDENCYRUNPASS = 50;
		coachRecord.COACH_S = 50;
		coachRecord.COACH_DB = 50;
		coachRecord.COACH_QB = 50;
		coachRecord.COACH_RB = 50;
		coachRecord.COACH_RBTENDENCY = 50;
		coachRecord.COACH_P = 50;
		coachRecord.COACH_OL = 50;
		coachRecord.CareerPlayoffsMade = 0;
		coachRecord.CareerPlayoffWins = 0;
		coachRecord.CareerPlayoffLosses = 0;
		coachRecord.CareerSuperbowlWins = 0;
		coachRecord.CareerSuperbowlLosses = 0;
		coachRecord.CareerWins = 0;
		coachRecord.CareerLosses = 0;
		coachRecord.CareerTies = 0;
		coachRecord.CareerProBowlPlayers = 0;
		coachRecord.CareerWinSeasons = 0;
		coachRecord.WCPlayoffWinStreak = 0;
		coachRecord.ConfPlayoffWinStreak = 0;
		coachRecord.WinSeasStreak = 0;
		coachRecord.DivPlayoffWinStreak = 0;
		coachRecord.SeasWinStreak = 0;
		coachRecord.SuperbowlWinStreak = 0;
		coachRecord.SeasLosses = 0;
		coachRecord.SeasTies = 0;
		coachRecord.SeasWins = 0;
		coachRecord.RegularWinStreak = 0;
		coachRecord.YearsCoaching = 0;
		coachRecord.Level = 0;
		coachRecord.TeamBuilding = "Balanced";
		coachRecord.LegacyScore = 0;
		coachRecord.Face = 0;
		coachRecord.HairResid = 0;
		coachRecord.Geometry = 0;
		coachRecord.Personality = "Unpredictable";
		coachRecord.MultipartBody = false;
		coachRecord.HasCustomBody = false;
		coachRecord.YearlyAwardCount = 0;
		coachRecord.SpeechId = 31;
		coachRecord.AssetName = FranchiseUtils.EMPTY_STRING;
		coachRecord.Height = 70;
		coachRecord.Weight = 10;
		coachRecord.Portrait_Force_Silhouette = false;
		coachRecord.COACH_PERFORMANCELEVEL = 0;
		coachRecord.Probation = false;
		coachRecord.TraitExpertScout = false;
		coachRecord.TradingTendency = "DoesNotTrade";
		coachRecord.COACH_SPECIALTY = "Quarterbacks";

		coachRecord.Portrait = 7999;

		// New M26 fields
		coachRecord.CurrentPurchasedTalentCosts = 0;
		coachRecord.IndexInUnlockList = 0;
		coachRecord.COACH_ADAPTIVE_AI = "Aggressive";
		coachRecord.COACH_DEMEANOR = "Classic";
		coachRecord.Archetype = "DevelopmentWizard";
		coachRecord.COACH_RATING = 50;
		coachRecord.COACH_STANCE = "Classic";
		coachRecord.IsMaxLevel = false;
		coachRecord.ContractSalary = 0;
		coachRecord.COACH_LASTCONTRACTTEAM = 0;
		coachRecord.AwardPoints = 0;
		coachRecord.IndexInUnlockList = 0;
	} 
	catch (e) 
	{
		console.warn("ERROR! Exiting program due to; ", e);
		FranchiseUtils.EXIT_PROGRAM();
	}
}

function setCoachPosition(coachRecord, playerRecord) 
{
	let position = "OffensiveCoordinator";

	if(FranchiseUtils.ALL_OFFENSIVE_POSITIONS.includes(playerRecord.Position))
	{
		position = "OffensiveCoordinator";
	}
	else if(FranchiseUtils.ALL_DEFENSIVE_POSITIONS.includes(playerRecord.Position))
	{
		position = "DefensiveCoordinator";
	}
	else if(FranchiseUtils.SPECIAL_TEAM_POSITIONS.includes(playerRecord.Position))
	{
		position = "OffensiveCoordinator";
	}

	coachRecord.Position = position;
	coachRecord.OriginalPosition = position;
	
}

async function setSchemes(coachRecord)
{
	const offScheme = offSchemeLookup[FranchiseUtils.getRandomNumber(0, offSchemeLookup.length - 1)];
	const defScheme = defSchemeLookup[FranchiseUtils.getRandomNumber(0, defSchemeLookup.length - 1)];

	const offSchemeBinary = await FranchiseUtils.dec2bin(offScheme.AssetId);
	const defSchemeBinary = await FranchiseUtils.dec2bin(defScheme.AssetId);

	coachRecord.OffensiveScheme = offSchemeBinary;
	coachRecord.DefensiveScheme = defSchemeBinary;
}

async function setPlaybooks(coachRecord, teamRecord)
{	
	//const team = FranchiseUtils.getUserSelection(`Enter a team for playbooks for ${coachRecord.FirstName} ${coachRecord.LastName}:`, Object.keys(philosophyLookup));
	const team = teamRecord == null ? offPlaybookLookup[FranchiseUtils.getRandomNumber(0, offPlaybookLookup.length - 1)].ShortName : teamRecord.DisplayName;
	//const offPlaybook = offPlaybookLookup[FranchiseUtils.getRandomNumber(0, offPlaybookLookup.length - 1)];
	//const defPlaybook = defPlaybookLookup.find(pb => pb.ShortName === offPlaybook.ShortName) || defPlaybookLookup[FranchiseUtils.getRandomNumber(0, defPlaybookLookup.length - 1)];

	const offPlaybook = offPlaybookLookup.find(playbook => playbook.ShortName === team) ?? offPlaybookLookup[0];
	const defPlaybook = defPlaybookLookup.find(playbook => playbook.ShortName === team) ?? defPlaybookLookup[0];

	const offPlaybookBinary = await FranchiseUtils.dec2bin(offPlaybook.AssetId);
	const defPlaybookBinary = await FranchiseUtils.dec2bin(defPlaybook.AssetId);

	coachRecord.OffensivePlaybook = offPlaybookBinary;
	coachRecord.DefensivePlaybook = defPlaybookBinary;

	const philosophyBinary = philosophyLookup[team] ?? philosophyLookup['49ers'];

	coachRecord.TeamPhilosophy = philosophyBinary;
	coachRecord.DefaultTeamPhilosophy = philosophyBinary;

	const offScheme = offSchemeLookup.find(scheme => scheme.ShortName === offTeamSchemeLookup[team]) ?? offSchemeLookup[0];

	//console.log(`Offensive scheme for team ${team} found: ${offScheme.ShortName}`);

	const defScheme = defSchemeLookup.find(scheme => scheme.ShortName === defTeamSchemeLookup[team]) ?? defSchemeLookup[0];

	const offSchemeBinary = await FranchiseUtils.dec2bin(offScheme.AssetId);
	const defSchemeBinary = await FranchiseUtils.dec2bin(defScheme.AssetId);

	coachRecord.OffensiveScheme = offSchemeBinary;
	coachRecord.DefensiveScheme = defSchemeBinary;
}

function getArchetype(coachRecord) 
{
	coachRecord.Archetype = coachRecord.Position === "OffensiveCoordinator" ? "OffensiveGuru" : "DefensiveGenius";
}

async function setCoachAppearance(coachRecord, playerRecord) 
{
	coachRecord.AssetName = playerRecord.PLYR_ASSETNAME;
	coachRecord.GenericHeadAssetName = playerRecord.GenericHeadAssetName;
	coachRecord.Type = "Existing";
}

async function updateCoachVisual(coachRecord) 
{
	const visualsRecord = await CharacterVisualFunctions.generateCoachVisuals(franchise, tables, coachRecord);

	const visuals = JSON.parse(visualsRecord.RawData);

	CharacterVisualFunctions.updateVisualsSlot(visuals, "HeadWear", "Hat_None");

	CharacterVisualFunctions.updateVisualsSlot(visuals, "EarWear", "UC_Headset_None");

	// Serialize back to string
	visualsRecord.RawData = JSON.stringify(visuals);
}

async function addCoachToFATable(freeAgentCoachTable, currentCoachBinary) {
  try {
	let i = 0;
	coachArrayNotFull = true;
	while (coachArrayNotFull) {
	  // Find first zeroed out coach value in array table and insert our new coach there
	  if (i > 63) {
		/// This means the coach array table is full; We can't add a new coach!
		coachArrayNotFull = false;
		break;
	  }
	  if (freeAgentCoachTable.records[0][`Coach${i}`] == FranchiseUtils.ZERO_REF) {
		if (i > 58) {
		  console.log(
			`Warning: There are 64 total slots for free agent coaches and you've now taken up ${
			  i + 1
			} slots out of 64. It's not advisable to completely fill up the Coach FA pool.`,
		  );
		}
		freeAgentCoachTable.records[0][`Coach${i}`] = currentCoachBinary;
		break;
	  }
	  i++;
	}
  } catch (e) {
	console.warn("ERROR! Exiting program due to; ", e);
	FranchiseUtils.EXIT_PROGRAM();
  }
  if (!coachArrayNotFull) {
	console.log("ERROR! Cannot add new coach. You've reached the limit of 64 free agent coaches. Exiting program.");
	FranchiseUtils.EXIT_PROGRAM();
  }
}

async function getUpdatedAge(player)
{
	const getDraftYear = (baseYear, draftYear) => {
		return draftYear < 0 ? baseYear + 1 + draftYear : baseYear + draftYear;
	};

	const seasonInfoTable = franchise.getTableByUniqueId(tables.seasonInfoTable);
	await seasonInfoTable.readRecords();
	const seasonInfo = seasonInfoTable.records[0];

	if (typeof player.YearsPro === "number" && typeof player.YearDrafted === "number") 
	{
		const rookieYear = getDraftYear(
			seasonInfo.BaseCalendarYear,
			player.YearDrafted
		);
		const retireYear = rookieYear + player.YearsPro - 1;

		const updatedAge = player.Age + (seasonInfo.CurrentSeasonYear - retireYear);

		//console.log(`Player ${player.FirstName} ${player.LastName} retired in year ${retireYear} at age ${player.Age}. Current season year is ${seasonInfo.CurrentSeasonYear}, so updated coach age is ${updatedAge}.`);

		return updatedAge;
	}

	return player.Age;
}

async function getLongestTeam(player)
{
	const seasonStatsRecord = await getSeasonStatsRecord(player);

	if(!seasonStatsRecord)
	{
		return null;
	}

	const longestTeam = await getLongestTeamFromSeasonStats(seasonStatsRecord);

	return longestTeam;
}

async function convertPlayerToCoach(player)
{
	const coachTable = franchise.getTableByUniqueId(tables.coachTable); // Get all the tables we'll need
	const freeAgentCoachTable = franchise.getTableByUniqueId(tables.freeAgentCoachTable);
	const presentationTable = franchise.getTableByUniqueId(tables.presentationTable);

	await FranchiseUtils.readTableRecords([
		coachTable,
		freeAgentCoachTable,
		presentationTable
	]);

	const nextCoachRecord = coachTable.header.nextRecordToUse; // Get next record to use for the coach table
  	const coachBinary = getBinaryReferenceData(coachTable.header.tableId, nextCoachRecord); // Then, we need the current row binary for both tables

	const coachRecord = coachTable.records[nextCoachRecord];

  	adjustPresentationId(coachRecord, presentationTable); // Get presentation id

	setDefaultCoachValues(coachRecord); // Set all default coach values

	coachRecord.FirstName = player.FirstName;
	coachRecord.LastName = player.LastName;

	// Construct the short coach name
	let coachName = `${player.FirstName[0]}. ${player.LastName}`;

	// Truncate if it exceeds max length
	const maxNameLength = FranchiseUtils.MAX_FIELD_LENGTH.Name;
	if (coachName.length > maxNameLength) {
		coachName = coachName.slice(0, maxNameLength);
	}

	coachRecord.Name = coachName;

	setCoachPosition(coachRecord, player); // Get coach position

	const teamPlayedForLongest = await getLongestTeam(player);

	//console.log(`Setting playbook for coach ${coachRecord.FirstName} ${coachRecord.LastName} with longest team ${teamPlayedForLongest.DisplayName}`);

	await setPlaybooks(coachRecord, teamPlayedForLongest); // Get playbooks

	//await setSchemes(coachRecord); // Get coach schemes

	getArchetype(coachRecord);

	await setCoachAppearance(coachRecord, player);

	await updateCoachVisual(coachRecord);

	await CoachTalentFunctions.regenerateTalents(franchise, tables, coachRecord);
	
	await addCoachToFATable(freeAgentCoachTable, coachBinary);

	coachRecord.CoachAge = await getUpdatedAge(player);

	return coachRecord;
}

franchise.on('ready', async function () {
    // Get required tables	
	const playerTable = franchise.getTableByUniqueId(tables.playerTable);

	// Read required tables
	await playerTable.readRecords();

	const coachingCandidates = [];
	
	// Number of rows in the player table
    const numRows = playerTable.header.recordCapacity;

	// Iterate through the player table
    for (let i = 0; i < numRows; i++) 
	{ 
        // If it's an empty row or invalid player, skip this row
		if (!FranchiseUtils.isValidPlayer(playerTable.records[i], {includeSignedPlayers: false, includeFreeAgents: false, includePracticeSquad: false, includeExpiringPlayers: false, includeRetiredPlayers: true, includeDeletedPlayers: true}))
		{
			continue;
        }

		const player = playerTable.records[i];

		// Here is where we determine if the player is a candidate to become a coach

		// Beginning with some basic elimination criteria

		const baseElimChance = 80;
		const mediumElimChance = 60;
		const lowElimChance = 30;

		let elimChanceModifier = 0;

		// Hall of famers are very unlikely to become coaches
		const isHofer = await isPlayerHofer(player);

		if(isHofer)
		{
			if(FranchiseUtils.getRandomNumber(0, 100) <= 95)
			{
				continue;
			}
		}
		else if(FranchiseUtils.getPlayerTags(player).includes('Mentor'))
		{
			// Mentors are more likely to be coaching candidates, so reduce other elimination chances
			elimChanceModifier = 20; 
		}
		else
		{
			elimChanceModifier = -5;
		}

		const isJourneyman = await isPlayerJourneyman(player);

		if(isJourneyman)
		{
			elimChanceModifier += 5;
		}

		if(player.LegacyScore > 10000)
		{
			elimChanceModifier -= 10;
		}

		const netBaseElimChance = Math.max(0, Math.min(baseElimChance - elimChanceModifier, 100));
		const netMediumElimChance = Math.max(0, Math.min(mediumElimChance - elimChanceModifier, 100));
		const netLowElimChance = Math.max(0, Math.min(lowElimChance - elimChanceModifier, 100));

		if(player.YearsPro > 6)
		{
			if(FranchiseUtils.getRandomNumber(1, 100) <= netBaseElimChance)
			{
				continue;
			}
		}

		if(player.OverallRating > 76)
		{
			if(FranchiseUtils.getRandomNumber(1, 100) <= netBaseElimChance)
			{
				continue;
			}
		}

		if(player.Position !== 'QB')
		{
			if(FranchiseUtils.OLINE_POSITIONS.includes(player.Position) || player.Position === 'WR' || player.Position === 'TE')
			{
				if(FranchiseUtils.getRandomNumber(1, 100) <= netMediumElimChance)
				{
					continue;
				}
			}
			else
			{
				if(FranchiseUtils.getRandomNumber(1, 100) <= netBaseElimChance)
				{
					continue;
				}
			}

			if(FranchiseUtils.getRandomNumber(1, 100) <= netLowElimChance)
			{
				continue;
			}
		}

		if(FranchiseUtils.getRandomNumber(1, 100) <= netLowElimChance)
		{
			continue;
		}

		// If we made it here, the player is a coaching candidate
		coachingCandidates.push(player);

    }

	if(FranchiseUtils.DEBUG_MODE || true)
	{
		console.log(`Identified ${coachingCandidates.length} potential coaching candidates:`);
		for(const candidate of coachingCandidates)
		{
			let isMentor = false;
			if(FranchiseUtils.getPlayerTags(candidate).includes('Mentor'))
			{
				isMentor = true;
			}
			console.log(`- ${candidate.FirstName} ${candidate.LastName}, Position: ${candidate.Position}, Overall: ${candidate.OverallRating}, Years Pro: ${candidate.YearsPro}, Mentor: ${isMentor}`);
		}
	}

	await FranchiseUtils.shuffleArray(coachingCandidates);

	// Select a portion of the candidates to become coaches
	const numCoachesToAdd = Math.min(FranchiseUtils.getRandomNumber(1, 4), coachingCandidates.length);

	const selectedIndices = [];

	for (let i = 0; i < numCoachesToAdd; i++) 
	{
		let selectedIndex = FranchiseUtils.getRandomNumber(0, coachingCandidates.length - 1);
		while (selectedIndices.includes(selectedIndex)) 
		{
			selectedIndex = FranchiseUtils.getRandomNumber(0, coachingCandidates.length - 1);
		}
		selectedIndices.push(selectedIndex);
	}

	for(let i = 0; i < numCoachesToAdd; i++)
	{
		const selectedCandidate = coachingCandidates[selectedIndices[i]];
		const newCoach = await convertPlayerToCoach(selectedCandidate);

		console.log(`\nAdded Coach: ${newCoach.FirstName} ${newCoach.LastName}, Position: ${newCoach.Position}, Age: ${newCoach.CoachAge}`);
	}

	// Program complete, so print success message, save the franchise file, and exit
	console.log("\nCoaches added successfully.\n");
    await FranchiseUtils.saveFranchiseFile(franchise);
	FranchiseUtils.EXIT_PROGRAM();
  
});
  