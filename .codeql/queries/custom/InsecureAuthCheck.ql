/**
 * @name Insecure authentication check
 * @description Detects potentially insecure authentication checks that don't verify bookset access
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id papas-books/insecure-auth-check
 * @tags security
 *       authentication
 */

import javascript

/**
 * A check for user authentication that may be incomplete
 */
class AuthCheck extends IfStmt {
  AuthCheck() {
    exists(VarAccess v |
      v = this.getCondition().getAChildExpr*() and
      v.getName() in ["user", "session", "isAuthenticated"]
    )
  }

  predicate checksBooksetAccess() {
    exists(VarAccess v |
      v = this.getCondition().getAChildExpr*() and
      v.getName() in ["activeBookset", "canEdit", "canAdmin", "hasAccess"]
    )
  }

  predicate inProtectedRoute() {
    exists(Property prop |
      prop.getName() = "element" and
      this.getContainer*() = prop.getInit()
    )
  }
}

from AuthCheck check
where
  check.inProtectedRoute() and
  not check.checksBooksetAccess()
select check,
  "Authentication check only verifies user session but doesn't check bookset access permissions. " +
  "Consider also checking activeBookset, canEdit, or canAdmin from AuthContext."
