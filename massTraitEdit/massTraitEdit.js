// Required modules
const FranchiseUtils = require('../Utils/FranchiseUtils');
const validGameYears = [
  FranchiseUtils.YEARS.M22,
  FranchiseUtils.YEARS.M23,
  FranchiseUtils.YEARS.M24,
  FranchiseUtils.YEARS.M25
];

console.log(`This program will update various traits in your franchise file. Madden ${FranchiseUtils.formatListString(validGameYears)} are supported.`);

// Set up franchise file
const franchise = FranchiseUtils.init(validGameYears);
const tables = FranchiseUtils.getTablesObject(franchise);

franchise.on('ready', async function () {
    const playerTable = franchise.getTableByUniqueId(tables.playerTable);
    const receiverPositions = ['WR','TE','HB','FB'];
    const defensivePositions = ['DT','RE','LE','LOLB','ROLB','MLB','CB','FS','SS'];
    const defensiveBacksPositions = ['CB','FS','SS'];
    const linebackerPositions = ['MLB','ROLB','LOLB'];
    const starPlayers = ['Star','SuperStar','XFactor'];
    const superStarPlayers = ['SuperStar','XFactor'];

    await FranchiseUtils.readTableRecords([playerTable]);
    const numRows = playerTable.header.recordCapacity; //Number of rows in the player table
    for (let i = 0; i < numRows; i++) 
    {
      if(!FranchiseUtils.isValidPlayer(playerTable.records[i]))
      {
        continue;
      }

      const playerPosition = playerTable.records[i]['Position'];
      const playerDevelopmentTrait = playerTable.records[i]['TraitDevelopment'];
      const overallRating = playerTable.records[i]['OverallRating'];

      playerTable.records[i]['TRAIT_COVER_BALL'] = 'ForAllHits';
      playerTable.records[i]['TRAIT_THROWAWAY'] = true;

      if (overallRating >= 80 || starPlayers.includes(playerDevelopmentTrait)) 
      {
        playerTable.records[i]['TRAIT_HIGHMOTOR'] = true;
      }

      if (overallRating >= 90 || superStarPlayers.includes(playerDevelopmentTrait)) 
      {
        playerTable.records[i]['TRAIT_CLUTCH'] = true;
      }


      if (playerPosition === 'QB') 
      {
        playerTable.records[i]['TRAIT_SENSE_PRESSURE'] = 'Average';
        let throwPowerRating = playerTable.records[i]['ThrowPowerRating'];
        let awarenessRating = playerTable.records[i]['AwarenessRating'];

        if (throwPowerRating >= 88 || awarenessRating >= 70) 
        {
          playerTable.records[i]['TRAIT_FORCE_PASS'] = 'Ideal';
        }
        else 
        {
          playerTable.records[i]['TRAIT_FORCE_PASS'] = 'Aggressive';
        }
      }

      else if (receiverPositions.includes(playerPosition)) 
      {
        if (playerPosition === 'WR') 
        {
          playerTable.records[i]['TRAIT_YACCATCH'] = true;
          playerTable.records[i]['TRAIT_POSSESSIONCATCH'] = true;
          playerTable.records[i]['TRAIT_HIGHPOINTCATCH'] = true;
          playerTable.records[i]['TRAIT_PLAY_BALL'] = 'Aggressive';
        }
        else 
        {
          let catchingRating = playerTable.records[i]['CatchingRating'];
          if (catchingRating >= 70) 
          {
            playerTable.records[i]['TRAIT_YACCATCH'] = true;
            playerTable.records[i]['TRAIT_POSSESSIONCATCH'] = true;
            playerTable.records[i]['TRAIT_HIGHPOINTCATCH'] = true;
            playerTable.records[i]['TRAIT_PLAY_BALL'] = 'Aggressive';

          }
        }      

      }
      
      else if (defensivePositions.includes(playerPosition)) 
      {
        playerTable.records[i]['TRAIT_DLSWIM'] = true;
        playerTable.records[i]['TRAIT_DLSPIN'] = true;
        playerTable.records[i]['TRAIT_DLBULLRUSH'] = true;
        playerTable.records[i]['TRAIT_STRIPBALL'] = true;

        let hitPowerRating = parseInt(playerTable.records[i]['HitPowerRating']);
        let traitDevelopment = playerTable.records[i]['TraitDevelopment'];
        if (hitPowerRating >= 90 && traitDevelopment === 'XFactor')
        {
          playerTable.records[i]['TRAIT_BIGHITTER'] = true;
        }
        else
        {
          playerTable.records[i]['TRAIT_BIGHITTER'] = false;
        }
        
        if (linebackerPositions.includes(playerPosition))
        {
          let zoneCoverageRating = playerTable.records[i]['ZoneCoverageRating'];
          let manCoverageRating = playerTable.records[i]['ManCoverageRating'];

          if (manCoverageRating >= 65 || zoneCoverageRating >= 65) 
          {
            playerTable.records[i]['TRAIT_PLAY_BALL'] = 'Aggressive';
          }

        }

        else if (defensiveBacksPositions.includes(playerPosition)) 
        {
          playerTable.records[i]['TRAIT_PLAY_BALL'] = 'Aggressive';
        }
      }
    }

    console.log("Trait edits applied successfully.");
    await FranchiseUtils.saveFranchiseFile(franchise);
    FranchiseUtils.EXIT_PROGRAM();
  
});
  