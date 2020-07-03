var width = 960, height = 600;
 
var div = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
 
var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("margin", "-15px auto");

var path = d3.geo.path();

const legend_title = "Number of confirmed COVID cases on 6/30/2020";

const num_color_divisions = 13;
 
// Gets the desired data value from a row in the CSV dataset.
function getDataValue(d) {
    return parseInt(d["6/30/20"]);
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
    var data_avg = data.reduce((sumSoFar, d) => sumSoFar + getDataValue(d), 0) / data.length;
    return data_avg * 10;
}

queue()
    .defer(d3.json, "us.json")
    .defer(d3.csv, "covid_confirmed_usafacts.csv")
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

    // Compute color domain
    var domain_min = getDomainMin(data);
    var domain_max = getDomainMax(data);

    var color_inc = Math.ceil((domain_max - domain_min) / num_color_divisions);

    var color_domain = [];
    // Start at 1 so as not to include min. Color domain should be 1 element shorter than range.
    for (var i = 1; i < num_color_divisions; i++) {
        color_domain = color_domain.concat([i * color_inc]);
    }

    var color = d3.scale.threshold()
        .domain(color_domain)
        .range(["#dcdcdc", "#d0d6cd", "#bdc9be", "#aabdaf", "#97b0a0", "#84a491", "#719782", "#5e8b73", "#4b7e64", "#387255", "#256546", "#125937", "#004d28"]);

    // Pre-process data
    var idToValueMap = {};
    var idToNameMap = {};
    
    data.forEach(function(d) {
        idToValueMap[d.countyFIPS] = getDataValue(d);
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
            return color (idToValueMap[d.id]);
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
    var ext_color_domain = [domain_min].concat(color_domain);

    var legend = svg.selectAll("g.legend")
        .data(ext_color_domain)
        .enter().append("g")
        .attr("class", "legend");
        
    var ls_w = 73, ls_h = 20;
        
    legend.append("rect")
        .attr("x", function(d, i){ return width - (i*ls_w) - ls_w;})
        .attr("y", 550)
        .attr("width", ls_w)
        .attr("height", ls_h)
        .style("fill", function(d, i) { return color(d); })
        .style("opacity", 0.8);
        
    var legend_labels = ext_color_domain.map(x => x + "+");
    legend.append("text")
        .attr("x", function(d, i){ return width - (i*ls_w) - ls_w;})
        .attr("y", 590)
        .text(function(d, i){ return legend_labels[i]; });
    
    svg.append("text")
        .attr("x", 10)
        .attr("y", 540)
        .attr("class", "legend_title")
        .text(function(){return legend_title});
};