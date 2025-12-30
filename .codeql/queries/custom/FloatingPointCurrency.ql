/**
 * @name Floating-point arithmetic on currency values
 * @description Using floating-point arithmetic for currency calculations can lead to rounding errors
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id papas-books/floating-point-currency
 * @tags correctness
 *       finance
 */

import javascript

/**
 * Variable or property names that suggest currency/money
 */
predicate isCurrencyName(string name) {
  name.regexpMatch("(?i).*(amount|balance|total|price|cost|fee|payment|credit|debit).*")
}

/**
 * Operations that involve division or multiplication (risky for currency)
 */
class CurrencyArithmetic extends BinaryExpr {
  CurrencyArithmetic() {
    this.getOperator() in ["/", "*"] and
    exists(VarAccess v |
      (v = this.getLeftOperand() or v = this.getRightOperand()) and
      isCurrencyName(v.getName())
    )
  }

  VarAccess getCurrencyOperand() {
    result = this.getLeftOperand() and isCurrencyName(result.getName())
    or
    result = this.getRightOperand() and isCurrencyName(result.getName())
  }
}

/**
 * Check if value is being converted to/from cents (acceptable)
 */
predicate isConversionToFromCents(Expr e) {
  exists(BinaryExpr bin |
    bin = e and
    (
      // Dividing by 100 (cents to dollars)
      (bin.getOperator() = "/" and bin.getRightOperand().(NumberLiteral).getValue() = "100")
      or
      // Multiplying by 100 (dollars to cents)
      (bin.getOperator() = "*" and bin.getRightOperand().(NumberLiteral).getValue() = "100")
    )
  )
}

from CurrencyArithmetic arith
where not isConversionToFromCents(arith)
select arith,
  "Floating-point arithmetic on currency value '" + arith.getCurrencyOperand().getName() +
  "'. Consider using integer cents and avoiding division."
