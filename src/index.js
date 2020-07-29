const width = 960, height = 600;
const lowColor = "#dcdcdc", highColor = "#8b0000";
 
const tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
 
const svg = d3.select("#mapcontainer").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background-color", 'white');

const defs = svg.append("defs");

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

const path = d3.geoPath();

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
createLegend();

d3.select("#mapoptions").on("change", (a, b, c) => {
    const optionSelected = d3.select("#mapoptions").node().value;
    updateMapType(optionSelected);
});

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
        if (key.startsWith("confirmed_")) {
            allDates.push(key.substring("confirmed_".length));
        }
    }
    return allDates;
}

// Convert raw USA data to new format with data separated by county.
// rawData: list of {CSV header -> value} dictionaries for location
// allDates: list of date strings from CSV headers
// returns map of location ID -> CovidData object for each location (see CovidData in ast.ts)
function preprocessUsaData(rawData, allDates) {
    const baseData = {};

    rawData.forEach(rawDatum => {

        const cases = [], deaths = [], newCases = [], newDeaths = [];
        allDates.forEach(dateStr => {
            cases.push(parseInt(rawDatum["confirmed_" + dateStr]));
            deaths.push(parseInt(rawDatum["deaths_" + dateStr]));
            newCases.push(parseInt(rawDatum["newconfirmed_" + dateStr]));
            newDeaths.push(parseInt(rawDatum["newdeaths_" + dateStr]));
        });

        const newDatum = {
            id: rawDatum["countyFIPS"],
            name: rawDatum["County Name"],
            population: rawDatum["population"],
            cases: cases,
            deaths: deaths,
            newCases: newCases,
            newDeaths: newDeaths
        };

        baseData[newDatum.id] = newDatum;
    });

    return baseData;
}

