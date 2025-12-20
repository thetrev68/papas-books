# Papa's Books - Implementation Plan

**Version:** 1.1
**Purpose:** High-level phased approach for MVP delivery
**Reference:** [PapasBooks.md](PapasBooks.md)

---

## Overview

This plan breaks the Papa's Books MVP into 7 sequential phases, each delivering working functionality that builds on the previous phase. Each phase is designed to be independently testable and provides incremental value.

**Architecture Approach:**

- Multi-page application with tabbed interfaces within major sections
- Phases 1-6: Minimal/unstyled UI (basic HTML forms, native tables, no Tailwind styling)
- Phase 7: Comprehensive UI/UX polish with design system implementation

**Separation of Concerns:**

- Business logic and data operations built first
- Visual design applied as a separate layer after functionality is proven
- Ensures testable, maintainable code with clear boundaries

**Estimated Total Scope:** Medium-to-Large (6-8 weeks for experienced developer)

---

## Phase 1: Foundation & Authentication

**Goal:** Establish the technical foundation and user access control

### Deliverables

- Firebase project setup (Firestore, Auth, Security Rules)
- React + TypeScript + Vite project scaffold
- Minimal HTML/CSS only (no Tailwind in this phase)
- Firebase Authentication (email/password)
- React Router with protected routes
- Basic navigation structure (multi-page with simple links)
- Page structure: Dashboard, Settings, Import, Workbench, Reconcile, Reports

### Success Criteria

- User can register, login, and logout
- Security rules prevent unauthorized data access
- All dependencies installed and configured
- Build/dev pipeline working
- Can navigate between pages (unstyled but functional)

---

## Phase 2: Account & Category Management

**Goal:** Enable users to define their financial structure

### Phase 2 Deliverables

- `accounts` collection CRUD operations (business logic)
- `categories` collection CRUD operations (business logic)
- Settings page with tabs: Accounts, Categories, Rules (basic tab switcher)
- Simple HTML forms for create/edit (unstyled inputs and buttons)
- Native HTML tables for listing accounts/categories
- Data validation with Zod schemas
- React Query integration for data fetching
- Delete confirmation (browser confirm dialog)

### Phase 2 Success Criteria

- User can create multiple accounts with opening balances
- User can define custom category hierarchy
- Data persists correctly in Firestore
- Real-time updates reflected in UI
- Tab navigation works on Settings page

---

## Phase 3: The Airlock (CSV Import & Deduplication)

**Goal:** Enable secure transaction ingestion with duplicate prevention

### Phase 3 Deliverables

- Bank profile definitions (Chase, Amex column mappings) - pure TypeScript
- Import page with basic file input (accept CSV)
- Account selector dropdown (HTML select)
- PapaParse integration and normalization logic
- Fingerprint generation algorithm (pure function)
- Fuzzy duplicate detection (±3 day window, amount matching) - pure function
- Staging UI: two native HTML tables side-by-side (New | Duplicates)
- Batch import confirmation button
- `sourceBatchId` generation and tracking
- Transaction creation in Firestore

### Phase 3 Success Criteria

- User can upload CSV and see parsed preview in tables
- Duplicate transactions flagged correctly (pass "Double Import" test)
- Batch imports create transactions with proper metadata
- No duplicate transactions in database after confirmation
- Business logic separated from UI (testable functions)

---

## Phase 4: The Rules Engine

**Goal:** Automate transaction categorization through learnable rules

### Phase 4 Deliverables

- `rules` collection CRUD operations (business logic)
- Rule matching engine (keyword-based, case-insensitive) - pure function
- Auto-categorization during import (integrate with Phase 3)
- Manual "Run Rules" button on Workbench page
- "Create Rule from Selection" button (simple form)
- `isReviewed` flag auto-set when rule matches *configurable in settings!
- Rules tab on Settings page (add to existing tabs)
- Rules list as native HTML table with edit/delete buttons
- Rule testing function (pure logic)

### Phase 4 Success Criteria

