const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

getSchedules(2023, 2023);

function getSchedules(startingYear, endingYear) {
  for (let i = startingYear; i <= endingYear; i++) {
    parseYear(i);
  }
}

function parseYear(year) {
  request({
    uri: 'https://www.pro-football-reference.com/years/' + year + '/games.htm'
  }, handleResponse);
};

function handleResponse(err, res, body) {
  if (err) {
    throw new Error('Error getting response: ' + err);
  }

  var pageData = parsePage(body);
  // TODO: FIX THE YEAR HAVING TO BE PUT IN MANUALLY
  // We SHOULD be able to do pageData.year, but it's returning an empty string right now
  fs.writeFile(`schedules/${2023}.json`, JSON.stringify(pageData), (err) => {
    if (err) throw err;
  });
};

function parsePage(body) {
  const $ = cheerio.load(body);
  const pageData = {
    year: null,
    weeks: []
  };

  //TODO: Fix year not being retrieved properly
  const year = $('#meta [itemprop=name] span:first-child').text();
  pageData.year = year;

  const gameTable = $('#all_games tbody tr').each(function () {
    let week = $(this).find('th').text();
    const isRegularSeason = week.match(/^\d{1,2}$/) !== null;
    const isPreseason = week.match(/^Pre(\d{1})$/)

    if (isRegularSeason || isPreseason) {
      const isFutureWeek = $(this).find('td[data-stat=visitor_team]').text();

      if (isPreseason) {
        week = isPreseason[1];
      }

      const day = $(this).find('td[data-stat=game_day_of_week]').text();
      const time = $(this).find('td[data-stat=gametime]').text();

      let homeTeam, awayTeam;

      if (!isFutureWeek) {
        const gameLocation = $(this).find('td[data-stat=game_location]').text();

        if (gameLocation === '@') {
          homeTeam = $(this).find('td[data-stat=loser]').text();
          awayTeam = $(this).find('td[data-stat=winner]').text();
        }
        else {
          homeTeam = $(this).find('td[data-stat=winner]').text();
          awayTeam = $(this).find('td[data-stat=loser]').text();
        }
      }
      else {
        homeTeam = $(this).find('td[data-stat=home_team]').text();
        awayTeam = $(this).find('td[data-stat=visitor_team]').text();
      }

      const game = {
        day: day,
        time: time,
        homeTeam: homeTeam,
        awayTeam: awayTeam
      };

      const weekType = isRegularSeason ? 'season' : 'preseason';
      const weekToAdd = pageData.weeks.find((weekIterator) => { return weekIterator.type === weekType && weekIterator.number === week; });

      if (!weekToAdd) {
        pageData.weeks.push({
          'type': weekType,
          'number': week,
          'games': [game]
        });
      }
      else {
        weekToAdd.games.push(game);
      }
    }
  });

  return pageData;
};