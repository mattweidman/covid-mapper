const width = 960, height = 550, legendHeight = 45;
const lowColor = "#dcdcdc", highColor = "#8b0000";
 
const tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
 
const svg = d3.select("#mapcontainer").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background-color", 'white');

const legendsvg = d3.select("#legendcontainer").append("svg")
    .attr("width", width)
    .attr("height", legendHeight)
    .style("background-color", 'white');

const mapTitleHeight = 45;
const mapTitleSvg = d3.select("#maptitlecontainer").append("svg")
    .attr("width", width)
    .attr("height", mapTitleHeight)
    .style("background-color", 'white');

const sources = "Sources: usafacts.org, covid19.who.int, data.worldbank.org";

const sourcesHeight = 15;
const sourcesSvg = d3.select("#sourcescontainer").append("svg")
    .attr("width", width)
    .attr("height", sourcesHeight)
    .style("background-color", 'white');

const path = d3.geoPath();

var options = [];

var docs = {};

moveSelectionsToBackOrFront();

const mapg = svg.append("g")
    .attr("class", "mapg");

const zoom = d3.zoom()
    .scaleExtent([1, 32])
    .on("zoom", function () {
        mapg.attr("transform", d3.event.transform);
    });
svg.call(zoom);

showWorldMap();

// Sphere shape
mapg.append("path")
    .attr("class", "sphereoutline")
    .style("visibility", "hidden");

loadDocs();
loadSuggestions();
showDocumentation();

createLegend();

d3.select("#mapoptions").on("change", () => {
    const optionSelected = d3.select("#mapoptions").node().value;
    updateMapType(optionSelected);
});

d3.select("#viewtype").on("change", () => {
    const optionSelected = d3.select("#viewtype").node().value;
    updateViewType(optionSelected);
});

var top5 = false; // Using this variable for toggle to decide if top5 queries are currently on screen or not
var showTop5 = true;
var inputExp = '';

// Set properties.id and properties.name for every region
function preprocessUsaMap(geomapFeatures, baseData) {
    for (const d of geomapFeatures) {
        d.properties.id = d.id;

        if (d.id in baseData) {
            d.properties.name = baseData[d.id].name;
        } else {
            d.properties.name = "Unrecognized county";
        }
    }
}

// return list of date strings extracted from CSV headers
function getDateListFromUsaData(rawData) {
    const allDates = [];
    for (const key in rawData[0]) {
        if (key.includes("/")) {
            allDates.push(key);
        }
    }
    return allDates;
}

// Convert raw USA data to new format with data separated by county.
// casesCsv: CSV containing [countyFIPS,County Name,State,stateFIPS,confirmedcases...]
// deathsCsv: CSV containing [countyFIPS,County Name,State,stateFIPS,deaths...]
// populationCsv: CSV containing [countyFIPS,County Name,State,population]
// allDates: list of date strings from CSV headers
// returns map of location ID -> CovidData object for each location (see CovidData in ast.ts)
function preprocessUsaData(casesCsv, deathsCsv, populationCsv, allDates) {
    const baseData = {};

    for (var i = 0; i < casesCsv.length; i++) {
        const cases = [], deaths = [], newCases = [], newDeaths = [];

        for (var j = 0; j < allDates.length; j++) {
            const dateStr = allDates[j];

            const casesToday = parseInt(casesCsv[i][dateStr]);
            const deathsToday = parseInt(deathsCsv[i][dateStr]);

            cases.push(casesToday);
            deaths.push(deathsToday);

            if (j === 0) {
                newCases.push(casesToday);
                newDeaths.push(deathsToday);
            } else {
                const casesYesterday = cases[j - 1];
                const deathsYesterday = deaths[j - 1];

                newCases.push(casesToday - casesYesterday);
                newDeaths.push(deathsToday - deathsYesterday);
            }
        }

        const newDatum = {
            id: casesCsv[i]["countyFIPS"],
            name: casesCsv[i]["County Name"],
            population: populationCsv[i]["population"],
            cases: cases,
            deaths: deaths,
            newCases: newCases,
            newDeaths: newDeaths
        };

        baseData[newDatum.id] = newDatum;
    }

    return baseData;
}

