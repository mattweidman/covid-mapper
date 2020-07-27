const width = 960, height = 600;
const lowColor = "#dcdcdc", highColor = "#8b0000";
 
const tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
 
const svg = d3.select("#mapcontainer").append("svg")
    .attr("width", width)
    .attr("height", height);

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

const path = d3.geo.path();

moveSelectionsToBackOrFront();

svg.append("g")
    .attr("class", "mapg");
createLegend();

// Show the map.
showWorldMap();

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

// Convert raw USA data to new format.
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

    queue()
        // .defer(d3.json, "./data/us.json")
        .defer(d3.json, "./data/countries.json")
        // .defer(d3.csv, "./data/covid_all.csv")
        .defer(d3.csv, "./data/WHO-COVID-19-global-data.csv")
        .defer(d3.csv, "./data/world-bank-population-isoa2.csv")
        .await((error, geomap, rawData, rawPopulationData) => {
            const allDates = getDateListFromWorldData(rawData);
            const baseData = preprocessWorldData(rawData, rawPopulationData, allDates);
            const geomapFeatures = geomap.features;
            preprocessWorldMap(geomapFeatures);
            dataLoaded(geomapFeatures, allDates, baseData);
        });
}

function showUsaCounties() {
    path.projection(d3.geo.albersUsa());

    queue()
        .defer(d3.json, "./data/us.json")
        .defer(d3.csv, "./data/covid_all.csv")
        .await((error, geomap, rawData) => {
            const allDates = getDateListFromUsaData(rawData);
            const baseData = preprocessUsaData(rawData, allDates);
            const geomapFeatures = topojson.feature(geomap, geomap.objects.counties).features;
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
    
    const data = svg.select("g.mapg")
        .selectAll("path")
        .data(geomapFeatures)
        .enter().append("path")
        .attr("d", path)
        .style("fill", lowColor)
        .style("opacity", 0.8)
        .on("mouseover", function(d) {
            const sel = d3.select(this);
            sel.moveToFront();
            d3.select(this).transition().duration(300).style({'opacity': 1, 'stroke': 'black', 'stroke-width': 1.5});
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
                .style({'opacity': 0.8, 'stroke': 'white', 'stroke-width': 1});
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
            d3.select(this).transition().duration(300).style({'opacity': 1, 'stroke': 'black', 'stroke-width': 1.5});
            tooltipDiv.transition().duration(300)
                .style("opacity", 1);
            tooltipDiv
                .text(d.properties.name + ":" + locationValues[d.properties.id])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY -30) + "px");
        });
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
                    const color = d3.scale.linear()
                        .domain(domain)
                        .range([lowColor, highColor])
                        .clamp(true);
    
                    updateLegendLimits(domain);
                    updateGeoMap(customData[slideValue], color);
                    
                    // Updates slider
                    slider.on("input", function() {
                        updateSlider(allDates, this.value);
                        updateGeoMap(customData[slideValue], color);
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