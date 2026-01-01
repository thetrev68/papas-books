# Implementation Plan: Mileage Deduction Tracker

**Feature:** Mileage Deduction Tracker
**Priority:** Nice to Have
**Effort:** Medium (4-5 days)

## Objective

Log business mileage to calculate Schedule C deductions using the IRS standard mileage rate.

## Technical Implementation

### 1. Database Schema (`supabase/schema.sql`)

New table `mileage_logs`.

```sql
CREATE TABLE public.mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bookset_id uuid REFERENCES public.booksets(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  description text,
  start_odometer int,
  end_odometer int,
  distance_miles numeric(10, 2) NOT NULL,
  purpose text CHECK (purpose IN ('business', 'medical', 'charity', 'moving', 'personal')),
  vehicle text,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

-- RLS Policies
ALTER TABLE public.mileage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read mileage" ON public.mileage_logs FOR SELECT USING (user_can_read_bookset(bookset_id));
CREATE POLICY "Editors can write mileage" ON public.mileage_logs FOR ALL USING (user_can_write_bookset(bookset_id));
```

### 2. UI - New Page (`src/pages/MileagePage.tsx`)

Create a simple CRUD page.

**Components:**

- **Log List Table:** Date, Trip Description, Miles, Purpose.
- **Add Trip Modal:** Form inputs.
- **Summary Cards:** Total Business Miles, Total Deduction (Miles \* Rate).

**State/Hooks:**
Create `useMileageLogs` hook similar to `useTransactions`.

**Tax Rate Config:**
The standard rate changes year to year (e.g. 67 cents for 2024).
We can hardcode a lookup table in `src/lib/taxRates.ts` or allow user input.

```typescript
// src/lib/taxRates.ts
export const MILEAGE_RATES = {
  2024: 0.67,
  2023: 0.655,
  // ...
};

export function getRate(year: number) {
  return MILEAGE_RATES[year as keyof typeof MILEAGE_RATES] || 0.67;
}
```

### 3. Integration

Add "Mileage" to the main navigation menu (`AppLayout.tsx`?).

## Verification

1. Add a trip: 100 miles, Business, 2024.
2. Check calculation: 100 \* 0.67 = $67.00 deduction.
3. Edit trip.
4. Delete trip.

## Files to Modify

- `src/pages/MileagePage.tsx` (New)
- `src/components/AppLayout.tsx` (Add nav link)
- `supabase/migrations/xxxx_mileage_logs.sql`