// Convert raw USA data to new format with data separated by state.
// casesCsv: CSV containing [countyFIPS,County Name,State,stateFIPS,confirmedcases...]
// deathsCsv: CSV containing [countyFIPS,County Name,State,stateFIPS,deaths...]
// populationCsv: CSV containing [countyFIPS,County Name,State,population]
// allDates: list of date strings from CSV headers
// stateAbbrsCsv: CSV containing [state,abbreviation]
// returns map of location ID -> CovidData object for each location (see CovidData in ast.ts)
function preprocessUsaStatesData(casesCsv, deathsCsv, populationCsv, stateAbbrsCsv, allDates) {
    const baseData = {};

    // Construct ID -> state name mapping
    const stateNames = {};
    for (const stateAbbrPair of stateAbbrsCsv) {
        stateNames[stateAbbrPair["abbreviation"]] = stateAbbrPair["state"];
    }

    // Populate cases, deaths, and constants
    for (var i = 0; i < casesCsv.length; i++) {
        const stateId = casesCsv[i]["stateFIPS"];

        if (!(stateId in baseData)) {
            baseData[stateId] = {
                id: stateId,
                name: stateNames[casesCsv[i]["State"]],
                population: 0,
                cases: Array.from(Array(allDates.length), () => 0),
                deaths: Array.from(Array(allDates.length), () => 0),
                newCases: Array.from(Array(allDates.length), () => 0),
                newDeaths: Array.from(Array(allDates.length), () => 0)
            };
        }

        const currentState = baseData[stateId];
        currentState.population += parseInt(populationCsv[i]["population"]);

        for (var j = 0; j < allDates.length; j++) {
            dateStr = allDates[j];
            currentState.cases[j] += parseInt(casesCsv[i][dateStr]);
            currentState.deaths[j] += parseInt(deathsCsv[i][dateStr]);
        }
    }

    // Populate newcases and newdeaths
    for (const covidData of Object.values(baseData)) {
        covidData.newCases[0] = covidData.cases[0];
        covidData.newDeaths[0] = covidData.deaths[0];

        for (var j = 1; j < allDates.length; j++) {
            covidData.newCases[j] = covidData.cases[j] - covidData.cases[j - 1];
            covidData.newDeaths[j] = covidData.deaths[j] - covidData.deaths[j - 1];
        }
    }

    return baseData;
}

// Set properties.id and properties.name for every region
function preprocessWorldMap(geomapFeatures) {
    for (const d of geomapFeatures) {
        d.properties.id = d.properties["ISO_A2"];
        d.properties.name = d.properties["ADMIN"];
    }
}

// return list of date strings extracted from CSV headers
function getDateListFromWorldData(rawData) {
    const datesSet = new Set();

    for (const row of rawData) {
        datesSet.add(row["Date_reported"]);
    }

    const allDates = Array.from(datesSet);
    allDates.sort();
    return allDates;
}

// Convert raw world data to new format.
// rawData: list of objects containing {date, countryId, country, WHO region, new cases, cases, new deaths, deaths}
// rawPopulationData: list of objects containig {country, countryId, population}
// allDates: list of date strings from CSV headers
// returns map of location ID -> CovidData object for each location (see CovidData in ast.ts)
function preprocessWorldData(rawData, rawPopulationData, allDates) {
    const baseData = {};

    // Invert allDates (map date string -> index)
    const allDatesInv = {};
    for (var i = 0; i < allDates.length; i++) {
        allDatesInv[allDates[i]] = i;
    }

    for (const row of rawData) {
        // If baseData doesn't contain Country_code as a key, add it and initialize arrays
        // TODO: set population
        const countryCode = row[" Country_code"];
        if (!(countryCode in baseData)) {
            baseData[countryCode] = {
                id: countryCode,
                name: row[" Country"],
                cases: Array.from(Array(allDates.length), () => 0),
                deaths: Array.from(Array(allDates.length), () => 0),
                newCases: Array.from(Array(allDates.length), () => 0),
                newDeaths: Array.from(Array(allDates.length), () => 0)
            };
        }

        // Set date-specific properties
        const covidData = baseData[countryCode];
        const dateIndex = allDatesInv[row["Date_reported"]];
        covidData.cases[dateIndex] = parseInt(row[" Cumulative_cases"]);
        covidData.deaths[dateIndex] = parseInt(row[" Cumulative_deaths"]);
        covidData.newCases[dateIndex] = parseInt(row[" New_cases"]);
        covidData.newDeaths[dateIndex] = parseInt(row[" New_deaths"]);
    }

    setPopulationData(baseData, rawPopulationData);

    return baseData;
}

function setPopulationData(baseData, rawPopulationData) {
    for (const populationRow of rawPopulationData) {
        const countryCode = populationRow["Country Code"];
        const population = parseInt(populationRow["Population"]);

        if (countryCode in baseData) {
            baseData[countryCode].population = population;
        }
    }
}

function getWhoRegionsMap(rawWorldData) {
    const whoRegions = {};

    for (const row of rawWorldData) {
        const countryId = row[" Country_code"];
        const whoRegion = row[" WHO_region"];

        if (!(whoRegion in whoRegions)) {
            whoRegions[countryId] = whoRegion;
        }
    }

    return whoRegions;
}

// Compute the dates x locations matrix using the AST to evaluate.
function computeCustomData(baseData, ast) {
    const geoIdToValueDictList = [];

    // Initialize each index with an empty object
    for (const covidData of Object.values(baseData)) {
        for (var i = 0; i < covidData.cases.length; i++) {
            geoIdToValueDictList.push({});
        }
        break;
    }

    // Populate data
    for (const covidData of Object.values(baseData)) {
        for (var i = 0; i < covidData.cases.length; i++) {
            geoIdToValueDictList[i][covidData.id] = ast.evaluate(covidData, i);
        }
    }

    return geoIdToValueDictList;
}