- Rules correctly match transaction descriptions
- Imported transactions auto-categorized when rules exist
- User can create rules from existing transactions
- Rule priority/conflict resolution works as expected
- All rule logic is testable (separated from UI)

---

## Phase 5: The Workbench (Transaction Management & Splits)

**Goal:** Provide Excel-like interface for transaction review and complex categorization

### Phase 5 Deliverables

- TanStack Table integration with virtualization (2000+ row performance)
- Workbench page with native table rendering (no styling)
- Filter controls: checkboxes/dropdowns for isReviewed, account, date range
- Inline editing with contentEditable or simple inputs
- Keyboard navigation (J/K, Enter, Space, Ctrl+S) - event handlers
- Split transaction business logic
  - Split math calculator (pure function, handles floating point)
  - Validation: `sum(split.lines) === parent.amount`
  - Split data structure creation/update
- Split transaction UI
  - "Split" button opens basic modal/dialog
  - Simple form with add/remove split lines
  - Remainder display (plain text, color via inline style if needed)
  - Save/Cancel buttons (disabled state logic)
- Payee field inline editing
- "Mark Reviewed" checkbox per row
- Bulk operations (select multiple, mark all reviewed)

### Phase 5 Success Criteria

- Grid handles 2000+ transactions without lag (virtualization works)
- Inline editing feels responsive (Excel-like)
- Split math validates correctly (passes "Split & Report" test)
- `sum(split.lines) === parent.amount` enforced before save
- Keyboard shortcuts work as specified
- All business logic in separate testable modules

---

## Phase 6: Reconciliation & Reporting

**Goal:** Ensure data accuracy and generate tax-ready outputs

### Phase 6 Deliverables

- Reconciliation page with simple wizard flow
  - Step 1: Form with account dropdown, date input, balance input
  - Step 2: Calculation display (two columns of numbers, difference shown)
  - Step 3: Transaction list (if mismatch) or success message
- Calculated balance function (pure function: opening + filtered transactions)
- Balance calculation engine (handles split transactions correctly)
- Discrepancy highlighting (simple list of unchecked transactions)
- "Finalize" button that locks transactions (`reconciled = true`)
- Locking mechanism (Firestore update, UI validation)
- Reports page with basic controls
  - Date range inputs
  - Category selector
  - Account filter
- Report generation logic (pure functions)
  - Category-based summary calculation
  - Split transaction allocation
  - Tax line item grouping (optional)
- Report display as native HTML table
- Export to CSV (simple download)
- Export to PDF (basic library like jsPDF)

### Phase 6 Success Criteria

- Reconciliation math is cent-perfect
- User can successfully reconcile an account and lock transactions
- Reports accurately reflect split transaction allocations
- $100 split 50/50 shows $50 in Category A and $50 in Category B
- Locked transactions cannot be edited (validation prevents it)
- All calculation logic is pure functions (fully testable)

---

## Phase 7: UI/UX Polish & Design System

**Goal:** Transform functional MVP into a polished, professional application

### Phase 7 Deliverables

- Tailwind CSS integration and configuration
- Design system implementation
  - Color palette (neutral + accent colors)
  - Typography scale (matching high-density requirements)
  - Spacing system
  - Component variants (buttons, inputs, tables)
- Navigation redesign (sidebar or top nav with proper styling)
- Dashboard page design and implementation
  - Account balance summaries
  - Recent transactions preview
  - Quick action buttons
- Settings page UI polish
  - Tab component with proper styling
  - Form redesign (labeled inputs, validation states)
  - Improved table layouts with hover states
- Import page "Airlock" visual design
  - Drag-and-drop zone styling
  - Split-screen layout (New vs Duplicates)
  - Progress indicators
- Workbench dense data grid styling
  - High-density design (12px/14px fonts)
  - Row hover/selection states
  - Inline edit mode indicators
  - Filter panel design
- Split transaction modal redesign
  - Clean modal layout
  - Remainder indicator (red/green states)
  - Improved split line inputs
