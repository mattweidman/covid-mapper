# covid-mapper

Create maps using COVID-19 data. Enter an expression and view a map of the data across US counties, US states, and countries.

Code based on: http://bl.ocks.org/TheMapSmith/bd3ef04e33483e671601c753856273cb

Data: https://usafacts.org/visualizations/coronavirus-covid-19-spread-map/

![Map of covid cases](./usamap.png)

## Getting started

First, you need to install the necessary NPM libaries:

`npm install -g typescript`

`npm install -g pegjs`

To build code:

`build.cmd`

To run, open index.html in the browser of your choice.

## Usage

Enter an expression into the textbox and press "enter." Move the slider to view different dates. The map will adjust its colors according to the values you are looking for.

### Expressions

Expressions are used to describe some kind of data you would like to see using data about COVID confirmed cases and deaths. 

For example, to see the number of confirmed cases by county, write *cases(day)*. *cases* is the name of the data set (total cases up to that point), and *day* indicates you would like to see the number of cases on the day indicated by the slider. Moving the slider changes the value of *day*.

To see the number of new cases in the past week, enter *cases(day) - cases(day - 7)*. The expression *cases(day - 7)* means, "find the number of confirmed cases 7 days before the day indicated by the slider."

The following datasets can be accessed:
* *cases*: The total number of confirmed cases up to the given day.
* *deaths*: The total number of deaths up to the given day.
* *newcases*: The number of new confirmed cases on the given day.
* *newdeaths*: The number of new deaths on the given day.

The following arithmetic operators are allowed:
* Addition: +
* Subtraction: - (currently only works as a binary operator)
* Multiplication: *
* Division: / (Note: Dividing 0 by 0 will always give 0. If the numerator is ever not 0 but the denominator is, there could be issues with coloring.)
* Parentheses: ( )

The *population* variable refers to the population of the region in question. To see the number of confirmed cases per 1000000 people, try *cases(day) / population * 1000000*. 

Aggregate operators over ranges of data are allowed. For example, to find the average number of total confirmed cases over the last 7 days, try *average(cases(day-7, day))*. Or, for the average over all days, try *average(cases(first, last))*. 

Ranges of data can be accessed by giving a dataset two arguments. The first argument is the first day to include in the range, and the second argument is one more than the last day. Ranges can be used as arguments to aggregation functions.

The constants *first* and *last* are the first day in the dataset, and one more than the last day, respectively. There is no data on day *last*; to see the number of confirmed cases on the most recent day, try *cases(last - 1)*.

The following aggregate operations can be used over a range of data:
* max
* min
* sum
* average

Arithmetic operators can act on two scalars, a scalar and an array (range), or on two arrays. When a scalar and an array are added, for example, the scalar is added to each element of the array. Operations on two arrays are always element-wise, so multiplying two arrays will produce a new array in which each element is the product of the elements from the multiplied arrays at the same index. Arrays must be the same length in order to be combined.

There is also a shift operation that takes a range of data and shifts it in time by some offset. For example, shift(newcases(first, last), 7) would take the range of newcases from the first day to the last day and produce a new array of the same length, but each element is now the data point from 7 days ago. If the offset (7 in this case) is positive, the last 7 days of the dataset are ignored, and the first 7 days are filled in with zeros. If the offset is negative, an error will appear during evaluation because the evaluator will attempt to access future data. 

The shift operation is useful if you want to compare ranges of data from different time periods. For example, cases(first, last) - shift(cases(first, last), 7) returns a range of data in which each element is the number of new cases in the last 7 days. Taking max(cases(first, last) - shift(cases(first, last), 7)) gives the maximum number of 7-day new cases.

## TODO 

### Major features
* Let users change map colors.
* Shareable maps - maybe could generate a link that you can send to others.
* Different types of data - age groups, symptoms(?), hospitalizations, ICU use
* Expanding circles option on maps
* More countries states/provinces: Canada, China, Mexico, Brazil, India, Australia, Russia, etc.
* Show multiple regions at once in line chart.
* Video or gif of change over time.

### Minor features
* Floating point numbers in expressions.
* Exp and log function.
* Show a map of countries and states on the same map.
* Show loading while user is waiting.
* Change sources listed on screen when user changes the map.
* Let user use up, down, and tab to navigate suggestions.
* Round data values on map, values on time chart, and min/max legend values to significant figures.
* Show time chart of world or time chart of USA when no region selected.

### Bugs
* Fix undefined counties (examples in South Dakota and Alaska).
* Make color contrast accessible.
* Don't reload data when switching between USA states map and USA counties map.

### Non-feature work items
* Migrate more to TypeScript.
* Divide index.js into smaller files.
* Set up npm.
* Use grunt or some kind of build system.
* Include a version as part of the URL in order to prevent caching when we update.
* Host on an app service.
* Get a custom domain.
* Better mobile experience.