// Compute the dates x locations matrix using the AST to evaluate.
function computeCustomTimeData(allLocationsallData, locationId, dates) {
    const singleLocData = [];
    var maxValue = allLocationsallData[0][locationId];
    for (var i = 0; i < allLocationsallData.length; i++) {
        var processsedDate = new Date(processDate(dates[i])[0],
                                      processDate(dates[i])[1],
                                      processDate(dates[i])[2]);
        singleLocData.push({date: processsedDate, value: allLocationsallData[i][locationId]})
        if (allLocationsallData[i][locationId] > maxValue) {
            maxValue = allLocationsallData[i][locationId];
        }
    }
    return [singleLocData, maxValue];
}

// Percentiles come from entire customData matrix, not just one row or column.
// customData: dates x locations matrix
// percentiles: list of percentiles to get (0 to 100)
function getPercentiles(customData, percentiles) {
    const allValues = [];
    for (const geoIdToValueDict of customData) {
        for (const value of Object.values(geoIdToValueDict)) {
            if (!isNaN(value) && isFinite(value)) {
                allValues.push(value);
            }
        }
    }

    allValues.sort((a, b) => a < b ? -1 : 1);

    const percentileValues = [];
    for (const percentile of percentiles) {
        if (percentile >= 100) {
            percentileValues.push(allValues[allValues.length - 1]);
        } else if (percentile < 0) {
            percentileValues.push(allValues[0]);
        } else {
            percentileValues.push(allValues[Math.floor(percentile * allValues.length / 100)]);
        }
    }

    return percentileValues;
}

// Makes it so hovering works properly
function moveSelectionsToBackOrFront() {
    //Moves selction to front
    d3.selection.prototype.moveToFront = function() {
        return this.each(function(){
            this.parentNode.appendChild(this);
        });
    }; 

    //Moves selction to back
    d3.selection.prototype.moveToBack = function() { 
        return this.each(function() { 
        const firstChild = this.parentNode.firstChild; 
        if (firstChild) { 
            this.parentNode.insertBefore(this, firstChild); 
        } 
        }); 
    };
}

function randStrGen() {
    return (Math.random() + "").substring(2);
}

function showWorldMap(whoRegion) {
    path.projection(d3.geoRobinson());

    hideSphere();
    d3.selectAll(".viewtype").style("visibility", "visible");
    d3.select("#viewtype").property("value", "worldflat");

    Promise.all([
        d3.json("./data/countries.json"),
        d3.csv("https://cors-anywhere.herokuapp.com/https://covid19.who.int/WHO-COVID-19-global-data.csv?" + randStrGen()),
        d3.csv("./data/world-bank-population-isoa2.csv")
    ]).then(function (data) {
        const geomap = data[0];
        const rawData = data[1];
        const rawPopulationData = data[2];

        const allDates = getDateListFromWorldData(rawData);
        const baseData = preprocessWorldData(rawData, rawPopulationData, allDates);
        var geomapFeatures = geomap.features;
        preprocessWorldMap(geomapFeatures);

        if (whoRegion) {
            const whoRegions = getWhoRegionsMap(rawData);
            geomapFeatures = geomapFeatures.filter(f => whoRegions[f.properties.id] === whoRegion);
        }

        dataLoaded(geomapFeatures, allDates, baseData);
    });
}

function showUsaCounties() {
    path.projection(d3.geoAlbersUsa());

    hideSphere();
    d3.selectAll(".viewtype").style("visibility", "hidden");

    Promise.all([
        d3.json("./data/us.json"),
        d3.csv("https://cors-anywhere.herokuapp.com/https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv?" + randStrGen()),
        d3.csv("https://cors-anywhere.herokuapp.com/https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv?" + randStrGen()),
        d3.csv("https://cors-anywhere.herokuapp.com/https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_county_population_usafacts.csv?" + randStrGen())
    ]).then(function (data) {
        const geomap = data[0];
        const casesCsv = data[1];
        const deathsCsv = data[2];
        const populationCsv = data[3];

        const allDates = getDateListFromUsaData(casesCsv);
        const baseData = preprocessUsaData(casesCsv, deathsCsv, populationCsv, allDates);
        const geomapFeatures = topojson.feature(geomap, geomap.objects.counties).features;
        preprocessUsaMap(geomapFeatures, baseData);

        dataLoaded(geomapFeatures, allDates, baseData);
    });
}

function showUsaStates() {
    path.projection(d3.geoAlbersUsa());

    hideSphere();
    d3.selectAll(".viewtype").style("visibility", "hidden");

    Promise.all([
        d3.json("./data/us.json"),
        d3.csv("./data/state_abbrs.csv"),
        d3.csv("https://cors-anywhere.herokuapp.com/https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv?" + randStrGen()),
        d3.csv("https://cors-anywhere.herokuapp.com/https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv?" + randStrGen()),
        d3.csv("https://cors-anywhere.herokuapp.com/https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_county_population_usafacts.csv?" + randStrGen())
    ]).then(function (data) {
        const geomap = data[0];
        const stateAbbrsCsv = data[1];
        const casesCsv = data[2];
        const deathsCsv = data[3];
        const populationCsv = data[4];

        const allDates = getDateListFromUsaData(casesCsv);
        const baseData = preprocessUsaStatesData(casesCsv, deathsCsv, populationCsv, stateAbbrsCsv, allDates);
        const geomapFeatures = topojson.feature(geomap, geomap.objects.states).features;
        preprocessUsaMap(geomapFeatures, baseData);

        dataLoaded(geomapFeatures, allDates, baseData);
    });
}

