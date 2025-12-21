Here is the complete Design Document for **Papa’s Books** (Project Name), tailored for a high-complexity, serverless MVP.

---

# Project Design Document: Papa’s Books

**Version:** 1.0
**Target User:** Technical "Bookkeeper" managing finances for a third party.
**Goal:** Accelerate quarterly tax preparation by automating bank data ingestion, categorization, and reconciliation.

---

## 1. Requirements Summary

### 1.1 Core Objectives

1. **Ingest & Normalize:** Import CSVs from multiple distinct banks (Chase, Amex, etc.) into a unified format.
2. **Intelligent Categorization:** Apply "learnable" rules to auto-categorize recurring transactions.
3. **Complex Data Entry:** Support **Split Transactions** (1 transaction -> N Categories) to reflect reality.
4. **Data Integrity:** Prevent duplicates via a staging "Airlock" and ensure accuracy via **Reconciliation** (balancing against PDF statements).
5. **Reporting:** Generate category-based summaries for tax filing.

### 1.2 Constraints & Non-Functional Requirements

* **Architecture:** Serverless (Firebase/Supabase).
* **Client:** Single-page Application (React + TypeScript).
* **Performance:** UI must handle 2,000+ rows without lag; "Excel-like" speed for manual entry.
* **Privacy:** Data isolated per user (standard Auth rules).

---

## 2. Architecture

**Pattern:** "Thick Client" / Serverless
**Philosophy:** The browser performs all business logic (CSV parsing, rule matching, math validation, reconciliation logic). The backend is purely a data store and identity provider.

* **Frontend:** React (Vite), TypeScript, Tailwind CSS, React Query - **Hosted on Vercel**
* **Backend / DB:** Supabase (PostgreSQL with Row Level Security) & Supabase Auth
* **Libraries:** `papaparse` (CSV), `date-fns` (Time), `zod` (Validation), `tanstack-table` (Grid), `@supabase/supabase-js`

---

## 3. Functional Specifications

### 3.1 The "Airlock" (Ingestion Engine)

* **Input:** Drag-and-drop CSV. User selects "Source Account" (e.g., "Chase Checking").
* **Parsing:** Client-side normalization of columns (Date, Desc, Amount) based on selected bank profile.
* **Deduplication (Fuzzy Match):**
* Query DB for existing transactions where `Amount == Row.Amount` AND `Date` is within ±3 days.
* If Match Found: Flag as "Potential Duplicate".


* **Staging UI:** User sees a list of "New" vs. "Skipped (Duplicate)" items. User must explicitly confirm the batch.

### 3.2 The Rules Engine

* **Trigger:** runs automatically during Ingestion AND manually via the Workbench.
* **Logic:**
* If `Description` contains `Rule.Keyword` -> Assign `Rule.Category`.
* If `Rule.Category` is assigned -> Mark `IsReviewed = true`.


* **Learning:** User can highlight a transaction in the Workbench and "Create Rule from Selection".

### 3.3 The Workbench (Transaction Management)

* **View:** Dense data grid. Default filter: `IsReviewed = false`.
* **Inline Editing:** Click cell to edit. `Enter` key saves and moves down.
* **Split Logic:**
* User clicks "Split" icon.
* UI converts the row into a Parent container.
* User adds Child Rows.
* **Validation:** Save is disabled unless .



### 3.4 Reconciliation

* **Input:** User selects Account, enters `Statement Date` and `Statement Ending Balance`.
* **Logic:**
* `Calculated Balance` = `Account.OpeningBalance` + (All Transactions where `Date <= Statement Date`).
* `Difference` = `Statement Ending Balance` - `Calculated Balance`.


* **UI:**
* If `Difference == 0`: Show "Success". User clicks "Finalize" -> Locks all transactions on/before that date (`reconciled = true`).
* If `Difference != 0`: Show "Discrepancy". List unchecked transactions.



---

## 4. Database Design (Supabase PostgreSQL)

All tables use Row Level Security (RLS) policies to ensure tenant isolation via `booksetId` foreign keys.