// Convert raw USA data to new format with data separated by state.
// rawData: list of {CSV header -> value} dictionaries for location
// allDates: list of date strings from CSV headers
// returns map of location ID -> CovidData object for each location (see CovidData in ast.ts)
function preprocessUsaStatesData(rawData, allDates) {
    const baseData = {};

    rawData.forEach(rawDatum => {
        const stateId = rawDatum["stateFIPS"];

        if (!(stateId in baseData)) {
            baseData[stateId] = {
                id: stateId,
                name: rawDatum["stateName"],
                population: 0,
                cases: Array.from(Array(allDates.length), () => 0),
                deaths: Array.from(Array(allDates.length), () => 0),
                newCases: Array.from(Array(allDates.length), () => 0),
                newDeaths: Array.from(Array(allDates.length), () => 0)
            };
        }

        const currentState = baseData[stateId];
        currentState.population += parseInt(rawDatum["population"]);

        for (var i = 0; i < allDates.length; i++) {
            dateStr = allDates[i];
            currentState.cases[i] += parseInt(rawDatum["confirmed_" + dateStr]);
            currentState.deaths[i] += parseInt(rawDatum["deaths_" + dateStr]);
            currentState.newCases[i] += parseInt(rawDatum["newconfirmed_" + dateStr]);
            currentState.newDeaths[i] += parseInt(rawDatum["newdeaths_" + dateStr]);
        }
    });

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

// Percentiles come from entire customData matrix, not just one row or column.
// customData: dates x locations matrix
// percentiles: list of percentiles to get (0 to 100)
function getPercentiles(customData, percentiles) {
    const allValues = [];
    for (const geoIdToValueDict of customData) {
        for (const value of Object.values(geoIdToValueDict)) {
            if (!isNaN(value)) {
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

function showWorldMap() {
    path.projection(d3.geoRobinson());

    Promise.all([
        d3.json("./data/countries.json"),
        d3.csv("./data/WHO-COVID-19-global-data.csv"),
        d3.csv("./data/world-bank-population-isoa2.csv")
    ]).then(function (data) {
        const geomap = data[0];
        const rawData = data[1];
        const rawPopulationData = data[2];

        const allDates = getDateListFromWorldData(rawData);
        const baseData = preprocessWorldData(rawData, rawPopulationData, allDates);
        const geomapFeatures = geomap.features;
        preprocessWorldMap(geomapFeatures);

        dataLoaded(geomapFeatures, allDates, baseData);
    });
}

function showUsaCounties() {
    path.projection(d3.geoAlbersUsa());

    Promise.all([
        d3.json("./data/us.json"),
        d3.csv("./data/covid_usa.csv")
    ]).then(function (data) {
        const geomap = data[0];
        const rawData = data[1];

        const allDates = getDateListFromUsaData(rawData);
        const baseData = preprocessUsaData(rawData, allDates);
        const geomapFeatures = topojson.feature(geomap, geomap.objects.counties).features;
        preprocessUsaMap(geomapFeatures, baseData);

        dataLoaded(geomapFeatures, allDates, baseData);
    });
}

function showUsaStates() {
    path.projection(d3.geoAlbersUsa());

    Promise.all([
        d3.json("./data/us.json"),
        d3.csv("./data/covid_usa.csv")
    ]).then(function (data) {
        const geomap = data[0];
        const rawData = data[1];

        const allDates = getDateListFromUsaData(rawData);
        const baseData = preprocessUsaStatesData(rawData, allDates);
        const geomapFeatures = topojson.feature(geomap, geomap.objects.states).features;
        preprocessUsaMap(geomapFeatures, baseData);

        dataLoaded(geomapFeatures, allDates, baseData);
    });
}

// Respond to event where user changes map type.
function updateMapType(mapType) {
    if (mapType === "worldcountries") {
        showWorldMap();
    } else if (mapType === "usacounties") {
        showUsaCounties();
    } else if (mapType === "usastates") {
        showUsaStates();
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
    svg.selectAll("g.mapg > path").remove();
    svg.selectAll("g.top5").remove();
    svg.selectAll("g.title").remove();
    
    const data = svg.select("g.mapg")
        .selectAll("path")
        .data(geomapFeatures)
        .enter().append("path")
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

// Color map using data.
// locationValues: map geo id -> value
// color: d3 coloring function
function updateGeoMap(locationValues, color) {
    svg.selectAll(".mapg path")
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
                .text(d.properties.name + ":" + locationValues[d.properties.id])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY -30) + "px");
        });
}

function updateTop5(locationValues, names) {
    var i = 0;
    var locArray = Object.keys(locationValues).map((key) => {
        return [(names.find(loc => loc.id === (key))).name, locationValues[key]] // Store name of location with result in array
    });

    locArray.sort(function (a,b){return a[1] - b[1]});
    locArray = locArray.slice(Math.max(locArray.length - 5, 0)).reverse(); // Get top 5

    svg.select(".top5Text").text('Top 5:');
    var xVal = 40;
    var yVal = 360;
    locArray.map((loc) => {
        svg.select(".text"+yVal).text(loc[0]+": "+loc[1]).style("font-size", "15px").attr("alignment-baseline","middle");
        yVal = yVal + 20;
    })
}

function createLegend() {
    const legend = svg.append("g")
        .attr("class", "legend");

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 550)
        .attr("width", width)
        .attr("height", 20)
        .style("fill", "url(#linear-gradient)")
        .style("opacity", 0.8);

    legend.append("text")
        .attr("class", "legendmin")
        .attr("x", 0)
        .attr("y", 590);

    legend.append("text")
        .attr("class", "legendmax")
        .attr("x", width)
        .attr("y", 590)
        .attr("text-anchor", "end");
}

function updateLegendLimits(domain) {
    svg.select(".legendmin")
        .text(domain[0]);

    svg.select(".legendmax")
        .text(domain[1]);
}

// Called when data is initially loaded.
function dataLoaded(geomapFeatures, allDates, baseData) {
    const slider = resetSlider(allDates);
    resetGeoMap(geomapFeatures);

    const top5 = svg.append("g")
        .attr("class", "top5");

    var xValTop5 = 40;
    var yValTop5 = 360;
    top5.append("text").attr("class", "top5Text").attr("x", xValTop5).attr("y", yValTop5 - 20)
    for (let i = 0; i < 5; i++) {
        top5.append("text").attr("class", "text"+yValTop5).attr("x", xValTop5).attr("y", yValTop5);
        yValTop5 = yValTop5 + 20;
    }

    const title = svg.append("g")
        .attr("class", "title");

    var xValTitle = 480;
    var yValTitle = 15;
    title.append("text").attr("class", "titleText").attr("x", xValTitle).attr("y", yValTitle);

    // Updates to expression textbox
    function updateExpressionInput(inputText) {
        if (inputText === "") {
            d3.select("#parseroutput")
                .text("Enter an expression.")
                .style("color", "black");
        }
        
        var ast;
        try {
            ast = peg$parse(inputText);
        } catch (err) {
            d3.select("#parseroutput")
                .text(err)
                .style("color", "darkred");
        }

        if (ast != undefined) {
            if (d3.event && d3.event.keyCode === 13) {
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

                    svg.select(".titleText").text(inputText).style("font-size", "30px").attr("alignment-baseline","middle");
    
                    updateLegendLimits(domain);
                    updateGeoMap(customData[slideValue], color);
                    updateTop5(customData[slideValue], names);

                    // Updates slider
                    slider.on("input", function() {
                        updateSlider(allDates, this.value);
                        updateGeoMap(customData[slideValue], color);
                        updateTop5(customData[slideValue], names);
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
    inputElement.on("keyup", function () { updateExpressionInput(this.value); });
    const defaultExpression = "cases(day)";
    inputElement.text(defaultExpression);
    updateExpressionInput(defaultExpression);
};

function downloadAsPng() {
    var svg = d3.select("svg").node(),
        img = new Image(),
        serializer = new XMLSerializer(),
        svgStr = serializer.serializeToString(svg);

    data = 'data:image/svg+xml;base64,'+window.btoa(svgStr);

    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    context = canvas.getContext("2d");
    img.src = data;
    img.onload = function() {
        context.drawImage(img, 0, 0);
        var canvasdata = canvas.toDataURL("image/png");
        var pngimg = '<img src="'+canvasdata+'">';
        var a = document.createElement("a");
        a.download = "covid_data.png";
        a.href = canvasdata;
        a.click();
    };
}
