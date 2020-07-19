interface CovidData {
    id: string;
    name: string;
    population: number;
    cases: number[];
    deaths: number[];
    newCases: number[];
    newDeaths: number[];
}

abstract class ScalarExpr {
    public abstract evaluate(data: CovidData, currentDay: number): number;
}

abstract class ArrayExpr {
    public abstract evaluate(data: CovidData, currentDay: number): number[];
}

class NumberNode extends ScalarExpr {
    private value: number;

    constructor(valueStr: string) {
        super();
        this.value = parseInt(valueStr, 10);
    }

    public evaluate(): number {
        return this.value;
    }
}

class ConstantNode extends ScalarExpr {
    constructor(private name: string) {
        super();
    }

    public evaluate(data: CovidData, currentDay: number): number {
        switch(this.name) {
            case "population": 
                return data.population;
            case "day": 
                return currentDay;
            case "first": 
                return 0;
            case "last": 
                return data.cases.length;
            default: 
                throw "Invalid constant: " + this.name;
        }
    }
}

class DataAccessNode extends ScalarExpr {
    constructor(private name: string, private indexExpr: ScalarExpr) {
        super();
    }

    public evaluate(data: CovidData, currentDay: number): number {
        var index = this.indexExpr.evaluate(data, currentDay);

        switch(this.name) {
            case "cases":
                return this.accessDataSet(data.cases, index);
            case "deaths":
                return this.accessDataSet(data.deaths, index);
            case "newcases":
                return this.accessDataSet(data.newCases, index);
            case "newdeaths":
                return this.accessDataSet(data.newDeaths, index);
            default:
                throw "Invalid dataset in DataAccessNode: " + this.name;
        }
    }

    private accessDataSet(dataSet: number[], index: number): number {
        if (index < 0) {
            return 0;
        } else if (index >= dataSet.length) {
            throw "Cannot access future data.";
        } else {
            return dataSet[index];
        }
    }
}

class DataRangeNode extends ArrayExpr {
    constructor(private name: string, private startExpr: ScalarExpr, private endExpr: ScalarExpr) {
        super();
    }

    public evaluate(data: CovidData, currentDay: number): number[] {
        const startIndex = this.startExpr.evaluate(data, currentDay);
        const endIndex = this.endExpr.evaluate(data, currentDay);

        switch(this.name) {
            case "cases":
                return this.accessDataSetRange(data.cases, startIndex, endIndex);
            case "deaths":
                return this.accessDataSetRange(data.deaths, startIndex, endIndex);
            case "newcases":
                return this.accessDataSetRange(data.newCases, startIndex, endIndex);
            case "newdeaths":
                return this.accessDataSetRange(data.newDeaths, startIndex, endIndex);
            default:
                throw "Invalid dataset in DataRangeNode: " + this.name;
        }
    }

    private accessDataSetRange(dataSet: number[], startIndex: number, endIndex: number): number[] {
        if (startIndex > endIndex) {
            // swap startIndex and endIndex
            const temp = startIndex;
            startIndex = endIndex;
            endIndex = temp;
        }

        if (endIndex > dataSet.length) {
            throw "Cannot access future data in range.";
        }

        if (startIndex < 0 && endIndex < 0) {
            return this.zerosArray(endIndex - startIndex);
        }

        if (startIndex < 0 && endIndex >= 0) {
            const arrayStart = this.zerosArray(-startIndex);
            const arrayEnd = dataSet.slice(0, endIndex);
            return arrayStart.concat(arrayEnd);
        }

        return dataSet.slice(startIndex, endIndex);
    }

    private zerosArray(len: number): number[] {
        const arr = new Array(len);

        for (var i = 0; i < len; i++) {
            arr[i] = 0;
        }

        return arr;
    }
}

class AggregateNode extends ScalarExpr {
    constructor(private name: string, private rangeExpr: ArrayExpr) {
        super();
    }

    public evaluate(data: CovidData, currentDay: number): number {
        const range = this.rangeExpr.evaluate(data, currentDay);

        if (this.name === "max") {
            return range.reduce((acc, x) => acc > x ? acc : x, range[0]);
        } else if (this.name === "min") {
            return range.reduce((acc, x) => acc < x ? acc : x, range[0]);
        } else if (this.name === "sum") {
            return range.reduce((acc, x) => acc + x, 0);
        } else if (this.name === "average") {
            return range.reduce((acc, x) => acc + x, 0) / range.length;
        } else {
            throw "Unsupported aggregate function: " + this.name;
        }
    }
}

class BinopNode extends ScalarExpr {
    constructor(private operator: string, private expr1: ScalarExpr, private expr2: ScalarExpr) {
        super();
    }

    public evaluate(data: CovidData, currentDay: number): number {
        const val1 = this.expr1.evaluate(data, currentDay);
        const val2 = this.expr2.evaluate(data, currentDay);

        if (this.operator === "+") {
            return val1 + val2;
        } else if (this.operator === "-") {
            return val1 - val2;
        } else if (this.operator === "*") {
            return val1 * val2;
        } else if (this.operator === "/") {
            return val1 === 0 ? 0 : val1 / val2;
        } else {
            throw "Unsupported binary operation: " + this.operator
        }
    }
}