### 4.1 Collection: `accounts`

*Stores the "containers" for money.*

```typescript
interface Account {
  id: string;
  name: string;             // "Chase Checking"
  type: 'Asset' | 'Liability';
  openingBalance: number;   // The balance on Day 0 (before first import)
  lastReconciledDate: Timestamp | null;
  lastReconciledBalance: number;
}

```

### 4.2 Collection: `categories`

*Master list of buckets.*

```typescript
interface Category {
  id: string;
  name: string;             // "Medical", "Groceries"
  taxLineItem?: string;     // Optional: "Schedule C - Line 7"
}

```

### 4.3 Collection: `transactions`

*The heavy lifter. Supports splits via nested array.*

```typescript
interface Transaction {
  id: string;
  accountId: string;        // Ref to accounts
  date: Timestamp;
  payee: string;            // Normalized vendor name
  originalDescription: string; // Raw bank text (for search/rules)
  amount: number;           // Positive = Deposit, Negative = Expense (or vice versa, standardize this)
  
  // The Split Mechanism
  isSplit: boolean;
  lines: Array<{
    categoryId: string;     // Ref to categories
    amount: number;
    memo?: string;          // Optional note for this specific split
  }>;

  // Metadata
  sourceBatchId: string;    // ID of the import event (for "Undo Import")
  isReviewed: boolean;      // Workflow flag
  reconciled: boolean;      // Locking flag
  fingerprint: string;      // Helper for deduping
}

```

### 4.4 Collection: `rules`

*The brain.*

```typescript
interface Rule {
  id: string;
  keyword: string;          // "homedepot" (lowercase)
  matchType: 'contains' | 'exact';
  targetCategoryId: string;
}

```

---

## 5. UI/UX Design

### 5.1 Design System

* **Visual Density:** High. Use 12px/14px fonts for data. Minimize whitespace in the grid.
* **Input Method:** Keyboard-first.
* `J`/`K` to move selection up/down.
* `Space` to toggle "Reviewed" status.
* `Ctrl+S` to split.



### 5.2 Critical UI Components

#### A. The Import Airlock

* **Visual:** Split screen. Left side: "Ready to Import". Right side: "Detected Duplicates" (Grayed out).
* **Action:** "Import 45 Transactions" (Primary Button).

#### B. The Split Modal

* **Header:** Total Amount (Fixed).
* **Body:** Dynamic list of inputs.
* **Footer:**
* "Remainder": Shows how much is left to allocate. Red if non-zero. Green if $0.00.
* "Save": Disabled if Remainder != 0.



#### C. The Reconcile Wizard

* **Step 1:** Form asking for Statement Date & Balance.
* **Step 2:** "The Scale". An animated balance scale.
* Left side: Calculated Balance.
* Right side: Statement Balance.
* Center: The Difference (Big red text if mismatch).



---

## 6. Testing Strategy

Since this deals with taxes and money, logic errors are unacceptable.

### 6.1 Unit Tests (Jest/Vitest)

* **Split Math:** Verify `sum(lines)` logic handles floating point errors (IEEE 754) correctly. (e.g., $0.10 + $0.20 should not be $0.300000004).
* **Rule Engine:** Ensure keywords match correctly (case-insensitive) and priority is handled if multiple rules match.
* **Deduplication:** Test the fuzzy logic against mock data sets with date shifts.

### 6.2 Integration Tests

* **Import Flow:** detailed test simulating parsing a CSV -> running deduping logic -> generating the Firestore Batch Write payload.
* **Reconciliation:** Mock a set of transactions and an Opening Balance. Verify the `Calculated Balance` function returns the exact expected cent value.

### 6.3 User Acceptance Tests (Manual)

1. **The "Double Import" Test:** Import the same CSV twice. Ensure 100% of the second batch is flagged as Duplicate.
2. **The "Split & Report" Test:** Create a $100 transaction split 50/50. Generate a report. Ensure $50 shows up in Category A and $50 in Category B.