// Tables from Madden 24 and before
const tables = {
    // Player tables
    playerTable: 1612938518,
    freeAgentTable: 4201237426,
    rosterTable: 4062699918,
    rosterInfoTable: 2907326382,
    afcRosterTable: 3212932027,
    nfcRosterTable: 2278477318,
    reSignTable: 846670960,
    reSignArrayTable: 91905499,
    depthChartTable: 423128545,
    depthChartPlayerTable: 2940627083,
    playerMerchTable: 2046620302,
    activeAbilityArrayTable: 3545956611,
    activeAbilityArrayTableM22: 3512815678,
    draftedPlayersArrayTable: 4073486347,
    draftedPlayersArrayTableM22: 3638782800,
    marketedPlayersArrayTable: 434873538,
    marketedPlayersArrayTableM22: 3584052617,
    topMarketedPlayers: 1505961096,
    rookieStatTrackerTable: 3785623318,
    rookieStatTrackerArray: 540270022,
    //Practice Squad
    practiceSquadTable: 3892093744,
    // Draft Info
    draftClassTable: 786598926,
    branchingStoryArrayTable: 4109008792,
    draftBoardEvalTable: 3448250660,
    draftBoardEvalArrayTable: 2939766573,
    scoutFocusArrayTable: 249904460,
    scoutPrivateArrayTable: 621078202,
    //Character Visuals
    characterVisualsTable: 1429178382,
    // Team Related
    teamTable: 502886486,
    afcEastTable: 2353236438, // These divisional tables are removed in tablesM25, replaced with new division array tables
    afcNorthTable: 2164305679,
    afcSouthTable: 2244063928,
    afcWestTable: 2609308349,
    nfcEastTable: 2672295690,
    nfcNorthTable: 2449791443,
    nfcSouthTable: 2529543268,
    nfcWestTable: 2928310745,
    scoutsTable: 4003749334,
    teamScoutTable: 3639433383,
    teamRoadmapTable: 3807550398,
    ownerTable: 2357578975,
    // Coach tables
    coachTalentEffects: 2084066789,
    coachTable: 1860529246,
    freeAgentCoachTable: 2191908271,
    activeTalentTree: 1386036480,
    talentNodeStatus: 4148550679,
    talentNodeStatusArray: 232168893,
    talentSubTreeStatus: 1725084110,
    playerPersonnelTable: 4279422699,
    // League Related
    storyTable: 53507767,
    storyArrayTable: 1350117431,
    tweetTable: 2206445889,
    tweetArrayTable: 1421358464,
    seasonGameTable: 1607878349,
    pendingSeasonGamesTable: 2877284424,
    practiceEvalTable: 1009707988,
    seasonGameRequestTable: 2943829712,
    seasonInfoTable: 3123991521,
    weeklyAwardTable: 1868257145,
    lastSeasonWeeklyAwardTable: 1875040326,
    allTimeAwardTable: 1188264198,
    playerAwardTable: 657983086,
    coachAwardTable: 3027881868,
    awardArrayTable: 1586942378,
    draftPickTable: 343624504,
    draftPickArrayTable: 2295354658,
    yearSummaryArray: 2073486305,
    yearSummary: 2136473174,
    leagueHistoryArray: 444189422,
    leagueHistoryAward: 335278464,
    leagueTable: 1056825014,
    salaryInfoTable: 3759217828,
    salCapIncreaseTable: 734850521,
    // Player Stats
    gameStatsTable: 3425479817,
    gameOffKPReturnStatsTable: 3388716768,
    gameOffStatsTable: 3937354187,
    gameOLineStatsTable: 2067273102,
    gameDefStatsTable: 698792022,
    gameKickingStatsTable: 589639074,
    gameDefKPReturnStatsTable: 300209847,
    careerOffKPReturnStatsTable: 2742909435,
    careerOffStatsTable: 1181574195,
    careerOLineStatsTable: 694886857,
    careerDefStatsTable: 2237963694,
    careerKickingStatsTable: 2471741740,
    careerDefKPReturnStatsTable: 2070026668,
    seasonStatsTable: 2358416956,
    seasonOffKPReturnStatsTable: 4010933771,
    seasonOffStatsTable: 3519623764,
    seasonOLineStatsTable: 1611777990,
    seasonDefStatsTable: 314624969,
    seasonKickingStatsTable: 2742414559,
    seasonDefKPReturnStatsTable: 923704924,
    // Team Stats
    teamStatsTable: 1558486428,
    teamGameStatsTable: 1731088851,
    // Free Agency
    contractOfferTable: 2808779617,
    playerContractTable: 728038538,
    salaryBonusIntTable: 1553774079,
    contractOfferArrayTable: 2918938877,
    // User Control
    franchiseUserTable: 3429237668,
    franchiseUsersArray: 2655789119,
    teamSettingTable: 3073982847,
    //Ability Tables
    mainSigAbilityTable: 2421474727,
    secondarySigAbilityTable: 3439793083,
    signatureArrayTable: 1691308264,
    //The "Franchise" table, contains info about other relevant tables
    franchiseTable: 2684583414,

    //Misc tables: Almost never need these
    characterActiveMediaGoal: 3932345199,
    characterActiveMediaGoalArray: 4003712728,

    //Scheduler tables: Don't touch these unless you know what you're doing
    schedulerTable: 2446261029,
    gameEventTable: 987800642,
    schedulerAppointmentTable: 1395135267,

    //FTC Tables
    talentSubTreeFtcTable: 3439205175,
    talentNodeFtcTable: 2361769831,
    talentNodeArrayFtcTable: 4261606212,
    talentFtcTable: 2347346465,

    signatureAbilitesFtcTable: 4012247826,
    signatureByPositionFtcTable: 2601028454,
    positionSignatureAbilityArrayFtcTableM24: 3965066908,
    positionSignatureAbilityArrayFtcTableM25: 3517346360,
    positionSignatureAbilityFtcTable: 3636158354,
    signatureAbilityFtcTable: 1291148681,


    //Training tables
    drillCompletedTable: 1204263071,
    
    //Franchise Debug Table, primarily used for franchise file fingerprinting
    franchiseDebugModuleTable: 4212179270,

    //History tables
    historyEntryArray: 1765841029,
    historyEntry: 3363303785,
    transactionHistoryArray: 766279362,
    transactionHistoryEntry: 2590627814,
    playerEditTransactionHistoryTable: 636827023,
    playerPositionChangeHistoryTable: 2645009419,
    coachTransactionHistoryEntryTable: 2701814500,
    draftPickTransactionHistoryTable: 415688378,




    //Trade tables
    tradeNegotiationArrayTable: 2760331084,
    tradeNegotiationTable: 1352033064,
    teamTradePackageArrayTable: 2688963323,
    tradeRequestArrayTable: 1322332973,
    pendingTeamArrayTable: 2550787910,
    teamTradePackageTable: 1415020191,

    //Acquisition tables
    playerAcquisitionEvaluationTable: 2531183555,
    playerAcquisitionEvaluationArrayTable: 498911520,
    playerAcquisitionEvaluationArrayArrayTable: 427676823,

    // Stadium
    stadiumPartInfoTable: 3336445590,
    stadiumTable: 2377187865,

    // Presentation ID
    presentationTable: 3947910319,

    hallOfFameCoachTable: 1455634092,
    hallOfFamePlayerTable: 1170686064,
    retiredPlayerTable: 3407263698,
    retiredCoachTable: 2334648001,
    
    retirementAppointmentTable: 761908674,
    retirementAppointmentArrayTable: 1642003985,

    poseTable: 3761454761,

    // Stat record tables
    seasonStatRecordTable: 509272061,
    gameStatRecordTable: 446415434,
    careerStatRecordTable: 3930846105

}