function set3dProjection(rotation, scale) {
    const projection = d3.geoSatellite()
        .rotate(rotation);

    path.projection(projection);

    showSphere();

    svg.call(zoom.transform, d3.zoomIdentity);
    svg.call(zoom.scaleTo, scale / 432.147);

    mapg.selectAll("path.geofeatures")
        .attr("d", path);
}

function setFlatProjection() {
    const projection = d3.geoRobinson();

    path.projection(projection);

    hideSphere();

    svg.call(zoom.transform, d3.zoomIdentity);
    mapg.selectAll("path.geofeatures")
        .attr("d", path);
}

function hideSphere() {
    d3.select(".sphereoutline")
        .style("visibility", "hidden");
}

function showSphere() {
    d3.select(".sphereoutline")
        .attr("d", path({ type: "Sphere" }))
        .style("fill", "none")
        .style("stroke", "black")
        .style("stroke-width", 1)
        .style("visibility", "visible");
}

// Respond to event where user changes map type.
function updateMapType(mapType) {
    if (mapType === "worldflat") {
        showWorldMap();
    } else if (mapType === "usacounties") {
        showUsaCounties();
    } else if (mapType === "usastates") {
        showUsaStates();
    }
    d3.select("#timechart").selectAll("*").remove();
}

function updateViewType(viewType) {
    if (viewType === "worldflat") {
        setFlatProjection();
    } else if (viewType === "northam") {
        set3dProjection([92, -50], 525);
    } else if (viewType === "carib") {
        set3dProjection([85, -27], 1150);
    } else if (viewType === "southam") {
        set3dProjection([59, 15], 550);
    } else if (viewType === "wafrica") {
        set3dProjection([-4, -22], 800);
    } else if (viewType === "safrica") {
        set3dProjection([-28, 8], 800);
    } else if (viewType === "europe") {
        set3dProjection([-15, -58], 850);
    } else if (viewType === "swasia") {
        set3dProjection([-42, -30], 900);
    } else if (viewType === "seasia") {
        set3dProjection([-87, -24], 850);
    } else if (viewType === "easia") {
        set3dProjection([-118, -40], 850);
    } else if (viewType === "wpac") {
        set3dProjection([-140, 11], 550);
    }
}

var slideValue = 0; // The value of the slider
// Set the min and max values of the slider and subscribe to changed events.
function resetSlider(allDates) {
    const slider = d3.select("#dateslider")
        .attr("min", 0)
        .attr("max", allDates.length - 1)
        .attr("step", 1)
        .attr("value", allDates.length - 1);

    // Set date text
    slideValue = allDates.length - 1;
    const latestDate = allDates[slideValue];
    d3.select("#datetext").text("Date: " + latestDate);

    // Set slider value
    slider.property('value', slideValue);

    // Updates slider
    slider.on("input", function() { updateSlider(allDates, this.value); });

    return slider;
}

// Respond to user changing the slider.
function updateSlider(allDates, dateIndex) {
    slideValue = dateIndex;
    const slideDate = allDates[slideValue];
    d3.select("#datetext")
        .text("Date: " + slideDate);
}

// Create blank map from geographical data.
function resetGeoMap(geomapFeatures) {
    // clear map
    svg.selectAll("g.top5").remove();
    svg.selectAll("g.top5Toggle").remove();
    svg.call(zoom.transform, d3.zoomIdentity);
    svg.selectAll(".geofeatures").remove();
    
    const data = svg.select("g.mapg")
        .selectAll("path.geofeatures")
        .data(geomapFeatures)
        .enter().append("path")
        .attr("class", "geofeatures")
        .attr("id", d => "region_" + d.properties.id)
        .attr("d", path)
        .style("fill", lowColor)
        .on("mouseover", function(d) {
            const sel = d3.select(this);
            sel.moveToFront();
            d3.select(this)
                .transition().duration(300)
                .style("stroke", "black")
                .style("stroke-width", 2);
            tooltipDiv.transition().duration(300)
                .style("opacity", 1);
            tooltipDiv
                .text(d.properties.name)
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY -30) + "px");
        })
        .on("mouseout", function() {
            const sel = d3.select(this);
            sel.moveToBack();
            d3.select(this)
                .transition().duration(300)
                .style("stroke", "white")
                .style("stroke-width", 1);
            tooltipDiv.transition().duration(300)
                .style("opacity", 0);
        });
}

