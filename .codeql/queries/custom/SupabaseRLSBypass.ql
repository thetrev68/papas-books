/**
 * @name Missing Bookset ID in Supabase Query
 * @description Detects queries to Supabase that may bypass Row Level Security by not filtering on bookset_id
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id papas-books/missing-bookset-filter
 * @tags security
 *       correctness
 *       supabase
 *       rls
 */

import javascript

/**
 * Finds calls to Supabase query methods that should filter by bookset_id
 */
class SupabaseQuery extends MethodCallExpr {
  SupabaseQuery() {
    this.getMethodName() in ["select", "from", "insert", "update", "delete", "upsert"]
    and
    // Match calls like supabase.from('table')
    this.getReceiver().(MethodCallExpr).getMethodName() = "from"
  }

  string getTableName() {
    result = this.getReceiver().(MethodCallExpr).getArgument(0).(StringLiteral).getValue()
  }
}

/**
 * Tables that require bookset_id filtering (all except users, booksets, access_grants)
 */
predicate requiresBooksetFilter(string tableName) {
  tableName in [
    "accounts",
    "transactions",
    "categories",
    "rules",
    "payees",
    "transaction_lines"
  ]
}

/**
 * Check if a query chain includes an .eq('bookset_id', ...) filter
 */
predicate hasBooksetFilter(Expr e) {
  exists(MethodCallExpr eqCall |
    eqCall.getMethodName() = "eq" and
    eqCall.getArgument(0).(StringLiteral).getValue() = "bookset_id" and
    (
      e = eqCall or
      hasBooksetFilter(e.(MethodCallExpr).getReceiver())
    )
  )
}

from SupabaseQuery query, string tableName
where
  tableName = query.getTableName() and
  requiresBooksetFilter(tableName) and
  not hasBooksetFilter(query.getParent*())
select query, "Query on table '" + tableName + "' is missing bookset_id filter, which may bypass Row Level Security"
