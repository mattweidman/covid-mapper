var width = 960, height = 600;
 
var div = d3.select("body").append("div")
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
    .attr("stop-color", "#dcdcdc");

linearGradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#004d28");

var path = d3.geo.path();

const legend_title = "Number of new confirmed COVID cases per 1,000,000 population";

const num_color_divisions = 13;

function getConfirmedCasesOnDate(d, date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getYear() - 100;
    const key = "confirmed_" + month + "/" + day + "/" + year;
    return parseInt(d[key]);
}
 
// Gets the desired data value from a row in the CSV dataset.
function getDataValue(d, date) {
    const d2 = getConfirmedCasesOnDate(d, date);
    
    const prevDate = new Date(date.getTime());
    prevDate.setDate(date.getDate() - 1);
    var d1 = getConfirmedCasesOnDate(d, prevDate);

    if (isNaN(d1)) {
        d1 = 0;
    }

    const population = parseInt(d["population"]);

    if (population === 0) {
        return 0;
    }

    return Math.round(1000000 * (d2 - d1) / population);
}

// Return the minimum value in the color domain.
function getDomainMin(data) {
    // return data.reduce((minSoFar, d) => {
    //     var value = getDataValue(d);
    //     return value < minSoFar ? value : minSoFar;
    // }, Number.MAX_VALUE);
    return 0;
}

// Return the maximum value in the color domain.
function getDomainMax(data) {
    // return data.reduce((maxSoFar, d) => {
    //     var value = getDataValue(d);
    //     return value > maxSoFar ? value : maxSoFar;
    // }, -Number.MAX_VALUE);
    
    // var data_avg = data.reduce((sumSoFar, d) => sumSoFar + getDataValue(d), 0) / data.length;
    // return data_avg * 5;

    return 1000;
}

queue()
    .defer(d3.json, "./data/us.json")
    .defer(d3.csv, "./data/covid_all.csv")
    .await(ready);

function ready(error, us, data) {

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

    // Slider
    var allDates = [];
    for (const key in data[0]) {
        if (key.startsWith("confirmed_")) {
            allDates.push(key.substring("confirmed_".length));
        }
    }
    
    var slider = d3.select("#dateslider")
        .attr("min", 0)
        .attr("max", allDates.length - 1)
        .attr("step", 1)
        .attr("value", allDates.length - 1);

    const latestDate = allDates[allDates.length - 1];
    d3.select("#datetext").text("Date: " + latestDate);

    // Compute color domain
    var domain_min = getDomainMin(data);
    var domain_max = getDomainMax(data);

    var color = d3.scale.linear()
        .domain([domain_min, domain_max])
        .range(["#dcdcdc", "#004d28"])
        .clamp(true);

    // Pre-process data
    var idToValueMap = {};
    var idToNameMap = {};
    
    data.forEach(function(d) {
        idToValueMap[d.countyFIPS] = getDataValue(d, new Date(latestDate));
        idToNameMap[d.countyFIPS] = d["County Name"];
    });

    // Display map
    svg.append("g")
        .attr("class", "county")
        .selectAll("path")
        .data(topojson.feature(us, us.objects.counties).features)
        .enter().append("path")
        .attr("d", path)
        .style ( "fill" , function (d) {
            return color (idToValueMap[d.id], new Date(latestDate));
        })
        .style("opacity", 0.8)
        .on("mouseover", function(d) {
            var sel = d3.select(this);
            sel.moveToFront();
            d3.select(this).transition().duration(300).style({'opacity': 1, 'stroke': 'black', 'stroke-width': 1.5});
            div.transition().duration(300)
                .style("opacity", 1);
            div.text(idToNameMap[d.id] + ": " + idToValueMap[d.id])
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY -30) + "px");
        })
        .on("mouseout", function() {
            var sel = d3.select(this);
            sel.moveToBack();
            d3.select(this)
                .transition().duration(300)
                .style({'opacity': 0.8, 'stroke': 'white', 'stroke-width': 1});
            div.transition().duration(300)
                .style("opacity", 0);
        });
    
    // Create legend
    var legend = svg.append("g")
        .attr("class", "legend");
    
    legend.append("rect")
        .attr("x", 0)
        .attr("y", 550)
        .attr("width", width)
        .attr("height", 20)
        .style("fill", "url(#linear-gradient)")
        .style("opacity", 0.8);
        
    legend.append("text")
        .attr("x", 0)
        .attr("y", 590)
        .text(domain_min);

    legend.append("text")
        .attr("x", width)
        .attr("y", 590)
        .attr("text-anchor", "end")
        .text(Math.ceil(domain_max) + "+");
    
    svg.append("text")
        .attr("x", 10)
        .attr("y", 540)
        .attr("class", "legend_title")
        .text(function(){return legend_title});

    // Update slider
    slider.on("input", function() {
        var slideNum = this.value;
        var slideDate = allDates[slideNum];
        d3.select("#datetext")
            .text("Date: " + slideDate);
        update(new Date(slideDate));
    });

    function update(date) {
        data.forEach(function(d) {
            idToValueMap[d.countyFIPS] = getDataValue(d, date);
        });

        svg.select(".county")
            .selectAll("path")
            .style("fill", function(d) {
                return color (idToValueMap[d.id], date);
            });
    }
};