/**
 * @name Hardcoded Supabase credentials
 * @description Detects hardcoded Supabase URLs or keys instead of using environment variables
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id papas-books/hardcoded-credentials
 * @tags security
 *       external/cwe/cwe-798
 */

import javascript

/**
 * A string literal that looks like a Supabase URL or key
 */
predicate looksLikeSupabaseCredential(StringLiteral s) {
  exists(string val | val = s.getValue() |
    // Supabase URL pattern
    val.regexpMatch("https://[a-z]{20}\\.supabase\\.co")
    or
    // Supabase anon key pattern (eyJ prefix is JWT)
    val.regexpMatch("eyJ[A-Za-z0-9_-]{100,}")
  )
}

/**
 * Calls to createClient that should use env vars
 */
class SupabaseClientCreation extends CallExpr {
  SupabaseClientCreation() {
    this.getCalleeName() = "createClient"
  }

  Expr getUrlArg() {
    result = this.getArgument(0)
  }

  Expr getKeyArg() {
    result = this.getArgument(1)
  }
}

from SupabaseClientCreation client, Expr arg, string message
where
  (
    arg = client.getUrlArg() and
    looksLikeSupabaseCredential(arg) and
    message = "Hardcoded Supabase URL detected. Use VITE_SUPABASE_URL environment variable instead."
  )
  or
  (
    arg = client.getKeyArg() and
    looksLikeSupabaseCredential(arg) and
    message = "Hardcoded Supabase key detected. Use VITE_SUPABASE_ANON_KEY environment variable instead."
  )
select arg, message
