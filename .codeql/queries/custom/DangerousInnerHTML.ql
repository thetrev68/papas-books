/**
 * @name Dangerous use of dangerouslySetInnerHTML
 * @description Using dangerouslySetInnerHTML with user-controlled data can lead to XSS vulnerabilities
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id papas-books/dangerous-inner-html
 * @tags security
 *       react
 *       xss
 *       external/cwe/cwe-079
 */

import javascript
import DataFlow::PathGraph

/**
 * A source of user-controlled data in Papa's Books
 */
class UserControlledSource extends DataFlow::Node {
  UserControlledSource() {
    // Data from Supabase queries (could be user-controlled)
    exists(MethodCallExpr call |
      call.getMethodName() in ["select", "insert", "update"] and
      this = call.flow()
    )
    or
    // Props passed to components
    exists(Parameter p |
      p.getName() in ["description", "memo", "notes", "name", "alias"] and
      this = DataFlow::parameterNode(p)
    )
    or
    // Form inputs
    exists(MethodCallExpr call |
      call.getMethodName() in ["useState", "useForm"] and
      this = call.flow()
    )
  }
}

/**
 * A sink for dangerouslySetInnerHTML
 */
class DangerousInnerHTMLSink extends DataFlow::Node {
  DangerousInnerHTMLSink() {
    exists(Property prop |
      prop.getName() = "dangerouslySetInnerHTML" and
      this = prop.getInit().flow()
    )
  }
}

/**
 * Configuration for tracking flow from user input to dangerouslySetInnerHTML
 */
class DangerousInnerHTMLConfig extends TaintTracking::Configuration {
  DangerousInnerHTMLConfig() { this = "DangerousInnerHTMLConfig" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof UserControlledSource
  }

  override predicate isSink(DataFlow::Node sink) {
    sink instanceof DangerousInnerHTMLSink
  }
}

from DangerousInnerHTMLConfig cfg, DataFlow::PathNode source, DataFlow::PathNode sink
where cfg.hasFlowPath(source, sink)
select sink.getNode(), source, sink,
  "dangerouslySetInnerHTML is used with $@, which may lead to XSS.",
  source.getNode(), "user-controlled data"
