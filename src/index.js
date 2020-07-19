const width = 960, height = 600;
const lowColor = "#dcdcdc", highColor = "#8b0000"
 
const tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
 
const svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("margin", "-15px auto");

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

queue()
    .defer(d3.json, "./data/us.json")
    .defer(d3.csv, "./data/covid_all.csv")
    .await(dataLoaded);

// return list of date strings extracted from CSV headers
function getDateList(rawData) {
    const allDates = [];
    for (const key in rawData[0]) {
        if (key.startsWith("confirmed_")) {
            allDates.push(key.substring("confirmed_".length));
        }
    }
    return allDates;
}

// Convert raw data to new format.
// rawData: list of {CSV header -> value} dictionaries for location
// allDates: list of date strings from CSV headers
// returns map of location ID -> CovidData object for each location (see CovidData in ast.ts)
function preprocess(rawData, allDates) {
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

function getLocationNameDict(baseData) {
    const locationNames = {};
    for (const key in baseData) {
        locationNames[key] = baseData[key].name;
    }
    return locationNames;
}

// Compute the dates x locations matrix using the AST to evaluate.
function computeCustomData(baseData, ast) {
    const geoIdToValueDictList = [];

    for (const covidData of Object.values(baseData)) {
        for (var i = 0; i < covidData.cases.length; i++) {
            if (geoIdToValueDictList[i] == undefined) {
                geoIdToValueDictList[i] = {};
            }

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
            allValues.push(value);
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

var slideValue = 0; // The value of the slider
function createSlider(allDates) {
    const slider = d3.select("#dateslider")
        .attr("min", 0)
        .attr("max", allDates.length - 1)
        .attr("step", 1)
        .attr("value", allDates.length - 1);

    // Set date text
    slideValue = allDates.length - 1;
    const latestDate = allDates[slideValue];
    d3.select("#datetext").text("Date: " + latestDate);

    // Updates slider
    slider.on("input", function() { updateSlider(allDates, this.value); });

    return slider;
}

function updateSlider(allDates, dateIndex) {
    slideValue = dateIndex;
    const slideDate = allDates[slideValue];
    d3.select("#datetext")
        .text("Date: " + slideDate);
}

function createGeoMap(geomap, locationNames) {
    // Display map
    svg.append("g")
        .attr("class", "county")
        .selectAll("path")
        .data(topojson.feature(geomap, geomap.objects.counties).features)
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
                .text(locationNames[d.id])
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

// locationNames: map geo id -> name
// locationValues: map geo id -> value
// color: d3 coloring function
function updateGeoMap(locationNames, locationValues, color) {
    svg.selectAll(".county path")
        .style ( "fill" , function (d) {
            return color(locationValues[d.id]);
        })
        .on("mouseover", function(d) {
            const sel = d3.select(this);
            sel.moveToFront();
            d3.select(this).transition().duration(300).style({'opacity': 1, 'stroke': 'black', 'stroke-width': 1.5});
            tooltipDiv.transition().duration(300)
                .style("opacity", 1);
            tooltipDiv
                .text(locationNames[d.id] + ":" + locationValues[d.id])
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

function dataLoaded(error, geomap, rawData) {
    const allDates = getDateList(rawData);

    moveSelectionsToBackOrFront();
    const slider = createSlider(allDates);
    createLegend();

    const baseData = preprocess(rawData, allDates);
    const locationNames = getLocationNameDict(baseData);

    createGeoMap(geomap, locationNames);

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
                }

                if (customData != undefined) {
                    const domain = getPercentiles(customData, [1, 99]);
                    const color = d3.scale.linear()
                        .domain(domain)
                        .range([lowColor, highColor])
                        .clamp(true);
    
                    updateLegendLimits(domain);
                    updateGeoMap(locationNames, customData[slideValue], color);
                    
                    // Updates slider
                    slider.on("input", function() {
                        updateSlider(allDates, this.value);
                        updateGeoMap(locationNames, customData[slideValue], color);
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