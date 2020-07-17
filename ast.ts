interface CovidData {
    id: string;
    name: string;
    population: number;
    cases: number[];
    deaths: number[];
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
                throw "Invalid constant in ConstantNode";
        }
    }
}

class DataAccessNode extends ScalarExpr {
    constructor(private name: string, private indexExpr: ScalarExpr) {
        super();
    }

    public evaluate(data: CovidData, currentDay: number): number {
        const index = this.indexExpr.evaluate(data, currentDay);

        switch(this.name) {
            case "cases":
                return data.cases[index];
            case "deaths":
                return data.deaths[index];
            default:
                throw "Invalid dataset in DataAccessNode";
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
                return data.cases.slice(startIndex, endIndex);
            case "deaths":
                return data.deaths.slice(startIndex, endIndex);
            default:
                throw "Invalid dataset in DataAccessNode";
        }
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
            throw "Unsupported aggregate function";
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
            return val1 / val2;
        } else {
            throw "Unsupported binary operation"
        }
    }
}