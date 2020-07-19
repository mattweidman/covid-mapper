const width = 960, height = 600;
const lowColor = "#dcdcdc", highColor = "#8b0000"
 
var tooltipDiv = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
 
var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("margin", "-15px auto");

var defs = svg.append("defs");

var linearGradient = defs.append("linearGradient")
    .attr("id", "linear-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

linearGradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", lowColor);

linearGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", highColor);

var path = d3.geo.path();

// const legend_title = "7-day average of new confirmed COVID cases per 1,000,000 population";

// function getConfirmedCasesOnDate(d, date) {
//     const month = date.getMonth() + 1;
//     const day = date.getDate();
//     const year = date.getYear() - 100;
//     const key = "confirmed_" + month + "/" + day + "/" + year;
//     return parseInt(d[key]);
// }
 
// // Gets the desired data value from a row in the CSV dataset.
// function getDataValue(d, date) {
//     const d2 = getConfirmedCasesOnDate(d, date);
    
//     const prevDate = new Date(date.getTime());
//     prevDate.setDate(date.getDate() - 7);
//     var d1 = getConfirmedCasesOnDate(d, prevDate);

//     if (isNaN(d1)) {
//         d1 = 0;
//     }

//     const population = parseInt(d["population"]);

//     if (population === 0) {
//         return 0;
//     }

//     return Math.round(1000000 * (d2 - d1) / 7 / population);
// }

// // Return the minimum value in the color domain.
// function getDomainMin(data) {
//     // return data.reduce((minSoFar, d) => {
//     //     var value = getDataValue(d);
//     //     return value < minSoFar ? value : minSoFar;
//     // }, Number.MAX_VALUE);
//     return 0;
// }

// // Return the maximum value in the color domain.
// function getDomainMax(data) {
//     // return data.reduce((maxSoFar, d) => {
//     //     var value = getDataValue(d);
//     //     return value > maxSoFar ? value : maxSoFar;
//     // }, -Number.MAX_VALUE);
    
//     // var data_avg = data.reduce((sumSoFar, d) => sumSoFar + getDataValue(d), 0) / data.length;
//     // return data_avg * 5;

//     return 1000;
// }

// return list of date strings extracted from CSV headers
function getDateList(rawData) {
    var allDates = [];
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

        const cases = [], deaths = [];
        allDates.forEach(dateStr => {
            cases.push(parseInt(rawDatum["confirmed_" + dateStr]));
            deaths.push(parseInt(rawDatum["deaths_" + dateStr]));
        });

        const newDatum = {
            id: rawDatum["countyFIPS"],
            name: rawDatum["County Name"],
            population: rawDatum["population"],
            cases: cases,
            deaths: deaths
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
        var firstChild = this.parentNode.firstChild; 
        if (firstChild) { 
            this.parentNode.insertBefore(this, firstChild); 
        } 
        }); 
    };
}

var slideValue = 0; // The value of the slider
function createSlider(allDates) {
    var slider = d3.select("#dateslider")
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
    var slideDate = allDates[slideValue];
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
            var sel = d3.select(this);
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
            var sel = d3.select(this);
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
            var sel = d3.select(this);
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

queue()
    .defer(d3.json, "./data/us.json")
    .defer(d3.csv, "./data/covid_all.csv")
    .await(dataLoaded);

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
                const customData = computeCustomData(baseData, ast);

                const domain = getPercentiles(customData, [1, 99]);
                var color = d3.scale.linear()
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
                    .text("Enter pressed.")
                    .style("color", "black");
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

    // Compute color domain - need to do this later
    // var domain_min = getDomainMin(data);
    // var domain_max = getDomainMax(data);

    // var color = d3.scale.linear()
    //     .domain([domain_min, domain_max])
    //     .range([lowColor, highColor])
    //     .clamp(true);

    // Pre-process data
    // var idToValueMap = {};
    // var idToNameMap = {};
    
    // data.forEach(function(d) {
    //     idToValueMap[d.countyFIPS] = getDataValue(d, new Date(latestDate));
    //     idToNameMap[d.countyFIPS] = d["County Name"];
    // });

    // Display map
    // svg.append("g")
    //     .attr("class", "county")
    //     .selectAll("path")
    //     .data(topojson.feature(us, us.objects.counties).features)
    //     .enter().append("path")
    //     .attr("d", path)
    //     .style ( "fill" , function (d) {
    //         return color (idToValueMap[d.id], new Date(latestDate));
    //     })
    //     .style("opacity", 0.8)
    //     .on("mouseover", function(d) {
    //         var sel = d3.select(this);
    //         sel.moveToFront();
    //         d3.select(this).transition().duration(300).style({'opacity': 1, 'stroke': 'black', 'stroke-width': 1.5});
    //         tooltipDiv.transition().duration(300)
    //             .style("opacity", 1);
    //         tooltipDiv.text(idToNameMap[d.id] + ": " + idToValueMap[d.id])
    //             .style("left", (d3.event.pageX) + "px")
    //             .style("top", (d3.event.pageY -30) + "px");
    //     })
    //     .on("mouseout", function() {
    //         var sel = d3.select(this);
    //         sel.moveToBack();
    //         d3.select(this)
    //             .transition().duration(300)
    //             .style({'opacity': 0.8, 'stroke': 'white', 'stroke-width': 1});
    //         tooltipDiv.transition().duration(300)
    //             .style("opacity", 0);
    //     });
    
    // Create legend
    // var legend = svg.append("g")
    //     .attr("class", "legend");
    
    // legend.append("rect")
    //     .attr("x", 0)
    //     .attr("y", 550)
    //     .attr("width", width)
    //     .attr("height", 20)
    //     .style("fill", "url(#linear-gradient)")
    //     .style("opacity", 0.8);
        
    // legend.append("text")
    //     .attr("x", 0)
    //     .attr("y", 590)
    //     .text(domain_min);

    // legend.append("text")
    //     .attr("x", width)
    //     .attr("y", 590)
    //     .attr("text-anchor", "end")
    //     .text(Math.ceil(domain_max) + "+");
    
    // svg.append("text")
    //     .attr("x", 10)
    //     .attr("y", 540)
    //     .attr("class", "legend_title")
    //     .text(function(){return legend_title});

    // function update(date) {
    //     data.forEach(function(d) {
    //         idToValueMap[d.countyFIPS] = getDataValue(d, date);
    //     });

    //     svg.select(".county")
    //         .selectAll("path")
    //         .style("fill", function(d) {
    //             return color (idToValueMap[d.id], date);
    //         });
    // }
};