// world map: stored as YYYY-MM-DD
// us maps: stored as M or MM/DD/YY
// due to broswer inconsistencies we want to output [YYYY, MM, DD]
// where MM ranges from 0 to 11 and all values should be integers, not strings
function processDate(date) {
    if (d3.select("#mapoptions").node().value === "worldflat") {
        return [parseInt(date.substring(0, 4)), 
                parseInt(date.substring(5, 7)) - 1, 
                parseInt(date.substring(8))];
    } else {
        var firstSlash = date.indexOf("/");
        var lastSlash = date.lastIndexOf("/");
        var year = parseInt("20" + date.substring(lastSlash + 1));
        var month = parseInt(date.substring(0, firstSlash)) - 1;
        var day = date.substring(firstSlash + 1, lastSlash);
        return [year, month, day];
    }
}

function updateTimeChart(allDatesAllLocations, color, dates, inputText, d, names) {
    d3.select("#timechart").selectAll("*").remove();

    // compute appropriate data for this location
    const timeGraphData = computeCustomTimeData(allDatesAllLocations, d.properties.id, dates);
    const maxValue = timeGraphData[1];
    const timeValueObjects = timeGraphData[0];

    // set margins
    var margin = {top: 20, right: 75, bottom: 50, left: 75};
    var vizWidth = width - margin.left - margin.right;
    var vizHeight = height - margin.top - margin.bottom;

    var xstart = margin.top + vizHeight;
    // axis scales

    var xScale = d3.scaleTime()
        .domain([new Date(processDate(dates[0])[0],
                          processDate(dates[0])[1],
                          processDate(dates[0])[2]), 
                new Date(processDate(dates[dates.length-1])[0],
                         processDate(dates[dates.length-1])[1],
                         processDate(dates[dates.length-1])[2])
                ])
        .range([ 0, vizWidth ]);

    var yScale = d3.scaleLinear()
        .domain([0, 1.2*maxValue])
        .range([vizHeight, 0]);


    // line generator
    var line = d3.line()
        .x(function(data) { 
            return xScale(data.date);
        })
        .y(function(data) { 
            return yScale(data.value); 
        })
    
    var svg = d3.select("#timechart").append("svg")
        .attr("width", vizWidth + margin.left + margin.right)
        .attr("height", vizHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    svg.append("g")
        .attr("transform", "translate(0," + xstart + ")")
        .attr("class", "x axis")
        .call(d3.axisBottom(xScale));
    svg.append("g")
        .attr("class", "y axis")
        .attr("transform", "translate(0," + margin.top + ")")
        .call(d3.axisLeft(yScale));

    var titleText = inputText + " in " + d.properties.name;
    svg.append("text")
        .attr("x", 0)
        .attr("y", 10)
        .text(titleText)
        .append("g")

    svg.append("path")
        .datum(timeValueObjects)
        .attr("class", "line")
        .attr("d", line)
        .attr("transform", "translate(0," + margin.top + ")")

    // reference: https://www.d3-graph-gallery.com/graph/line_cursor.html
    var bisect = d3.bisector(function(data) { return data.date; }).left;
    var focus = svg
        .append('g')
        .append('circle')
        .style("fill", "none")
        .attr("stroke", "black")
        .attr('r', 4)
        .attr("id", "focus")
        .attr("opacity", 0);

    var focusText = svg
        .append('g')
        .append('text')
            .style("opacity", 0)
            .attr("text-anchor", "left")
            .attr("alignment-baseline", "middle")
            .attr("id", "focusText");

    svg.append('rect')
        .style("fill", "none")
        .style("pointer-events", "all")
        .attr('width', width)
        .attr('height', height)
        //.on('mouseover', mouseover)
        .on('mousemove', mousemove)
        .on('mouseout', mouseout);
    
    function mouseover() {
        focus.style("opacity", 1);
        focusText.style("opacity", 1);
    }

    function mouseout() {
        focus.style("opacity", 0)
        focusText.style("opacity", 0)
    }

    function updateFocus(data) {
        if (data) {
            focus
                .attr("cx", xScale(data.date))
                .attr("cy", yScale(data.value) + 20);
            focusText
                .html(data.value)
                .attr("x", xScale(data.date))
                .attr("y", yScale(data.value));
        };
    }

    function mousemove() {
        var x0 = xScale.invert(d3.mouse(this)[0])
        var i = bisect(timeValueObjects, x0, 1);
        var selectedData = timeValueObjects[i];
        updateFocus(selectedData);
        if (selectedData) {
            mouseover();
            updateSlider(dates, i);
            var slider = d3.select("#dateslider");
            slider.property('value', i);
            updateGeoMap(allDatesAllLocations, color, i, dates, inputText, names);
            updateTop5(allDatesAllLocations[i], names);
        }
        else {
            mouseout();
        }
    }
    var slider = d3.select("#dateslider");
    slider.on("input", function() {
        mouseover();
        var index = this.value;
        var selectedData = timeValueObjects[index];
        updateFocus(selectedData);
        updateSlider(dates, index);
        updateGeoMap(allDatesAllLocations, color, index, dates, inputText, names);
        updateTop5(allDatesAllLocations[index], names);
    });

}

// Color map using data.
// locationValues: map geo id -> value
// color: d3 coloring function
function updateGeoMap(allDatesAllLocations, color, slideValue, dates, inputText, names) {
    const locationValues = allDatesAllLocations[slideValue];
    svg.selectAll(".geofeatures")
        .style ( "fill" , function (d) {
            return color(locationValues[d.properties.id]);
        })
        .on("mouseover", function(d) {
            const sel = d3.select(this);
            sel.moveToFront();
            d3.select(this)
                .transition().duration(300)
                .style("stroke", "black")
                .style("stroke-width", 2);
            tooltipDiv.transition().duration(300)
                .style("opacity", 1);
            tooltipDiv
                .text(d.properties.name + ": " + locationValues[d.properties.id])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY -30) + "px")
        })
        .on("click", function(d) {
            // TODO only allow graph to display if you've entered an expression!
            updateTimeChart(allDatesAllLocations, color, dates, inputText, d, names);
        })
}

