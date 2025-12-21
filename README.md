# Papa's Books

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
- **Testing**: Vitest

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
   *Note: Ensure "Confirm Email" is disabled in Supabase Auth settings for local development.*

5. **Run Development Server**
   ```bash
   npm run dev
   ```

## 🧪 Testing

Run unit tests with Vitest:
```bash
npm run test
```

For interactive UI mode:
```bash
npm run test:ui
```

## 🗺 Roadmap

- **Phase 1**: Foundation & Auth (Complete ✅)
- **Phase 2**: Accounts, Categories & Access Management
- **Phase 3**: CSV Import & Data Normalization
- **Phase 4**: Rule Engine
- **Phase 5**: Workbench & Transaction Management
- **Phase 6**: Reconciliation & Reporting
- **Phase 7**: Visual Polish & Design System

---
🤖 *Built with AI-assisted development (Gemini 2.0 Flash).*