// Madden 25 tables 
const tablesM25 = {
    // Player tables
    playerTable: 1612938518,
    freeAgentTable: 3717720305,
    rosterTable: 1126708202,
    proBowlRosterTable: 1567581167,
    rosterInfoTable: 2907326382,
    reSignTable: 846670960,
    reSignArrayTable: 298416424,
    depthChartTable: 797195324,
    depthChartPlayerTable: 889352590,
    practiceSquadTable: 1504607832,
    draftClassTable: 786598926,
    focusTrainingTable: 80738141,
    miniGameCompletedArrayTable: 4095723150,

    // As of M25, Offense/Defensive active abilities are separated to 2 tables
    offenseActiveAbilityArrayTable: 4183613527,
    defenseActiveAbilityArrayTable: 725950859,

    // This lists the drafted players for the team
    draftedPlayersArrayTable: 943806295,

    //Marketing tables
    marketedPlayersArrayTable: 4041136953,
    topMarketedPlayers: 3036818244,
    playerMerchTable: 2046620302,

    // Tracks rookie stats
    rookieStatTrackerTable: 3353965719,
    rookieStatTrackerArray: 540270022,

    // Character Visuals
    characterVisualsTable: 1429178382,

    // Franchise file fingerprinting tables
    tutorialInfoTable: 1708658566,
    franchiseDebugModuleTable: 4212179270,

    // These list the divisions and the teams within them
    divisionTeamTable: 853026208,
    divisionTable: 177707037,

    branchingStoryArrayTable: 4109008792,
    draftBoardEvalTable: 3448250660,
    draftBoardEvalArrayTable: 2939766573,
    scoutFocusArrayTable: 1206464093,
    scoutPrivateArrayTable: 1252657284,
    teamTable: 637929298,
    practiceTeamTable: 943739547,
    scoutsTable: 4003749334,
    teamScoutTable: 1925975938,
    teamRoadmapTable: 3807550398,
    teamRoadmapEval: 3256892799,
    ownerTable: 2357578975,
    coachTalentEffects: 2084066789,
    coachTable: 1860529246,
    freeAgentCoachTable: 2912348295,
    activeTalentTree: 1386036480,
    talentNodeStatus: 4148550679,
    talentNodeStatusArray: 2516681065,
    talentSubTreeStatus: 1725084110,
    playerPersonnelTable: 4279422699,
    storyTable: 53507767,
    storyArrayTable: 1350117431,
    tweetTable: 2206445889,
    tweetArrayTable: 1421358464,
    seasonGameTable: 1607878349,
    pendingSeasonGamesTable: 2877284424,
    practiceEvalTable: 1009707988,
    seasonGameRequestTable: 2943829712,
    seasonInfoTable: 3123991521,
    weeklyAwardTable: 1868257145,
    lastSeasonWeeklyAwardTable: 1875040326,
    allTimeAwardTable: 1188264198,
    playerAwardTable: 657983086,
    coachAwardTable: 3027881868,
    awardArrayTable: 1586942378,
    draftPickTable: 2546719563,
    draftPickArrayTable: 2295354658,
    yearSummaryArray: 2073486305,
    yearSummary: 2592669074,
    leagueHistoryArray: 2466957052,
    leagueHistoryAward: 2655641637,
    leagueTable: 1056825014,
    salaryInfoTable: 3759217828,
    salCapIncreaseTable: 734850521,

    // Player stats
    gameStatsTable: 3646354758,
    gameOffKPReturnStatsTable: 3388716768,
    gameOffStatsTable: 3937354187,
    gameOLineStatsTable: 2067273102,
    gameDefStatsTable: 698792022,
    gameKickingStatsTable: 589639074,
    gameDefKPReturnStatsTable: 300209847,
    careerOffKPReturnStatsTable: 2742909435,
    careerOffStatsTable: 1181574195,
    careerOLineStatsTable: 694886857,
    careerDefStatsTable: 2237963694,
    careerKickingStatsTable: 2471741740,
    careerDefKPReturnStatsTable: 2070026668,
    seasonStatsTable: 3856160076,
    seasonOffKPReturnStatsTable: 4010933771,
    seasonOffStatsTable: 3519623764,
    seasonOLineStatsTable: 1611777990,
    seasonDefStatsTable: 314624969,
    seasonKickingStatsTable: 2742414559,
    seasonDefKPReturnStatsTable: 923704924,

    teamStatsTable: 1742945100,
    teamGameStatsTable: 1731088851,
    contractOfferTable: 2808779617,
    playerContractTable: 728038538,
    salaryBonusIntTable: 2228202903,
    contractOfferArrayTable: 2918938877,
    franchiseUserTable: 3429237668,
    franchiseUsersArray: 899004536,
    teamSettingTable: 3073982847,
    mainSigAbilityTable: 2421474727,
    secondarySigAbilityTable: 4217885853,
    signatureArrayTable: 1691308264,
    franchiseTable: 2684583414,
    characterActiveMediaGoal: 1758062620,
    characterActiveMediaGoalArray: 1812526507,
    schedulerTable: 2682909370,
    gameEventTable: 987800642,
    schedulerAppointmentTable: 1395135267,
    schedulerRelativeApptTable: 1629033009,

    //FTC Tables
    talentSubTreeFtcTable: 3439205175,
    talentNodeFtcTable: 2361769831,
    talentNodeArrayFtcTable: 312899008,
    talentFtcTable: 2347346465,
    signatureAbilitesFtcTable: 4012247826,
    signatureByPositionFtcTable: 2601028454,
    positionSignatureAbilityArrayFtcTable: 3517346360,
    positionSignatureAbilityFtcTable: 3636158354,
    signatureAbilityFtcTable: 1291148681,
    stadiumFtcTable: 2401887796,

    drillCompletedTable: 1015040736,
    franchiseDebugModuleTable: 4212179270,

    historyEntryArray: 1765841029,
    historyEntry: 3363303785,
    transactionHistoryArray: 766279362,
    transactionHistoryEntry: 2590627814,
    playerEditTransactionHistoryTable: 636827023,
    playerPositionChangeHistoryTable: 2645009419,
    coachTransactionHistoryEntryTable: 2701814500,
    draftPickTransactionHistoryTable: 415688378,

    tradeNegotiationArrayTable: 2760331084,
    tradeNegotiationTable: 696128833,
    teamTradePackageArrayTable: 871913715,
    tradeRequestArrayTable: 553397807,
    pendingTeamArrayTable: 288467196,
    teamTradePackageTable: 1052474922,
    playerAcquisitionEvaluationTable: 2531183555,
    playerAcquisitionEvaluationArrayTable: 583473893,
    playerAcquisitionEvaluationArrayArrayTable: 1502069987,
    stadiumPartInfoTable: 3336445590,
    stadiumTable: 2511317894,
    presentationTable: 3947910319,
    retiredPlayerTable: 2140088667,
    hallOfFamePlayerTable: 2752828393,
    retiredCoachTable: 2068722924,
    hallOfFameCoachTable: 1455634092,
    pendingSeasonGameTable: 2877284424,
    draftInfoTable: 1709168449,
    teamSeasonStatsTable: 1663182587,
    advanceStageRequestTable: 3867341041,
    advanceStageRequestArrayTable: 41989759,
    manageRosterRequestTable: 3307901321,
    manageStaffRequestTable: 3362371408,
    manageTeamRequestTable: 3433605863,
    scoutingRequestTable: 3003175917,
    requestArrayTable: 1476221848,

    retirementAppointmentTable: 761908674,
    retirementAppointmentArrayTable: 1642003985,

    careerStatRecordTable: 3126035436,
    seasonStatRecordTable: 3016865922,
    gameStatRecordTable: 3197279835,
    rookieGameStatRecordTable: 1291340498,
    rookieSeasonStatRecordTable: 1211717477,

    cutDayStartEventTable: 2298477515,
    cutDayStartReactionTable: 2554780874,
    playerSigningEvalTable: 70968015,
    autoSubSliderTable: 1533677710,
    injuryEvalTable: 4057340189,
    playerRetirementEvalTable: 3083602460,
    teamManagerTable: 1671438176,
    weeksToUpdateContentionPhaseTable: 303023139,
    tradeEval: 3332445998,
    positionCountTable: 2592853888,
    salaryMetricsSplineArray: 4129616452,
    coachRetirementEvalInfoTable: 2731649965,
    developmentSpline: 148197609,
    progressionXPSlider: 3067210636,
    draftPickEventTable: 2996999973,
    draftManagerTable: 4051979813
  }