function updateTop5(locationValues, names) {
    top5 = true;
    var i = 0;
    var nameValuePairs = [];
    Object.keys(locationValues).map((key) => {
        if(!isNaN(locationValues[key])){
            nameValuePairs.push([(names.find(loc => loc.id === (key))).name, locationValues[key]]) // Store name of location with result in array
        }else {
        }
    });

    nameValuePairs.sort(function (a,b){
        return a[1] - b[1]
    });
    nameValuePairs = nameValuePairs.slice(Math.max(nameValuePairs.length - 5, 0)).reverse(); // Get top 5

    svg.select(".top5Text").text('Top 5:');
    var xVal = 40;
    var yVal = 360;
    nameValuePairs.forEach((pair) =>{
        svg.select(".text"+yVal)
            .text(pair[0]+": "+pair[1])
            .style("font-size", "15px")
            .attr("alignment-baseline","middle");
        yVal = yVal + 20;
    });

    if(showTop5 === false){
        svg.select(".top5")
            .style("opacity", 0);
    }
}

function createLegend() {
    const defs = legendsvg.append("defs");
    
    const linearGradient = defs.append("linearGradient")
        .attr("id", "linear-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");
    
    linearGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", lowColor);
    
    linearGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", highColor);
    
    const legend = legendsvg.append("g")
        .attr("class", "legend");

    const gradientHeight = 20;

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", gradientHeight)
        .style("fill", "url(#linear-gradient)")
        .style("opacity", 0.8);

    const foreignObjHeight = 20;
    const foreignObjY = gradientHeight + 5;
    const foreignObjWidth = width / 2;

    legend.append("foreignObject")
            .attr("x", 0)
            .attr("y", foreignObjY)
            .attr("width", foreignObjWidth)
            .attr("height", foreignObjHeight)
        .append("xhtml:div")
            .attr("contenteditable", true)
            .attr("class", "legendmin")
            .style("float", "left");

    legend.append("foreignObject")
            .attr("x", width - foreignObjWidth)
            .attr("y", foreignObjY)
            .attr("width", foreignObjWidth)
            .attr("height", foreignObjHeight)
            .attr("text-anchor", "end")
        .append("xhtml:div")
            .attr("contenteditable", true)
            .attr("class", "legendmax")
            .style("float", "right");
}

function updateLegendLimits(domain) {
    d3.select(".legendmin")
        .text(domain[0]);

    d3.select(".legendmax")
        .text(domain[1]);
}

// Responds to event where user changes the legend.
// event: d3.event
// isMin: true if editing minimum, false if editing maximum
// color: d3.color for map. Domain is modified by this function.
// Returns whether legend domain was successfully updated.
function userChangesLegend(text, isMin, color) {
    var domain = color.domain();
    if (!isNaN(text)) {
        var newMin;
        var newMax;
        if (isMin) {
            newMin = parseFloat(text);
            newMax = domain[1];
        } else {
            newMin = domain[0];
            newMax = parseFloat(text);
        }

        // Don't change domain if max <= min
        if (newMax > newMin) {
            domain = [newMin, newMax];

            color.domain(domain);

            successfulChange = true;
        }
    }

    if (isMin) {
        d3.select(".legendmin").text(domain[0]);
    } else {
        d3.select(".legendmax").text(domain[1]);
    }

    return successfulChange;
}

function loadDocs() {
    $.getJSON('../../clientresources.json', function(data) {
        docs = data.docs;
        options = Object.keys(docs);
    });
}

function closeAutocomplete() {
    d3.select("#autocomplete-list")
        .selectAll("div")
        .data([])
        .exit().remove();
}

document.addEventListener("click", function() {
    closeAutocomplete();
});

