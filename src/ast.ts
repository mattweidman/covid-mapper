interface CovidData {
    id: string;
    name: string;
    population: number;
    cases: number[];
    deaths: number[];
    newCases: number[];
    newDeaths: number[];
}

enum ExprType {
    Scalar,
    Array
}

abstract class Expr {
    public abstract getType(): ExprType;
    public abstract evaluate(data: CovidData, currentDay: number): number | number[];
}

class NumberNode extends Expr {
    private value: number;

    constructor(valueStr: string) {
        super();
        this.value = parseInt(valueStr, 10);
    }

    public getType(): ExprType {
        return ExprType.Scalar;
    }

    public evaluate(): number {
        return this.value;
    }
}

class ConstantNode extends Expr {
    constructor(private name: string) {
        super();
    }

    public getType(): ExprType {
        return ExprType.Scalar;
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

class DataAccessNode extends Expr {
    constructor(private name: string, private indexExpr: Expr) {
        super();

        if (indexExpr.getType() !== ExprType.Scalar) {
            throw "Index to data access must be a scalar.";
        }
    }

    public getType(): ExprType {
        return ExprType.Scalar;
    }

    public evaluate(data: CovidData, currentDay: number): number {
        var index = <number>this.indexExpr.evaluate(data, currentDay);

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

class DataRangeNode extends Expr {
    constructor(private name: string, private startExpr: Expr, private endExpr: Expr) {
        super();

        if (startExpr.getType() !== ExprType.Scalar) {
            throw "Starting index to data range must be a scalar.";
        }
        if (endExpr.getType() !== ExprType.Scalar) {
            throw "Ending index to data range must be a scalar.";
        }
    }

    public getType(): ExprType {
        return ExprType.Array;
    }

    public evaluate(data: CovidData, currentDay: number): number[] {
        const startIndex = <number>this.startExpr.evaluate(data, currentDay);
        const endIndex = <number>this.endExpr.evaluate(data, currentDay);

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

class AggregateNode extends Expr {
    constructor(private name: string, private rangeExpr: Expr) {
        super();

        if (rangeExpr.getType() !== ExprType.Array) {
            throw `Input to aggregate function ${name} must be a range.`;
        }
    }

    public getType(): ExprType {
        return ExprType.Scalar;
    }

    public evaluate(data: CovidData, currentDay: number): number {
        const range = <number[]>this.rangeExpr.evaluate(data, currentDay);

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

class BinopNode extends Expr {
    constructor(private operator: string, private expr1: Expr, private expr2: Expr) {
        super();
    }

    public getType(): ExprType {
        return this.expr1.getType() === ExprType.Array || this.expr2.getType() === ExprType.Array
            ? ExprType.Array
            : ExprType.Scalar;
    }

    public evaluate(data: CovidData, currentDay: number): number | number[] {
        const val1 = this.expr1.evaluate(data, currentDay);
        const val2 = this.expr2.evaluate(data, currentDay);

        const type1 = this.expr1.getType();
        const type2 = this.expr2.getType();

        if (type1 === ExprType.Scalar && type2 === ExprType.Scalar) {
            const scalar1 = <number>val1;
            const scalar2 = <number>val2;

            if (this.operator === "+") {
                return scalar1 + scalar2;
            } else if (this.operator === "-") {
                return scalar1 - scalar2;
            } else if (this.operator === "*") {
                return scalar1 * scalar2;
            } else if (this.operator === "/") {
                return scalar1 === 0 ? 0 : scalar1 / scalar2;
            } else {
                throw "Unsupported binary operation: " + this.operator;
            }
        } else if (type1 === ExprType.Array && type2 === ExprType.Array) {
            const arr1 = <number[]>val1;
            const arr2 = <number[]>val2;

            if (this.operator === "+") {
                return this.zipArrays(arr1, arr2, (a, b) => a + b);
            } else if (this.operator === "-") {
                return this.zipArrays(arr1, arr2, (a, b) => a - b);
            } else if (this.operator === "*") {
                return this.zipArrays(arr1, arr2, (a, b) => a * b);
            } else if (this.operator === "/") {
                return this.zipArrays(arr1, arr2, (a, b) => a === 0 ? 0 : a / b);
            } else {
                throw "Unsupported binary operation: " + this.operator;
            }
        } else if (type1 === ExprType.Scalar) {
            var scalar1 = <number>val1;
            var array2 = <number[]>val2;

            if (this.operator === "+") {
                return array2.map(a => scalar1 + a);
            } else if (this.operator === "-") {
                return array2.map(a => scalar1 - a);
            } else if (this.operator === "*") {
                return array2.map(a => scalar1 * a);
            } else if (this.operator === "/") {
                return array2.map(a => scalar1 === 0 ? 0 : scalar1 / a);
            } else {
                throw "Unsupported binary operation: " + this.operator;
            }
        } else {
            var array1 = <number[]>val1;
            var scalar2 = <number>val2;

            if (this.operator === "+") {
                return array1.map(a => a + scalar2);
            } else if (this.operator === "-") {
                return array1.map(a => a - scalar2);
            } else if (this.operator === "*") {
                return array1.map(a => a * scalar2);
            } else if (this.operator === "/") {
                return array1.map(a => a === 0 ? 0 : a / scalar2);
            } else {
                throw "Unsupported binary operation: " + this.operator;
            }
        }
    }

    private zipArrays<T>(arr1: T[], arr2: T[], combine: (x1: T, x2: T) => T): T[] {
        if (arr1.length !== arr2.length) {
            throw "Cannot combine arrays of different lengths.";
        }

        const arrAns = [];
        for (var i = 0; i < arr1.length; i++) {
            arrAns.push(combine(arr1[i], arr2[i]));
        }

        return arrAns;
    }
}

class ShiftNode extends Expr {
    constructor(private rangeExpr: Expr, private offsetExpr: Expr) {
        super();

        if (rangeExpr.getType() !== ExprType.Array) {
            throw "First argument to shift must be an array.";
        }
        if (offsetExpr.getType() !== ExprType.Scalar) {
            throw "Second argument to shift must be a scalar.";
        }
    }

    public getType(): ExprType {
        return ExprType.Array;
    }

    public evaluate(data: CovidData, currentDay: number): number[] {
        const range = <number[]>this.rangeExpr.evaluate(data, currentDay);
        const offset = <number>this.offsetExpr.evaluate(data, currentDay);

        return range.map((_, i) => {
            const readIndex = i - offset;

            if (readIndex < 0) {
                return 0;
            } else if (readIndex >= range.length) {
                throw "Offset to shift attempts to read future data.";
            } else {
                return range[readIndex];
            }
        });
    }
}