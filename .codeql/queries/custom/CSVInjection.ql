/**
 * @name CSV Injection vulnerability
 * @description CSV files with formulas starting with =, +, -, or @ can execute code in spreadsheet applications
 * @kind path-problem
 * @problem.severity warning
 * @precision medium
 * @id papas-books/csv-injection
 * @tags security
 *       csv
 *       external/cwe/cwe-1236
 */

import javascript
import DataFlow::PathGraph

/**
 * Source: User-controlled data (transaction descriptions, memos, payee names)
 */
class UserControlledCSVSource extends DataFlow::Node {
  UserControlledCSVSource() {
    exists(Parameter p |
      p.getName() in ["description", "memo", "payee", "category", "name", "notes"] and
      this = DataFlow::parameterNode(p)
    )
    or
    exists(Property prop |
      prop.getName() in ["description", "memo", "payee_name", "notes", "original_description"] and
      this = prop.getInit().flow()
    )
  }
}

/**
 * Sink: Data being written to CSV
 */
class CSVWriteSink extends DataFlow::Node {
  CSVWriteSink() {
    // PapaParse unparse calls
    exists(CallExpr call |
      call.getCalleeName() in ["unparse", "stringify"] and
      this = call.getAnArgument().flow()
    )
    or
    // String concatenation for CSV rows
    exists(AddExpr add |
      add.getRightOperand().(StringLiteral).getValue().matches("%,%") and
      this = add.getLeftOperand().flow()
    )
  }
}

/**
 * Configuration for tracking CSV injection
 */
class CSVInjectionConfig extends TaintTracking::Configuration {
  CSVInjectionConfig() { this = "CSVInjectionConfig" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof UserControlledCSVSource
  }

  override predicate isSink(DataFlow::Node sink) {
    sink instanceof CSVWriteSink
  }

  override predicate isSanitizer(DataFlow::Node node) {
    // Sanitizer: Check for formula character replacement
    exists(MethodCallExpr replace |
      replace.getMethodName() = "replace" and
      replace.getArgument(0).(RegExpLiteral).getValue().regexpMatch(".*[=+@-].*") and
      node = replace.flow()
    )
    or
    // Sanitizer: Check for quote escaping
    exists(MethodCallExpr replace |
      replace.getMethodName() = "replace" and
      (
        replace.getArgument(1).(StringLiteral).getValue().matches("'%") or
        replace.getArgument(1).(StringLiteral).getValue().matches("\"%")
      ) and
      node = replace.flow()
    )
  }
}

from CSVInjectionConfig cfg, DataFlow::PathNode source, DataFlow::PathNode sink
where cfg.hasFlowPath(source, sink)
select sink.getNode(), source, sink,
  "User-controlled data from $@ flows to CSV export without sanitization, which may allow CSV injection.",
  source.getNode(), "user input"
