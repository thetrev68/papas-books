# AI Agents Collaboration Guide for Papa's Books

This document outlines the framework for AI-assisted development on the Papa's Books project, enabling multiple LLM agents to collaborate effectively on coding, debugging, and maintenance tasks.

## Overview

Papa's Books is a React/TypeScript bookkeeping application with Supabase backend. This guide defines agent roles, communication protocols, and workflows to ensure consistent, high-quality development.

## Agent Roles

### 🏗️ Architect Agent

**Responsibilities:**

- System design and architecture decisions
- Feature planning and technical specifications
- Code organization and patterns
- Performance optimization strategies

**Communication Style:**

- Uses technical diagrams and flowcharts
- Focuses on "why" and "what" before "how"
- Provides clear acceptance criteria for features

### 💻 Code Agent

**Responsibilities:**

- Implementation of features and components
- Code refactoring and optimization
- Following established patterns and conventions
- Writing clean, maintainable code

**Communication Style:**

- Provides code snippets with explanations
- References specific files and line numbers
- Explains implementation choices

### 🐛 Debug Agent

**Responsibilities:**

- Identifying and fixing bugs
- Writing and maintaining tests
- Performance analysis and optimization
- Code review and quality assurance

**Communication Style:**

- Uses systematic debugging approaches
- Provides step-by-step analysis
- Suggests test cases and edge cases

### 📚 Documentation Agent

**Responsibilities:**

- Maintaining project documentation
- API documentation and examples
- Code comments and README updates
- Knowledge base management

**Communication Style:**

- Clear, concise technical writing
- Uses markdown formatting effectively
- Provides examples and use cases

## Communication Protocols

### Message Format

All agent communications should follow this structure:

```text
[ROLE] Task Summary
- Context: Brief background
- Action: What was done/changed
- Impact: How this affects the system
- Next Steps: What needs to happen next
```

### File References

When referencing code, use the format:

- `[filename.ext:line_number](relative/path/filename.ext:line_number)` for specific lines
- `[filename.ext](relative/path/filename.ext)` for general file references

### Change Tracking

- Always explain the rationale behind changes
- Reference related issues or requirements
- Note any breaking changes or dependencies

## Development Workflow

### 1. Feature Development

```text
Architect Agent → Defines requirements and design
Code Agent → Implements the feature
Debug Agent → Tests and validates
Documentation Agent → Updates docs
```

### 2. Bug Fixing

```text
Debug Agent → Identifies root cause
Architect Agent → Reviews fix approach (if complex)
Code Agent → Implements fix
Debug Agent → Verifies fix with tests
```

### 3. Refactoring

```text
Architect Agent → Plans refactoring strategy
Code Agent → Executes refactoring
Debug Agent → Ensures no regressions
Documentation Agent → Updates affected docs
```

## Code Standards

### TypeScript/React Conventions

- Use functional components with hooks
- Strict TypeScript typing
- Consistent naming: PascalCase for components, camelCase for variables
- Early returns and guard clauses

### Testing Requirements

- Unit tests for all business logic
- Integration tests for critical flows
- 80%+ code coverage target

### Database/Supabase Guidelines

- Use Row Level Security (RLS) policies
- Follow the bookset isolation model
- Audit fields managed by triggers

## Quality Gates

### Before Merge

- [ ] All tests pass
- [ ] TypeScript compilation clean
- [ ] ESLint rules satisfied
- [ ] Code review completed
- [ ] Documentation updated

### Performance Checks

- [ ] Bundle size within limits
- [ ] No memory leaks
- [ ] UI responsiveness maintained

## Emergency Protocols

### Breaking Changes

If a change breaks existing functionality:

1. Debug Agent investigates immediately
2. Code Agent provides hotfix
3. Architect Agent reviews for systemic issues
4. All agents coordinate rollback if needed

### Security Issues

Security-related changes require:

- Architect Agent security review
- Code Agent implementation with security best practices
- Debug Agent thorough testing

## Tool Usage Guidelines

### When to Use Tools

- **read_file**: Before making changes to understand context
- **search_files**: Finding patterns or specific code
- **execute_command**: Running tests, builds, or scripts
- **apply_diff**: Precise code modifications
- **write_to_file**: Creating new files or complete rewrites

### Tool Coordination

- Avoid redundant tool calls
- Share findings across agents
- Use environment_details for context awareness

## Knowledge Base

### Key Project Files

- `README.md`: Project overview and setup
- `PapasBooks.md`: Detailed design document
- `supabase/schema.sql`: Database schema
- `src/types/`: Type definitions
- `src/lib/`: Core business logic

### Critical Components

- AuthContext: User authentication
- Import system: CSV processing pipeline
- Rules engine: Transaction categorization
- Workbench: Transaction management UI

## Escalation Matrix

| Issue Type     | Primary Agent | Escalation Path   |
| -------------- | ------------- | ----------------- |
| Architecture   | Architect     | Code → Debug      |
| Implementation | Code          | Architect → Debug |
| Testing/Bugs   | Debug         | Architect → Code  |
| Documentation  | Documentation | Any agent         |

## Continuous Improvement

### Retrospective Process

After each major feature/milestone:

1. Review what worked well
2. Identify improvement areas
3. Update this guide as needed
4. Share learnings across agents

### Metrics Tracking

- Development velocity
- Bug rates
- Code quality scores
- User satisfaction (when applicable)

---

_This guide evolves with the project. All agents should contribute to its improvement._