- Reconciliation "Scale" visual design
  - Animated balance scale component
  - Clear success/error states
  - Step indicator for wizard flow
- Reports page styling
  - Clean table layouts
  - Export button design
  - Print-friendly CSS
- Responsive design considerations (desktop-first, tablet support)
- Loading states and error messages
- Success/error toast notifications

### Phase 7 Success Criteria

- Application has consistent, professional appearance
- All interactive elements have clear hover/active/disabled states
- High-density workbench maintains readability
- Forms provide clear validation feedback
- Application is usable on tablet-sized screens (optional: mobile)
- No functional regressions from UI changes
- Performance remains excellent (no layout thrashing)

---

## Post-MVP Enhancements (Future Phases)

### Phase 8: Advanced Features

- Multi-user support (bookkeeper + client role separation)
- Audit trail / change history
- Attachments (receipt images linked to transactions)
- Scheduled reports / email delivery
- Advanced rule types (amount ranges, date patterns, regex)
- Undo import functionality (rollback by sourceBatchId)
- Budget tracking against categories
- Bank account balance tracking over time
- Recurring transaction templates

### Phase 9: Performance & Experience

- Offline support (local-first with sync)
- Advanced search/filtering (full-text search)
- Keyboard shortcut customization
- Dark mode
- Accessibility improvements (WCAG 2.1 AA compliance)
- Mobile responsive design (full support)
- Progressive Web App (PWA) capabilities
- Advanced data visualizations (charts, graphs)

---

## Implementation Notes

### Critical Path Dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 5 (can't build Workbench without transactions)
- Phase 4 (Rules) can partially overlap with Phase 5
- Phase 6 depends on Phase 5 completion (needs split transactions working)
- Phase 7 requires Phases 1-6 complete (cannot style what doesn't exist)

### Code Organization Philosophy

**Business Logic Layer** (pure functions, no UI dependencies)

- `/src/lib/calculations/` - Math operations (balance, splits, reconciliation)
- `/src/lib/import/` - CSV parsing, normalization, deduplication
- `/src/lib/rules/` - Rule matching engine
- `/src/lib/validation/` - Zod schemas and validators
- `/src/lib/firebase/` - Firestore operations (queries, mutations)

**UI Layer** (React components, minimal logic)

- `/src/pages/` - Page components (routing targets)
- `/src/components/` - Reusable UI components
- `/src/hooks/` - React Query hooks for data fetching

**Testing Strategy**

- Business logic: 100% unit test coverage (Vitest)
- UI components: Test interactions, not styling (React Testing Library)
- Integration tests: Critical user flows (import → categorize → reconcile)

### Testing Checkpoints

Each phase should include:

- Unit tests for all business logic functions (Vitest)
- Component tests for interactive UI elements (React Testing Library)
- Integration tests where applicable
- Manual QA against Success Criteria
- Performance testing for Phases 3 & 5 (large datasets)

### Risk Areas Requiring Extra Attention

1. **Floating-point precision** in split transactions (Phase 5)
2. **Performance** of the data grid with 2000+ rows (Phase 5)
3. **Security rules** ensuring proper user isolation (Phase 1)
4. **Duplicate detection accuracy** avoiding false positives (Phase 3)
5. **Reconciliation math** must be exact to the cent (Phase 6)
6. **Business logic coupling** - Keep UI and logic completely separate

---

## Next Steps

Once this plan is approved, create detailed phase documents:

- `Phase-1-Foundation.md`
- `Phase-2-Accounts-Categories.md`
- `Phase-3-Airlock.md`
- `Phase-4-Rules-Engine.md`
- `Phase-5-Workbench.md`
- `Phase-6-Reconciliation.md`
- `Phase-7-UI-Polish.md`

Each phase document will include:

- Detailed task breakdowns with acceptance criteria
- File structure and component architecture
- Data flow diagrams (business logic → UI → Firestore)
- Specific test cases and test data
- Code snippets and implementation examples
- UI wireframes/mockups (Phase 7 only)
