# Phase 7: UI/UX Polish & Design System

**Status:** Planned
**Dependencies:** Phase 1-6 (Core Functionality), Phase 8 (Advanced Features)
**Estimated Complexity:** High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md)

---

## Overview

Phase 7 transforms the functional "skeleton" of Papa's Books into a professional, cohesive, and visually appealing application. We will implement a design system based on **Material Design principles** using **Tailwind CSS**.

**Key Principles:**

1. **High Density:** Bookkeeping requires seeing lots of data. We prioritize information density over whitespace.
2. **Consistency:** Standardized components for buttons, inputs, cards, and tables.
3. **Clarity:** Use color meaningfully (Green for income, Red for expenses/errors, Blue for actions).
4. **Responsiveness:** Optimize for desktop first (main workspace), but ensure usability on tablets and mobile for quick checks.

---

## 1. Design System Foundation

### Tailwind Configuration

- Define a professional color palette:
  - **Primary:** Deep Indigo/Slate.
  - **Secondary:** Emerald/Teal (Positive).
  - **Accent:** Amber/Rose (Alerts).
  - **Neutrals:** Multi-step gray scale for borders and backgrounds.
- Configure typography: Inter or System UI stack (San Francisco/Segoe UI).
- Set base font size to 14px for high density.

### Global Styles

- Refined scrollbars (thin, subtle).
- Focus ring states for accessibility.
- Smooth transitions for modals and dropdowns.

---

## 2. Core Layout & Navigation

### App Shell

- **Navigation:** Transition from unstyled links to a professional Sidebar (collapsible) or Top Nav.
- **Header:** Include the Bookset Switcher, User Profile, and Global Search.
- **Loading State:** Implement a global progress bar (nprogress style) or skeleton screens for data-heavy pages.

---

## 3. Component Library

We will replace native HTML elements with styled React components:

| Category         | Components                                                         |
| :--------------- | :----------------------------------------------------------------- |
| **Buttons**      | Primary, Secondary, Ghost, Danger, Icon-only                       |
| **Inputs**       | Text, Number (with currency symbol), Date, Select, Checkbox, Radio |
| **Feedback**     | Toast notifications (styled GlobalToast), Inline alerts, Tooltips  |
| **Data Display** | Cards, Tables (styled TanStack rows), Badges (for categories/tags) |
| **Overlays**     | Modals, Dropdowns, Context Menus (right-click on transactions)     |

---

## 4. Page-Specific Enhancements

### Dashboard

- **Summary Cards:** "Total Cash", "Net Income (This Month)", "Unreviewed Count".
- **Mini-Charts:** Simple SVG sparklines or bar charts for monthly trends.
- **Quick Actions:** "Import CSV", "Add Transaction".

### Workbench (The Grid)

- **High-Density Rows:** 32px-36px row height.
- **Cell Highlighting:** Subtle hover effects and distinct "Selected" state.
- **Inline Editing:** Visual cues (blue border) when a cell is in edit mode.
- **Filter Bar:** Collapsible sidebar or horizontal strip with "Chip" style filters.

### Reconciliation Wizard

- **Step Indicator:** Visual "Breadcrumb" showing Step 1, 2, 3.
- **The "Balance" Indicator:** Large, clear display of the current Difference.
- **Animation:** Subtle success animation (check mark) when balanced.

### Reports

- **Print Styles:** Ensure reports look perfect when printed to PDF or paper (hide nav, simplify colors).
- **Interactive Tables:** Row highlighting and sort indicators.

---

## 5. User Experience (Micro-interactions)

- **Keyboard Shortcuts Dialog:** A "Help" modal (triggered by `?`) showing all available shortcuts.
- **Empty States:** Helpful illustrations and text when there are no transactions or accounts.
- **Optimistic UI:** Instant feedback when marking reviewed or deleting (already partially in Phase 5, but needs visual polish).

---

## Success Criteria

1. **Consistency:** Every button and input follows the same theme.
2. **Performance:** No significant layout thrashing during transitions.
3. **Density:** The user can see at least 20 transactions on a standard 1080p screen without scrolling.
4. **Accessibility:** Contrast ratios meet WCAG 2.1 AA where possible.
5. **Professionalism:** The app no longer looks like a "coding project" and looks like a "product".
