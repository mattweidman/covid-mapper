// Simple Arithmetics Grammar
// ==========================
//
// Accepts expressions like "2 * (3 + 4)" and computes their value.

Expression
  = head:Term tail:(_ ("+" / "-") _ Term)* {
      return tail.reduce(function(result, element) {
        return new BinopNode(element[1], result, element[3]);
      }, head);
    }

Term
  = head:Factor tail:(_ ("*" / "/") _ Factor)* {
      return tail.reduce(function(result, element) {
        return new BinopNode(element[1], result, element[3]);
      }, head);
    }

Factor
  = "(" _ expr:Expression _ ")" { return expr; }
  / Integer / Constant / DataAccess / DataRange / Aggregate

Integer "integer"
  = _ [0-9]+ { 
      return new NumberNode(text());
    }

_ "whitespace"
  = [ \t\n\r]*
  
Constant "constant"
  = name:("population" / "day" / "first" / "last") {
  	return new ConstantNode(name);
  }
  
DataAccess
  = name:("cases" / "deaths") _ "(" _ expr:Expression _ ")" {
    return new DataAccessNode(name, expr);
  }

DataRange
  = name:("cases" / "deaths") _ "(" _ expr1:Expression _ "," _ expr2:Expression _ ")" {
    return new DataRangeNode(name, expr1, expr2);
  }
  
Aggregate
  = name:("max" / "min" / "sum" / "average") _ "(" _ range:DataRange _ ")" { 
      return new AggregateNode(name, range); 
    }