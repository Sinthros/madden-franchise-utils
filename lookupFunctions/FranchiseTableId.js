
const tables = {
    // Player tables
    playerTable: 1612938518,
    freeAgentTable: 4201237426,
    rosterTable: 4062699918,
    rosterInfoTable: 2907326382,
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
    draftBoardEvalArrayTable: 2939766573,
    scoutFocusArrayTable: 249904460,
    scoutPrivateArrayTable: 621078202,
    //Character Visuals
    characterVisualsTable: 1429178382,
    // Team Related
    teamTable: 502886486,
    afcEastTable: 2353236438,
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
    // League Related
    storyTable: 53507767,
    storyArrayTable: 1350117431,
    tweetTable: 2206445889,
    seasonGameTable: 1607878349,
    pendingSeasonGamesTable: 2877284424,
    practiceEvalTable: 1009707988,
    seasonGameRequestTable: 2943829712,
    seasonInfoTable: 3123991521,
    currentAwardTable: 1868257145,
    playerAwardTable: 657983086,
    coachAwardTable: 3027881868,
    awardArrayTable: 1586942378,
    playerTransactionTable: 2590627814,
    draftPickTable: 343624504,
    yearSummaryArray: 2073486305,
    yearSummary: 2136473174,
    leagueHistoryArray: 444189422,
    leagueHistoryAward: 335278464,
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
    // Retirement
    retirementTable: 761908674,
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

    // Stadium
    stadiumPartInfoTable: 3336445590,
    stadiumTable: 2377187865,

    // Presentation ID
    presentationTable: 3947910319






}

module.exports = {
    tables
}