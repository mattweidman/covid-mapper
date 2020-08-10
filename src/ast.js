var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var ExprType;
(function (ExprType) {
    ExprType[ExprType["Scalar"] = 0] = "Scalar";
    ExprType[ExprType["Array"] = 1] = "Array";
})(ExprType || (ExprType = {}));
var Expr = /** @class */ (function () {
    function Expr() {
    }
    return Expr;
}());
var NumberNode = /** @class */ (function (_super) {
    __extends(NumberNode, _super);
    function NumberNode(valueStr) {
        var _this = _super.call(this) || this;
        _this.value = parseInt(valueStr, 10);
        return _this;
    }
    NumberNode.prototype.getType = function () {
        return ExprType.Scalar;
    };
    NumberNode.prototype.evaluate = function () {
        return this.value;
    };
    return NumberNode;
}(Expr));
var ConstantNode = /** @class */ (function (_super) {
    __extends(ConstantNode, _super);
    function ConstantNode(name) {
        var _this = _super.call(this) || this;
        _this.name = name;
        return _this;
    }
    ConstantNode.prototype.getType = function () {
        return ExprType.Scalar;
    };
    ConstantNode.prototype.evaluate = function (data, currentDay) {
        switch (this.name) {
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
    };
    return ConstantNode;
}(Expr));
var DataAccessNode = /** @class */ (function (_super) {
    __extends(DataAccessNode, _super);
    function DataAccessNode(name, indexExpr) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.indexExpr = indexExpr;
        if (indexExpr.getType() !== ExprType.Scalar) {
            throw "Index to data access must be a scalar.";
        }
        return _this;
    }
    DataAccessNode.prototype.getType = function () {
        return ExprType.Scalar;
    };
    DataAccessNode.prototype.evaluate = function (data, currentDay) {
        var index = this.indexExpr.evaluate(data, currentDay);
        switch (this.name) {
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
    };
    DataAccessNode.prototype.accessDataSet = function (dataSet, index) {
        if (index < 0) {
            return 0;
        }
        else if (index >= dataSet.length) {
            throw "Cannot access future data.";
        }
        else {
            return dataSet[index];
        }
    };
    return DataAccessNode;
}(Expr));
var DataRangeNode = /** @class */ (function (_super) {
    __extends(DataRangeNode, _super);
    function DataRangeNode(name, startExpr, endExpr) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.startExpr = startExpr;
        _this.endExpr = endExpr;
        if (startExpr.getType() !== ExprType.Scalar) {
            throw "Starting index to data range must be a scalar.";
        }
        if (endExpr.getType() !== ExprType.Scalar) {
            throw "Ending index to data range must be a scalar.";
        }
        return _this;
    }
    DataRangeNode.prototype.getType = function () {
        return ExprType.Array;
    };
    DataRangeNode.prototype.evaluate = function (data, currentDay) {
        var startIndex = this.startExpr.evaluate(data, currentDay);
        var endIndex = this.endExpr.evaluate(data, currentDay);
        switch (this.name) {
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
    };
    DataRangeNode.prototype.accessDataSetRange = function (dataSet, startIndex, endIndex) {
        if (startIndex > endIndex) {
            // swap startIndex and endIndex
            var temp = startIndex;
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
            var arrayStart = this.zerosArray(-startIndex);
            var arrayEnd = dataSet.slice(0, endIndex);
            return arrayStart.concat(arrayEnd);
        }
        return dataSet.slice(startIndex, endIndex);
    };
    DataRangeNode.prototype.zerosArray = function (len) {
        var arr = new Array(len);
        for (var i = 0; i < len; i++) {
            arr[i] = 0;
        }
        return arr;
    };
    return DataRangeNode;
}(Expr));
var AggregateNode = /** @class */ (function (_super) {
    __extends(AggregateNode, _super);
    function AggregateNode(name, rangeExpr) {
        var _this = _super.call(this) || this;
        _this.name = name;
        _this.rangeExpr = rangeExpr;
        if (rangeExpr.getType() !== ExprType.Array) {
            throw "Input to aggregate function " + name + " must be a range.";
        }
        return _this;
    }
    AggregateNode.prototype.getType = function () {
        return ExprType.Scalar;
    };
    AggregateNode.prototype.evaluate = function (data, currentDay) {
        var range = this.rangeExpr.evaluate(data, currentDay);
        if (this.name === "max") {
            return range.reduce(function (acc, x) { return acc > x ? acc : x; }, range[0]);
        }
        else if (this.name === "min") {
            return range.reduce(function (acc, x) { return acc < x ? acc : x; }, range[0]);
        }
        else if (this.name === "sum") {
            return range.reduce(function (acc, x) { return acc + x; }, 0);
        }
        else if (this.name === "average") {
            return range.reduce(function (acc, x) { return acc + x; }, 0) / range.length;
        }
        else {
            throw "Unsupported aggregate function: " + this.name;
        }
    };
    return AggregateNode;
}(Expr));
var BinopNode = /** @class */ (function (_super) {
    __extends(BinopNode, _super);
    function BinopNode(operator, expr1, expr2) {
        var _this = _super.call(this) || this;
        _this.operator = operator;
        _this.expr1 = expr1;
        _this.expr2 = expr2;
        _this.binopType = _this.expr1.getType() === ExprType.Array || _this.expr2.getType() === ExprType.Array
            ? ExprType.Array
            : ExprType.Scalar;
        return _this;
    }
    BinopNode.prototype.getType = function () {
        return this.binopType;
    };
    BinopNode.prototype.evaluate = function (data, currentDay) {
        var val1 = this.expr1.evaluate(data, currentDay);
        var val2 = this.expr2.evaluate(data, currentDay);
        var type1 = this.expr1.getType();
        var type2 = this.expr2.getType();
        if (type1 === ExprType.Scalar && type2 === ExprType.Scalar) {
            var scalar1_1 = val1;
            var scalar2_1 = val2;
            if (this.operator === "+") {
                return scalar1_1 + scalar2_1;
            }
            else if (this.operator === "-") {
                return scalar1_1 - scalar2_1;
            }
            else if (this.operator === "*") {
                return scalar1_1 * scalar2_1;
            }
            else if (this.operator === "/") {
                return scalar1_1 === 0 ? 0 : scalar1_1 / scalar2_1;
            }
            else {
                throw "Unsupported binary operation: " + this.operator;
            }
        }
        else if (type1 === ExprType.Array && type2 === ExprType.Array) {
            var arr1 = val1;
            var arr2 = val2;
            if (this.operator === "+") {
                return this.zipArrays(arr1, arr2, function (a, b) { return a + b; });
            }
            else if (this.operator === "-") {
                return this.zipArrays(arr1, arr2, function (a, b) { return a - b; });
            }
            else if (this.operator === "*") {
                return this.zipArrays(arr1, arr2, function (a, b) { return a * b; });
            }
            else if (this.operator === "/") {
                return this.zipArrays(arr1, arr2, function (a, b) { return a === 0 ? 0 : a / b; });
            }
            else {
                throw "Unsupported binary operation: " + this.operator;
            }
        }
        else if (type1 === ExprType.Scalar) {
            var scalar1 = val1;
            var array2 = val2;
            if (this.operator === "+") {
                return array2.map(function (a) { return scalar1 + a; });
            }
            else if (this.operator === "-") {
                return array2.map(function (a) { return scalar1 - a; });
            }
            else if (this.operator === "*") {
                return array2.map(function (a) { return scalar1 * a; });
            }
            else if (this.operator === "/") {
                return array2.map(function (a) { return scalar1 === 0 ? 0 : scalar1 / a; });
            }
            else {
                throw "Unsupported binary operation: " + this.operator;
            }
        }
        else {
            var array1 = val1;
            var scalar2 = val2;
            if (this.operator === "+") {
                return array1.map(function (a) { return a + scalar2; });
            }
            else if (this.operator === "-") {
                return array1.map(function (a) { return a - scalar2; });
            }
            else if (this.operator === "*") {
                return array1.map(function (a) { return a * scalar2; });
            }
            else if (this.operator === "/") {
                return array1.map(function (a) { return a === 0 ? 0 : a / scalar2; });
            }
            else {
                throw "Unsupported binary operation: " + this.operator;
            }
        }
    };
    BinopNode.prototype.zipArrays = function (arr1, arr2, combine) {
        if (arr1.length !== arr2.length) {
            throw "Cannot combine arrays of different lengths.";
        }
        var arrAns = [];
        for (var i = 0; i < arr1.length; i++) {
            arrAns.push(combine(arr1[i], arr2[i]));
        }
        return arrAns;
    };
    return BinopNode;
}(Expr));
var ShiftNode = /** @class */ (function (_super) {
    __extends(ShiftNode, _super);
    function ShiftNode(rangeExpr, offsetExpr) {
        var _this = _super.call(this) || this;
        _this.rangeExpr = rangeExpr;
        _this.offsetExpr = offsetExpr;
        if (rangeExpr.getType() !== ExprType.Array) {
            throw "First argument to shift must be an array.";
        }
        if (offsetExpr.getType() !== ExprType.Scalar) {
            throw "Second argument to shift must be a scalar.";
        }
        return _this;
    }
    ShiftNode.prototype.getType = function () {
        return ExprType.Array;
    };
    ShiftNode.prototype.evaluate = function (data, currentDay) {
        var range = this.rangeExpr.evaluate(data, currentDay);
        var offset = this.offsetExpr.evaluate(data, currentDay);
        return range.map(function (_, i) {
            var readIndex = i - offset;
            if (readIndex < 0) {
                return 0;
            }
            else if (readIndex >= range.length) {
                throw "Offset to shift attempts to read future data.";
            }
            else {
                return range[readIndex];
            }
        });
    };
    return ShiftNode;
}(Expr));