function autocomplete() {
    const input = d3.select("#expressioninput");
    const inputValue = input.node().value;

    const starter = Math.max(
        0, 
        inputValue.lastIndexOf("(") + 1, 
        inputValue.lastIndexOf(" ") + 1, 
        inputValue.lastIndexOf("+") + 1,
        inputValue.lastIndexOf("*") + 1,
        inputValue.lastIndexOf("/") + 1,
        inputValue.lastIndexOf("-") + 1
    );

    const currentWord = inputValue.substring(starter);

    const filteredList = currentWord.length > 0
        ? Object.keys(docs).filter(k => k.length > currentWord.length && k.substr(0, currentWord.length) === currentWord)
        : [];

    const autocompleteList = d3.select("#autocomplete-list")
        .selectAll("div")
        .data(filteredList);

    const newDivs = autocompleteList.enter().append("div");
    newDivs.append("strong").text(d => d + ": ");
    newDivs.append("span").text(d => docs[d]);
    
    newDivs.on("click", function(d) {
        const newInputValue = inputValue.substring(0, starter) + d;
        closeAutocomplete();

        try {
            ast = peg$parse(newInputValue);
            d3.select("#parseroutput")
                        .text("Valid expression. Press enter to use.")
                        .style("color", "black");
        } catch (err) {
            d3.select("#parseroutput")
                .text(err)
                .style("color", "darkred");
        }

        input.node().value = newInputValue;
        input.node().focus();
    });

    autocompleteList.exit().remove();

    autocompleteList.select("strong").text(d => d + ": ");
    autocompleteList.select("span").text(d => docs[d]);
}

function createTop5() {
    const top5 = svg.append("g")
        .attr("class", "top5")
        .attr("id", "top5Id");

    var xValTop5 = 40;
    var yValTop5 = 360;
    top5.append("text").attr("class", "top5Text").attr("x", xValTop5).attr("y", yValTop5 - 20)
    for (let i = 0; i < 5; i++) {
        top5.append("text").attr("class", "text"+yValTop5).attr("x", xValTop5).attr("y", yValTop5);
        yValTop5 = yValTop5 + 20;
    }
}

function updateTop5Toggle(value) {
    showTop5 = showTop5 ? false : true;
    var show = showTop5 ? 1 : 0;
    svg.select(".top5")
        .style("opacity", show);
}

// Called when data is initially loaded.
function dataLoaded(geomapFeatures, allDates, baseData) {
    const slider = resetSlider(allDates);
    resetGeoMap(geomapFeatures);
    top5 = false;

    createTop5();
    inputExp = '';

    // Updates to expression textbox
    function updateExpressionInput(inputText, refreshMap) {
        if (inputText === "") {
            d3.select("#parseroutput")
                .text("Enter an expression.")
                .style("color", "black");
        }

        // auto-complete suggestions here
        // autocomplete(document.getElementById("expressioninput"), options);
        autocomplete();
        
        var ast;
        try {
            ast = peg$parse(inputText);
        } catch (err) {
            d3.select("#parseroutput")
                .text(err)
                .style("color", "darkred");
        }

        if (ast != undefined) {
            if (refreshMap) {
                var customData;
                try {
                    customData = computeCustomData(baseData, ast);
                } catch (err) {
                    d3.select("#parseroutput")
                        .text(err)
                        .style("color", "darkred");
                    console.error(err);
                }

                if (customData != undefined) {
                    const domain = getPercentiles(customData, [1, 99]);
                    const color = d3.scaleLinear()
                        .domain(domain)
                        .range([lowColor, highColor])
                        .clamp(true)
                        .unknown(lowColor);

                    // Get names for top5 list along with ID
                    var names = [];
                    for (const [key, value] of Object.entries(baseData)) {
                        names.push({
                            "id": value.id,
                            "name": value.name
                        });
                    }

                    d3.select("#timechart").selectAll("*").remove();

                    inputExp = inputText;
                    updateLegendLimits(domain);
                    updateGeoMap(customData, color, slideValue, allDates, inputText, names);
                    updateTop5(customData[slideValue], names);

                    // Updates slider
                    slider.on("input", function() {
                        updateSlider(allDates, this.value);
                        updateGeoMap(customData, color, slideValue, allDates, inputText, names);
                        updateTop5(customData[slideValue], names);
                    });

                    // Updates legend minimum value
                    d3.select(".legendmin")
                        .on("keydown", () => {
                            if (d3.event.keyCode === 13) {
                                d3.event.preventDefault();
                                if (userChangesLegend(d3.event.target.textContent, true, color)) {
                                    updateGeoMap(customData, color, slideValue, allDates, inputText, names);
                                }
                            }
                        })
                        .on("blur", () => {
                            if (userChangesLegend(d3.event.target.textContent, true, color)) {
                                updateGeoMap(customData, color, slideValue, allDates, inputText, names);
                            }
                        });

                    // Updates legend maximum value
                    d3.select(".legendmax")
                        .on("keydown", () => {
                            if (d3.event.keyCode === 13) {
                                d3.event.preventDefault();
                                if (userChangesLegend(d3.event.target.textContent, false, color)) {
                                    updateGeoMap(customData, color, slideValue, allDates, inputText, names);
                                }
                            }
                        }).on("blur", () => {
                            if (userChangesLegend(d3.event.target.textContent, false, color)) {
                                updateGeoMap(customData, color, slideValue, allDates, inputText, names);
                            }
                        });
        
                    d3.select("#parseroutput")
                        .text("Entered.")
                        .style("color", "black");
                }
            } else {
                d3.select("#parseroutput")
                    .text("Valid expression. Press enter to use.")
                    .style("color", "black");
            }
        }
    }
    
    const inputElement = d3.select("#expressioninput");
    var inputTimeout = null;
    inputElement.on("keyup", function () {
        if (d3.event.keyCode !== 13) {
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => updateExpressionInput(this.value, false), 250);
        } else {
            updateExpressionInput(this.value, true);
        }
    });

    const startExpression = inputElement.node().value;
    inputElement.text(startExpression);
    updateExpressionInput(startExpression, true);

    // Suggestions clicked
    const dropdown = d3.select("#suggestions");
    dropdown.on("change", function () {
        const input = d3.select("#expressioninput");
        const expression = dropdown.node().value;
        input.node().value = expression;
        updateExpressionInput(expression, true);
    });
};