// Madden 26 tables 
const tablesM26 = {
    // Player tables
    playerTable: 1612938518,
    freeAgentTable: 3717720305,
    rosterTable: 1126708202,
    proBowlRosterTable: 1567581167,
    rosterInfoTable: 2907326382,
    reSignTable: 846670960,
    reSignArrayTable: 298416424,
    depthChartTable: 797195324,
    depthChartPlayerTable: 889352590,
    practiceSquadTable: 1504607832,
    draftClassTable: 786598926,
    focusTrainingTable: 80738141,
    miniGameCompletedArrayTable: 4095723150,

    // As of M25, Offense/Defensive active abilities are separated to 2 tables
    offenseActiveAbilityArrayTable: 4183613527,
    defenseActiveAbilityArrayTable: 725950859,

    // This lists the drafted players for the team
    draftedPlayersArrayTable: 943806295,

    //Marketing tables
    marketedPlayersArrayTable: 4041136953,
    topMarketedPlayers: 3036818244,
    playerMerchTable: 2046620302,

    // Tracks rookie stats
    rookieStatTrackerTable: 3353965719,
    rookieStatTrackerArray: 540270022,

    // Character Visuals
    characterVisualsTable: 1429178382,

    // Franchise file fingerprinting tables
    tutorialInfoTable: 1708658566,
    franchiseDebugModuleTable: 4212179270,

    // These list the divisions and the teams within them
    divisionTeamTable: 853026208,
    divisionTable: 177707037,

    branchingStoryArrayTable: 4109008792,
    draftBoardEvalTable: 3448250660,
    draftBoardEvalArrayTable: 2939766573,
    scoutFocusArrayTable: 1206464093,
    scoutPrivateArrayTable: 1252657284,
    teamTable: 637929298,
    practiceTeamTable: 943739547,
    scoutsTable: 4003749334,
    teamScoutTable: 1925975938,
    teamRoadmapTable: 3807550398,
    teamRoadmapEval: 3256892799,
    ownerTable: 2357578975,
    coachTalentEffects: 2084066789,
    coachTable: 1860529246,
    freeAgentCoachTable: 2912348295,
    playerPersonnelTable: 4279422699,
    storyTable: 53507767,
    storyArrayTable: 1350117431,
    tweetTable: 2206445889,
    tweetArrayTable: 1421358464,
    seasonGameTable: 1607878349,
    pendingSeasonGamesTable: 2877284424,
    practiceEvalTable: 1009707988,
    seasonGameRequestTable: 2943829712,
    seasonInfoTable: 3123991521,
    weeklyAwardTable: 1868257145,
    lastSeasonWeeklyAwardTable: 1875040326,
    allTimeAwardTable: 1188264198,
    playerAwardTable: 657983086,
    coachAwardTable: 3027881868,
    awardArrayTable: 1586942378,
    draftPickTable: 2546719563,
    draftPickArrayTable: 2295354658,
    yearSummaryArray: 2073486305,
    yearSummary: 2592669074,
    leagueHistoryArray: 2466957052,
    leagueHistoryAward: 2655641637,
    leagueTable: 1056825014,
    salaryInfoTable: 3759217828,
    salCapIncreaseTable: 734850521,

    // Player stats
    gameStatsTable: 3646354758,
    gameOffKPReturnStatsTable: 3388716768,
    gameOffStatsTable: 3937354187,
    gameOLineStatsTable: 2067273102,
    gameDefStatsTable: 698792022,
    gameKickingStatsTable: 589639074,
    gameDefKPReturnStatsTable: 300209847,
    careerOffKPReturnStatsTable: 2742909435,
    careerOffStatsTable: 1181574195,
    careerOLineStatsTable: 694886857,
    careerDefStatsTable: 2237963694,
    careerKickingStatsTable: 2471741740,
    careerDefKPReturnStatsTable: 2070026668,
    seasonStatsTable: 3856160076,
    seasonOffKPReturnStatsTable: 4010933771,
    seasonOffStatsTable: 3519623764,
    seasonOLineStatsTable: 1611777990,
    seasonDefStatsTable: 314624969,
    seasonKickingStatsTable: 2742414559,
    seasonDefKPReturnStatsTable: 923704924,

    teamStatsTable: 1742945100,
    teamGameStatsTable: 1731088851,
    contractOfferTable: 2808779617,
    playerContractTable: 728038538,
    salaryBonusIntTable: 2228202903,
    contractOfferArrayTable: 2918938877,
    franchiseUserTable: 3429237668,
    franchiseUsersArray: 899004536,
    teamSettingTable: 3073982847,
    mainSigAbilityTable: 2421474727,
    secondarySigAbilityTable: 4217885853,
    signatureArrayTable: 1691308264,
    franchiseTable: 2684583414,
    characterActiveMediaGoal: 1758062620,
    characterActiveMediaGoalArray: 1812526507,
    schedulerTable: 2682909370,
    gameEventTable: 987800642,
    schedulerAppointmentTable: 1395135267,
    schedulerRelativeApptTable: 1629033009,

    //FTC Tables
    signatureAbilitesFtcTable: 4012247826,
    signatureByPositionFtcTable: 2601028454,
    positionSignatureAbilityArrayFtcTable: 3517346360,
    positionSignatureAbilityFtcTable: 3636158354,
    signatureAbilityFtcTable: 1291148681,
    stadiumFtcTable: 2401887796,

    drillCompletedTable: 1015040736,
    franchiseDebugModuleTable: 4212179270,

    historyEntryArray: 1765841029,
    historyEntry: 3363303785,
    transactionHistoryArray: 766279362,
    transactionHistoryEntry: 2590627814,
    playerEditTransactionHistoryTable: 636827023,
    playerPositionChangeHistoryTable: 2645009419,
    coachTransactionHistoryEntryTable: 2701814500,
    draftPickTransactionHistoryTable: 415688378,

    tradeNegotiationArrayTable: 2760331084,
    tradeNegotiationTable: 696128833,
    teamTradePackageArrayTable: 871913715,
    tradeRequestArrayTable: 553397807,
    pendingTeamArrayTable: 288467196,
    teamTradePackageTable: 1052474922,
    playerAcquisitionEvaluationTable: 2531183555,
    playerAcquisitionEvaluationArrayTable: 583473893,
    playerAcquisitionEvaluationArrayArrayTable: 1502069987,
    stadiumPartInfoTable: 3336445590,
    stadiumTable: 2511317894,
    presentationTable: 3947910319,
    retiredPlayerTable: 2140088667,
    hallOfFamePlayerTable: 2752828393,
    retiredCoachTable: 2068722924,
    hallOfFameCoachTable: 1455634092,
    pendingSeasonGameTable: 2877284424,
    draftInfoTable: 1709168449,
    teamSeasonStatsTable: 1663182587,
    advanceStageRequestTable: 3867341041,
    advanceStageRequestArrayTable: 41989759,
    manageRosterRequestTable: 3307901321,
    manageTeamRequestTable: 3433605863,
    scoutingRequestTable: 3003175917,
    requestArrayTable: 1476221848,

    retirementAppointmentTable: 761908674,
    retirementAppointmentArrayTable: 1642003985,

    careerStatRecordTable: 3126035436,
    seasonStatRecordTable: 3016865922,
    gameStatRecordTable: 3197279835,
    rookieGameStatRecordTable: 1291340498,
    rookieSeasonStatRecordTable: 1211717477,

    cutDayStartEventTable: 2298477515,
    cutDayStartReactionTable: 2554780874,
    playerSigningEvalTable: 70968015,
    autoSubSliderTable: 1533677710,
    injuryEvalTable: 4057340189,
    playerRetirementEvalTable: 3083602460,
    teamManagerTable: 1671438176,
    weeksToUpdateContentionPhaseTable: 303023139,
    tradeEval: 3332445998,
    positionCountTable: 2592853888,
    salaryMetricsSplineArray: 4129616452,
    coachRetirementEvalInfoTable: 2731649965,
    developmentSpline: 148197609,
    progressionXPSlider: 3067210636,
    draftPickEventTable: 2996999973,
    draftManagerTable: 4051979813
  }

module.exports = {
    tables,
    tablesM25,
    tablesM26
}