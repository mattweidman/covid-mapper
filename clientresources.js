const clientResources = {
  "siteTitle": "Covid-19 Mapper",
  "Path": "The path is ",
  "siteSubTitle": "Make your own graph by entering an expression:",
  "docs": {
    "cases": "dataset for the total number of confirmed cases up to the given day",
    "deaths": "dataset for the total number of deaths up to the given day",
    "newcases": "dataset for the number of new cases on the given day",
    "newdeaths": "dataset for the number of new deaths on the given day",
    "day": "the date indicated by the slider",
    "first": "the first date in the dataset",
    "last": "the last date in the dataset",
    "population": "population of the region",
    "sum": "aggregate sum operation, used over a range of data",
    "average": "aggregate average operation, used over a range of data",
    "max": "aggregate max operation, used over a range of data",
    "min": "aggregate min operation, used over a range of data",
    "shift": "takes a range and an offset as input; returns the range shifted by offset number of days",
    "+": "addition",
    "-": "subtraction",
    "*": "multiplication",
    "/": "division: dividing zero by zero returns zero"
  },
  "expressions": {
    "sevenDayAvgNewCasesPer100000": {
        "title": "7-day average of new cases per 100,000 people",
        "expression": "(cases(day) - cases(day-7)) / 7 / population * 100000"
    },
    "sevenDayAvgNewDeathsPer100000": {
        "title": "7-day average of new deaths per 100,000 people",
        "expression": "(deaths(day) - deaths(day-7)) / 7 / population * 100000"
    },
    "newCasesPer100000": {
        "title": "New cases per 100,000 people",
        "expression": "newcases(day) / population * 100000"
    },
    "newDeathsPer100000": {
        "title": "New deaths per 100,000 people",
        "expression": "newdeaths(day) / population * 100000"
    },
    "totalCasesPer100000": {
      "title": "Total confirmed cases per 100,000 people",
      "expression": "cases(day) / population * 100000"
    },
    "totalDeathsPer100000": {
      "title": "Total deaths per 100,000 people",
      "expression": "deaths(day) / population * 100000"
    },
    "sevenDayAvgNewCases": {
        "title": "7-day average of new cases",
        "expression": "(cases(day) - cases(day-7)) / 7"
    },
    "sevenDayAvgNewDeaths": {
        "title": "7-day average of new deaths",
        "expression": "(deaths(day) - deaths(day-7)) / 7"
    },
    "newCases": {
        "title": "New cases",
        "expression": "newcases(day)"
    },
    "newDeaths": {
        "title": "New deaths",
        "expression": "newdeaths(day)"
    },
    "totalCases": {
        "title": "Total cases",
        "expression": "cases(day)"
    },
    "totalDeaths": {
        "title": "Total deaths",
        "expression": "deaths(day)"
    },
    "progressToZero": {
        "title": "Percentage of maximum new cases",
        "expression": "newcases(day) / max(newcases(first, last)) * 100"
    },
    "progressToZeroSevenDayAvg": {
        "title": "Percentage of maximum new cases, averaged over 7 days",
        "expression": "(cases(day) - cases(day-7)) / max(cases(first, last) - shift(cases(first, last), 7)) * 100"
    },
    "deathRate": {
        "title": "Cumulative death rate",
        "expression": "deaths(day) / cases(day) * 100"
    }
  }
};