function loadSuggestions(){ 
    $.getJSON('../../clientresources.json', function(data) {
        var samples = data.expressions;
        for (var key in samples) {
            var dropdown = document.getElementById("suggestions");
            var option = document.createElement("OPTION");
            option.innerHTML = samples[key]["title"]
            option.value = samples[key]["expression"];
            dropdown.options.add(option);
        }
    });
}

function downloadAsPng() {
    var xValMapTitle = 10;
    var yValMapTitle = 15;

    var xValSources = 10;
    var yValSources = 5;

    const mapTitleFontSize = 20;

    mapTitleSvg.append("text")
        .attr("class", "mapTitle")
        .text(inputExp)
        .style("font-size", mapTitleFontSize)
        .attr("alignment-baseline","middle")
        .attr("x", xValMapTitle)
        .attr("y", yValMapTitle);

    mapTitleSvg.append("text")
        .attr("class", "mapTitle")
        .text(d3.select("#datetext").text())
        .style("font-size", mapTitleFontSize)
        .attr("alignment-baseline","middle")
        .attr("x", xValMapTitle)
        .attr("y", yValMapTitle + mapTitleFontSize);

    sourcesSvg.append("text")
        .attr("class", "sourcesText")
        .text(sources).style("font-size", "10px")
        .attr("alignment-baseline","middle")
        .attr("x", xValSources)
        .attr("y", yValSources);

    var svg = d3.select("svg").node(), //d3.select("svg")
        img1 = new Image(),
        serializer = new XMLSerializer(),
        svgStr = serializer.serializeToString(svg);

    var legend = d3.select("#legendcontainer").select("svg").node(),
        img2 = new Image(),
        legendStr = serializer.serializeToString(legend);

    var title = d3.select("#maptitlecontainer").select("svg").node(),
        img3 = new Image(),
        titleStr = serializer.serializeToString(title);

    mapTitleSvg.selectAll("text.mapTitle").remove();

    var source = d3.select("#sourcescontainer").select("svg").node(),
        img4 = new Image(),
        sourceStr = serializer.serializeToString(source);

    sourcesSvg.selectAll("text.sourcesText").remove();


    var data1 = 'data:image/svg+xml;base64,'+window.btoa(svgStr);
    var data2 = 'data:image/svg+xml;base64,'+window.btoa(legendStr);
    var data3 = 'data:image/svg+xml;base64,'+window.btoa(titleStr);
    var data4 = 'data:image/svg+xml;base64,'+window.btoa(sourceStr);

    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height+legendHeight+mapTitleHeight+sourcesHeight;
    context = canvas.getContext("2d");
    img1.src = data1;
    img2.src = data2;
    img3.src = data3;
    img4.src = data4;
    img1.onload = function() {
        context.drawImage(img1, 0, mapTitleHeight);
        context.drawImage(img2, 0, height+mapTitleHeight);
        context.drawImage(img3, 0, 0);
        context.drawImage(img4, 0, mapTitleHeight + height + legendHeight);
        var canvasdata = canvas.toDataURL("image/png");
        var pngimg = '<img src="'+canvasdata+'">';
        var a = document.createElement("a");
        a.download = "covid_data.png";
        a.href = canvasdata;
        a.click();
    };
}

function showDocumentation() {
    d3.json("./clientresources.json")
    .then(function (data) {
        const docs = getDocsList(data.docs);
        tabulate(docs, ['keyword', 'definition']);
    });
}

function tabulate(data, columns) {
    var table = d3.select('#doc').append('table')
    var thead = table.append('thead')
    var	tbody = table.append('tbody');

    // append the header row
    thead.append('tr')
    .selectAll('th')
    .data(columns).enter()
    .append('th')
        .text(function (column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll('tr')
    .data(data)
    .enter()
    .append('tr');

    // create a cell in each row for each column
    var cells = rows.selectAll('td')
    .data(function (row) {
        return columns.map(function (column) {
        return {column: column, value: row[column]};
        });
    })
    .enter()
    .append('td')
        .text(function (d) { return d.value; });
}

function getDocsList(data) {
    result = [];

    for (var key in data) {
        result.push({"keyword": key, "definition": data[key]});
    }

    return result;
}