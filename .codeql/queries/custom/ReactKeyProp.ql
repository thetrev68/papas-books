/**
 * @name Missing or non-unique React key prop
 * @description Array.map() without unique key prop can cause rendering issues and state bugs
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id papas-books/react-missing-key
 * @tags correctness
 *       react
 *       performance
 */

import javascript

/**
 * A call to Array.map() that returns JSX elements
 */
class ArrayMapReturningJSX extends MethodCallExpr {
  ArrayMapReturningJSX() {
    this.getMethodName() = "map" and
    exists(JsxElement jsx |
      jsx = this.getArgument(0).(ArrowFunctionExpr).getBody().getAChildExpr*()
    )
  }

  JsxElement getReturnedElement() {
    result = this.getArgument(0).(ArrowFunctionExpr).getBody().getAChildExpr*()
  }

  predicate hasKeyProp() {
    exists(JsxAttribute attr |
      attr = this.getReturnedElement().getAnAttribute() and
      attr.getName() = "key"
    )
  }

  predicate usesArrayIndex() {
    exists(JsxAttribute attr, Parameter indexParam |
      attr = this.getReturnedElement().getAnAttribute() and
      attr.getName() = "key" and
      indexParam = this.getArgument(0).(ArrowFunctionExpr).getParameter(1) and
      attr.getValue().getAChildExpr*().(VarAccess).getName() = indexParam.getName()
    )
  }
}

from ArrayMapReturningJSX mapCall, string message
where
  (
    not mapCall.hasKeyProp() and
    message = "Array.map() returns JSX without a 'key' prop. Add a unique key to avoid React rendering issues."
  )
  or
  (
    mapCall.usesArrayIndex() and
    message = "Using array index as React key can cause bugs when items are reordered. Use a unique ID instead (e.g., transaction.id or account.id)."
  )
select mapCall, message
