const puppeteer = require('puppeteer');
const fs = require('fs'); 

const YEAR = 2025;
const SUFFIX = `/season/${YEAR}/seasontype/2`
async function fetchAllTeamStats() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const urls = {
        offense: 'https://www.espn.com/nfl/stats/team/_' + SUFFIX,
        offensePassing: 'https://www.espn.com/nfl/stats/team/_/stat/passing' + SUFFIX,
        offenseRushing: 'https://www.espn.com/nfl/stats/team/_/stat/rushing' + SUFFIX,
        offenseDowns: 'https://www.espn.com/nfl/stats/team/_/stat/downs' + SUFFIX,
        defense: 'https://www.espn.com/nfl/stats/team/_/view/defense' + SUFFIX,
        defensePassing: 'https://www.espn.com/nfl/stats/team/_/view/defense/stat/passing' + SUFFIX,
        special: 'https://www.espn.com/nfl/stats/team/_/view/special' + SUFFIX,
        turnovers: 'https://www.espn.com/nfl/stats/team/_/view/turnovers' + SUFFIX
    };

    const stats = {};

    for (const [section, url] of Object.entries(urls)) {
        await page.goto(url, { waitUntil: 'networkidle2' });

        const columnNames = await page.evaluate(() => {
            const headers = Array.from(document.querySelectorAll('.Table__header-group .Table__TR:first-child .Table__TH'));
            const subHeaders = Array.from(document.querySelectorAll('.Table__header-group .Table__sub-header .Table__TH'));
        
            const columnNames = [];
            let subIndex = 0;
        
            headers.forEach(header => {
                const group = header.textContent.trim();
                const colspan = parseInt(header.getAttribute('colspan'), 10) || 1;
                for (let i = 0; i < colspan; i++) {
                    const subHeader = subHeaders[subIndex]?.textContent.trim();
                    columnNames.push(`${group}_${subHeader}`.replace(/\s+/g, '_'));
                    subIndex++;
                }
            });
        
            return columnNames;
        });


        // Extract team full names
        const teamNames = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('table.Table--fixed-left tbody.Table__TBODY tr')).map(row => {
                const teamLink = row.querySelector('a.AnchorLink img');
                return teamLink?.getAttribute('title'); // Full name, e.g., "Baltimore Ravens"
            }).filter(Boolean); // Remove null values
        });

        // Extract stats rows
        const statsRows = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.Table__ScrollerWrapper tbody.Table__TBODY tr')).map(row => {
                return Array.from(row.querySelectorAll('.Table__TD')).map(cell => cell.textContent.trim());
            });
        });

        stats[section] = teamNames.map((team, index) => {
            const teamStats = {};
            columnNames.slice(1).forEach((colName, colIndex) => { // Skip the first "_Team" column
                const statValue = statsRows[index]?.[colIndex]; // Adjust index to match row alignment
                teamStats[colName] = statValue;
            });
        
            return { TEAM: team, ...teamStats }; // Include team name at the top
        });
    }

    await browser.close();

    // Merge stats by TEAM
    const mergedStats = {};
    for (const [section, sectionStats] of Object.entries(stats)) {
        sectionStats.forEach(teamStat => {
            const team = teamStat.TEAM;
            if (!mergedStats[team]) mergedStats[team] = {};
            mergedStats[team][section] = teamStat;
        });
    }

    return mergedStats;
}

function convertStringsToInts(data) {
    if (Array.isArray(data)) {
        return data.map(convertStringsToInts);
    } else if (typeof data === 'object' && data !== null) {
        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, convertStringsToInts(value)])
        );
    } else if (typeof data === 'string' && /^\d+$/.test(data.replace(/,/g, ''))) {
        // Convert strings of digits to numbers, ignoring commas
        return parseInt(data.replace(/,/g, ''), 10);
    }
    return data;
}

function convertStringsToInts(data) {
    if (Array.isArray(data)) {
        return data.map(convertStringsToInts);
    } else if (typeof data === 'object' && data !== null) {
        return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, convertStringsToInts(value)])
        );
    } else if (typeof data === 'string' && /^\d+$/.test(data.replace(/,/g, ''))) {
        // Convert strings of digits to numbers, ignoring commas
        return parseInt(data.replace(/,/g, ''), 10);
    }
    return data;
}

fetchAllTeamStats()
    .then(data => {
        const COLUMN_MAPPINGS = {
            offense: [null, null, "OFFYARDS", null, "OFFPASSYARDS", null, "OFFRUSHYARDS", null, "SeasonLeagPointsFor", null],
            offensePassing: [null, null, null, "PASSATTEMPTS", null, null, null, null, null, "PASSTDS", null, "SACKSALLOWED", "OFFSACKYARDS", null],
            offenseRushing: [null, null, "RUSHATTEMPTS", null, null, null, null, "RUSHTDS", null, null],
            offenseDowns: [null, null, "FIRSTDOWNS", null, null, null, "THIRDDOWNCONV", "THIRDDOWNS",
                null, "FOURTHDOWNCONV", "FOURTHDOWNS", null, "PENALTIES", "PENALTYYARDS"],
            defense: [null, null, null, null, "DEFPASSYARDS", null, "DEFRUSHYARDS", null, "SeasonLeagPointsAgainst", null],
            defensePassing: [null, null, null, null, null, null, null, null, null, null, null, "SACKS", "DEFSACKYARDS", null],
            special: [null, null, null, "KICKRETURNYARDS", null, null, null, null, "PUNTRETURNYARDS", null, null, null, null],
            turnovers: [null, null, null, "DEFINTS", "FUMBLEREC", "TAKEAWAYS", "PASSINTS", "FUMBLESLOST", "GIVEAWAYS"],
        };

        function updateSectionColumns(section, mapping) {
            if (!section) return;

            const sectionKeys = Object.keys(section);
            sectionKeys.forEach((key, index) => {
                if (index < mapping.length) {
                    if (mapping[index] === null) {
                        delete section[key];
                    } else if (mapping[index]) {
                        const value = section[key];
                        delete section[key];
                        section[mapping[index]] = value;
                    }
                }
            });
        }

        // Apply column mappings
        Object.values(data).forEach(team => {
            for (const [sectionName, mapping] of Object.entries(COLUMN_MAPPINGS)) {
                updateSectionColumns(team[sectionName], mapping);
            }
        });

        // Flatten the sections into a single object per team
        const flattenedData = Object.fromEntries(
            Object.entries(data).map(([teamName, sections]) => [
                teamName,
                Object.assign({}, ...Object.values(sections))
            ])
        );

        // Convert strings to integers
        const convertedData = convertStringsToInts(flattenedData);

        // Write the output to a JSON file
        fs.writeFile('team_stats.json', JSON.stringify(convertedData, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file', err);
            } else {
                console.log('Data written to output.json');
            }
        });
    })
    .catch(console.error);