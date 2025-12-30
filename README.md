# Papa's Books

[![CI](https://github.com/thetrev68/papas-books/actions/workflows/ci.yml/badge.svg)](https://github.com/thetrev68/papas-books/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/thetrev68/papas-books/branch/main/graph/badge.svg)](https://codecov.io/gh/thetrev68/papas-books)
[![E2E Tests](https://github.com/thetrev68/papas-books/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/thetrev68/papas-books/actions/workflows/e2e-tests.yml)

A multi-user bookkeeping system built for speed, accuracy, and seamless collaboration between users and tax professionals.

## 🚀 Overview

Papa's Books is a modern web application designed to simplify financial tracking for individuals and businesses. It features a unique "Bookset" architecture that allows users (like CPAs) to manage multiple independent sets of books from a single account.

### Key Features

- **Multi-User Access Control**: Securely share your booksets with editors or viewers.
- **Bookset Switching**: Seamlessly toggle between different clients or business entities.
- **Rules-Based Categorization**: Automated transaction processing with high-priority matching.
- **CSV Mapping**: Per-account CSV configuration to handle diverse bank formats.
- **Tax Integration**: Map categories directly to tax line items (e.g., Schedule C).

## 🛠 Tech Stack

- **Frontend**: React (v18), TypeScript, Vite
- **Routing**: React Router v6
- **State Management**: React Context & Hooks
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Deployment**: Vercel
- **Testing**: Vitest (96% coverage), Playwright (E2E)

## 🏗 Architecture

### Bookset Model

Unlike traditional apps where data is tied directly to a user, Papa's Books ties data to a `Bookset`.

- Every user owns a personal bookset.
- Users can be granted access to other booksets via `access_grants`.
- Row Level Security (RLS) ensures data isolation at the database level.

### Security

- **RLS (Row Level Security)**: PostgreSQL policies enforce that users can only read or write data they have explicit permission for.
- **Database Triggers**: Audit fields (`created_by`, `updated_at`) are managed automatically via PL/pgSQL triggers to ensure data integrity.

## 🚦 Getting Started

### Prerequisites

- Node.js (Latest LTS)
- A Supabase Project

### Local Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/thetrev68/papas-books.git
   cd papas-books
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env.local` file in the root:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Initialize Database**
   Copy the contents of `supabase/schema.sql` and run it in your Supabase SQL Editor.
   _Note: Ensure "Confirm Email" is disabled in Supabase Auth settings for local development._

5. **Run Development Server**

   ```bash
   npm run dev
   ```

## 🧪 Testing

### Test Coverage

Papa's Books has **97%+ code coverage** with 221 passing tests:

- **Unit Tests:** 20 test files covering business logic, validation, and utilities
- **E2E Tests:** 4 Playwright tests covering critical user workflows
- **Coverage:** 97.43% lines, 96.62% functions, 90.54% branches, 97.45% statements

### Running Tests

**Unit Tests** (Vitest):

```bash
npm run test              # Run tests in watch mode
npm run test:ui           # Interactive UI mode
npm run test:coverage     # Generate coverage report
```

**⚠️ Windows Users:** Coverage tools (v8/istanbul) have compatibility issues on Windows. For accurate coverage metrics, run tests in WSL:

```bash
wsl --exec bash -c "cd /mnt/c/Repos/papas-books && npm run test:coverage"
```

**E2E Tests** (Playwright):

```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Interactive mode
npm run test:e2e:report   # View HTML report
```

**Full Test Suite:**

```bash
npm run lint && npm run test -- --run && npm run test:e2e
```

For more details, see [Testing Strategy Documentation](docs/testing-strategy.md).

## 🗺 Roadmap

- **Phase 1**: Foundation & Auth (Complete ✅)
- **Phase 2**: Accounts, Categories & Access Management
- **Phase 3**: CSV Import & Data Normalization
- **Phase 4**: Rule Engine
- **Phase 5**: Workbench & Transaction Management
- **Phase 6**: Reconciliation & Reporting
- **Phase 7**: Visual Polish & Design System

---

🤖 _Built with AI-assisted development (Gemini 2.0 Flash)._
