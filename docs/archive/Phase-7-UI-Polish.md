# Phase 7: UI/UX Polish & Design System (Senior-Friendly)

**Status:** Complete
**Dependencies:** Phase 1-6 (Core Functionality)
**Estimated Complexity:** High
**Reference:** [Implementation-Plan.md](Implementation-Plan.md)

---

## Overview

Phase 7 transforms the functional "skeleton" of Papa's Books into an accessible, highly legible, and easy-to-use application designed specifically for senior users. We will implement a design system using **Tailwind CSS**.

**Key Principles:**

1. **Legibility First:** We prioritize font size and contrast over information density. Text should be readable without reading glasses (Base 18px).
2. **Large Touch Targets:** Buttons and inputs must be large (min 48px height) and easy to click/tap, accommodating reduced motor precision.
3. **Adaptive Layouts:**
   - **Desktop:** Spacious tables with clear grid lines.
   - **Mobile:** "Card View" transforming rows into large, touch-friendly blocks.
4. **Clarity:** Use distinct colors and clear text labels (avoiding icon-only buttons where possible).

---

## 1. Design System Foundation

### Tailwind Configuration

- **Typography:**
  - Font Family: System UI (San Francisco/Segoe UI) for native familiarity.
  - Base Size: **18px** (Tailwind `text-lg` as default).
  - Headings: **24px - 32px** with heavy weight.
- **Color Palette (High Contrast):**
  - **Backgrounds:** White / Slate-50.
  - **Text:** Slate-900 (Nearly Black) for primary text, Slate-600 for secondary. No light grays for text.
  - **Primary Action:** Sky-600 (Bright Blue) for clear call-to-action.
  - **Borders:** Slate-300 (High visibility borders).
- **Spacing:**
  - Generous padding (`p-4` / `1rem`) standard container spacing.
  - Gap `gap-4` or `gap-6` to prevent accidental clicks.

### Global Styles

- **Focus Rings:** Thick, high-contrast focus rings for keyboard/accessibility navigation.
- **Scrollbars:** Standard OS scrollbars (easier to grab than thin custom ones).

---

## 2. Core Layout & Navigation

### App Shell

- **Desktop Navigation:**
  - Permanent Sidebar.
  - Large text labels (e.g., "Transactions", "Reports") alongside large icons (32px).
- **Mobile Navigation:**
  - Sticky Bottom Navigation Bar.
  - Large icons with clear text labels underneath.
- **Header:**
  - Simplified. Large "Bookset Switcher" dropdown.

---

## 3. Component Library

We will replace native HTML elements with accessible React components:

| Category    | Design Specs                                                                                               |
| :---------- | :--------------------------------------------------------------------------------------------------------- |
| **Buttons** | **Height:** 48px+. **Text:** Bold, 18px. **Style:** Solid colors for primary, thick borders for secondary. |
| **Inputs**  | **Height:** 50px+. **Borders:** 2px solid Slate-300. **Focus:** Thick blue ring.                           |
| **Cards**   | White background, rounded corners (xl), shadow-sm, 1px border. Used for mobile list items.                 |
| **Badges**  | Large pills with solid colors (e.g., "Dining Out" in Blue bg/White text) for high readability.             |
| **Modals**  | Full-screen overlays on mobile, large centered dialogs on desktop. Close buttons must be prominent.        |

---

## 4. Page-Specific Enhancements

### Dashboard

The dashboard is the default landing page and answers "How am I doing right now?" in one glance.

**Layout (Desktop):**

- **Row 1: KPI Cards (4-up):** Large summary cards with 30px+ numbers.
- **Row 2: Alerts + Quick Actions:** Left = Alerts/Tasks, Right = Action Tiles.
- **Row 3: Trends + Recent Activity:** Left = Spending Trend, Right = Recent Transactions.

**Layout (Mobile):**

- Single-column stack with cards as full-width blocks.
- Alerts appear before charts to surface action items early.

**KPI Cards (Required):**

1. **Total Cash** (sum of cash accounts)
2. **Net Income** (income total - expense total for selected range)
3. **Net Expenses** (expense total for selected range)
4. **Uncategorized** (count of uncategorized transactions)

- Each card includes: title, value, and a small delta (e.g., "vs last month").

**Time Range Control:**

- Segmented buttons: **Month**, **Quarter**, **Year**.
- Period toggle: **Current** / **Prior** (affects the selected range).
- Applies to trend charts and delta values.

**Alerts / Tasks (Required):**

- "X transactions need categories"
- "Reconcile account: [Account Name]"
- "Import pending review"
- Each alert is a large, tappable card linking to its workflow.

**Quick Action Tiles (Required):**

- "Import CSV", "Add Transaction", "Reconcile", "View Reports"
- 2x2 grid on desktop, single-column on mobile.

**Trends (Minimum):**

- **Spending Trend:** Simple line chart, high contrast, no tiny labels.
- **Top Categories:** 3-5 list items with bold amounts (no dense pie charts).

**Recent Activity:**

- 5 most recent transactions, with date, payee, amount, and category badge.
- Tap a row to open the Workbench detail view.

**Empty/Loading/Error States:**

- Empty: Large friendly message + primary action (e.g., "Import your first CSV").
- Loading: Text "Loading dashboard..." with spinner.
- Error: Red banner with plain English and retry button.

### Workbench (The Adaptive Grid)

_The challenge: displaying complex tables on small screens with large fonts._

- **Desktop View (Table):**
  - Spacious rows (60px height).
  - Zebra striping or distinct borders for line tracking.
  - Large "Action" buttons in the last column.
- **Mobile View (Cards):**
  - **Transformation:** The table disappears.
  - **Card List:** Each transaction is rendered as a distinct card.
    - Top: Date & Amount (Big Bold).
    - Middle: Payee Name.
    - Bottom: Category Badge & "Mark Reviewed" full-width button.

### Settings

- **Tabs:** Large, pill-shaped toggle buttons instead of thin text tabs.
- **Forms:** Single-column layout. One question per line.
- **Toggles:** Large "Switch" controls instead of tiny checkboxes.

### Import (Airlock)

- **Drag-and-drop:** Massive target area with huge icon.
- **Wizard Steps:** Clearly labeled "Step 1", "Step 2" with progress bars.
- **Review:** Uses the "Card View" logic for duplicate checking on mobile.

### Reconciliation Wizard

- **The "Balance" Indicator:**
  - **Matched:** Big Green Checkmark.
  - **Unmatched:** Big Red Text showing the difference.
- **Inputs:** Large currency inputs with fixed decimal handling.

---

## 5. User Experience (Micro-interactions)

- **Feedback:**
  - **Toasts:** Large, sticky notifications at the top/bottom (e.g., "Saved Successfully" with Green background).
  - **Loading:** Explicit text "Loading..." with spinner, not just a spinner.
- **Error Handling:**
  - Input borders turn Red.
  - Helper text below input explains the error in plain English.

---

## 6. Success Criteria

1. **Legibility:** Text passes WCAG AAA contrast ratio. 18px base size.
2. **Touch Accuracy:** No interactive element is smaller than 44x44px.
3. **Mobile Usability:** User can perform a full workflow (Import -> Categorize -> Report) on a phone using the Card View.
4. **Simplicity:** No hidden menus or hover-only actions. Everything visible is clickable.
