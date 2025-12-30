/**
 * @name Missing input validation with Zod schema
 * @description Detects form submissions or API calls without Zod schema validation
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id papas-books/missing-input-validation
 * @tags security
 *       validation
 */

import javascript

/**
 * Form submission or mutation that should have validation
 */
class DataMutation extends CallExpr {
  DataMutation() {
    // Supabase mutations
    this.getCalleeName() in ["insert", "update", "upsert", "delete"]
    or
    // React Query mutations
    exists(Property prop |
      prop.getName() = "mutationFn" and
      this.getParent*() = prop.getInit()
    )
    or
    // Form onSubmit handlers
    exists(Property prop |
      prop.getName() in ["onSubmit", "handleSubmit"] and
      this.getParent*() = prop.getInit()
    )
  }

  predicate hasZodValidation() {
    exists(MethodCallExpr zodCall |
      zodCall.getMethodName() in ["parse", "safeParse", "parseAsync", "safeParseAsync"] and
      zodCall.getParent*() = this.getParent*()
    )
  }

  predicate isTestCode() {
    exists(File f |
      f = this.getFile() and
      (
        f.getRelativePath().matches("%test%") or
        f.getRelativePath().matches("%mock%") or
        f.getRelativePath().matches("%fixture%")
      )
    )
  }
}

from DataMutation mutation
where
  not mutation.hasZodValidation() and
  not mutation.isTestCode()
select mutation,
  "Data mutation without Zod schema validation. Consider using .parse() or .safeParse() to validate input."
