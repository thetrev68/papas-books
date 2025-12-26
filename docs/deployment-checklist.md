# Production Deployment Checklist

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Project:** Papa's Books
**Target Platform:** Vercel (Frontend) + Supabase (Backend)

---

## Table of Contents

1. [Pre-Deployment (1 Week Before)](#pre-deployment-1-week-before)
2. [Supabase Security & Performance Issues](#supabase-security--performance-issues)
3. [Database Preparation](#database-preparation)
4. [Configuration & Environment](#configuration--environment)
5. [Deployment Day Checklist](#deployment-day-checklist)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring Setup](#monitoring-setup)
8. [Rollback Procedure](#rollback-procedure)

---

## Pre-Deployment (1 Week Before)

### Code Quality

- [ ] All tests passing

  ```bash
  npm run test              # Unit tests
  npm run test:e2e          # E2E tests (Playwright)
  ```

- [ ] No TypeScript errors

  ```bash
  npm run build
  ```

- [ ] No ESLint warnings

  ```bash
  npm run lint
  ```

- [ ] Code formatted

  ```bash
  npm run format:check
  ```

- [ ] No unused dependencies

  ```bash
  npm run knip
  ```

### Performance Testing

- [ ] Load testing with 10k+ transactions completed

  ```bash
  # Generate test data
  npx tsx scripts/seed-large-dataset.ts <bookset-id> <account-id> 10000
  ```

- [ ] Workbench loads in < 2 seconds with large dataset
- [ ] Reports pagination working (tested with 5k+ rows CSV)
- [ ] No memory leaks in browser DevTools
- [ ] Lighthouse performance score > 80

### Security Verification

- [ ] RLS policies tested and documented (See `docs/rls-test-results.md`)
- [ ] CSV input sanitization verified
- [ ] All Supabase errors show user-friendly messages
- [ ] No exposed secrets in codebase (check .env files)
- [ ] Security audit completed (Task 3.7)

---

## Supabase Security & Performance Issues

> **STATUS:** Documented and resolved (see [docs/supabase-issues-resolution.md](./supabase-issues-resolution.md))

### Security Issues (2 Items) - ⚠️ ACCEPTED RISKS

- [x] **Issue 1: Leaked Password Protection** - ⚠️ **ACCEPTED RISK**
  - **Status:** Requires Supabase Pro Plan (~$25/month) - no budget available
  - **Mitigation:** Strong client-side validation (12+ chars, complexity requirements)
  - **Documented in:** [docs/supabase-issues-resolution.md](./supabase-issues-resolution.md#security-issue-1-leaked-password-protection-disabled)
  - **Risk Level:** MEDIUM (acceptable for MVP with strong password requirements)

- [x] **Issue 2: Insufficient MFA Options** - 🟢 **DEFERRED**
  - **Status:** Optional for MVP, deferred to Q1 2026 post-launch
  - **Documented in:** [docs/supabase-issues-resolution.md](./supabase-issues-resolution.md#security-issue-2-insufficient-mfa-options)
  - **Risk Level:** LOW (MFA nice-to-have, not required for personal finance app MVP)

**Known Limitation:** Both security alerts will remain in Supabase dashboard. This is expected and documented.

### Performance Issues (8 Items) - ✅ READY TO FIX

**All performance issues documented with solutions. Execute before deployment:**

- [ ] **Run Performance Optimization Migration (1 hour)**
  - File: [supabase/migration_rls_performance_optimization.sql](../supabase/migration_rls_performance_optimization.sql)
  - Copy entire file into Supabase SQL Editor and execute
  - This fixes ALL 8 performance issues in one script
  - **Details:** [docs/supabase-issues-resolution.md](./supabase-issues-resolution.md#consolidated-action-plan)

- [ ] **Verify All Performance Alerts Cleared (5 minutes)**
  - Navigate to Supabase Dashboard → Database → Query Performance
  - Confirm 0 performance alerts (should all be cleared by migration)
  - Run verification queries from migration file to confirm optimization
  - See testing checklist in [docs/supabase-issues-resolution.md](./supabase-issues-resolution.md#pre-deployment-verification)

**Summary:**

- **Total Issues:** 10 (2 security + 8 performance)
- **Security:** 2 accepted risks/deferred (documented with mitigation strategies)
- **Performance:** 8 issues resolved by single migration file
- **Action Required:** Run migration script (~1 hour total)
- **Expected Result:** 8 performance alerts cleared, 2 security alerts remain (expected and documented)

**Full Documentation:** See [docs/supabase-issues-resolution.md](./supabase-issues-resolution.md) for complete details on all issues, solutions, and risk assessments

### Performance Issue 1: [Title]

- **Query/Operation:** [What's slow]
- **Current Performance:** [e.g., 2.5s query time]
- **Root Cause:** [Why it's slow]
- **Fix Applied:** [Index added, query rewritten, etc.]
- **New Performance:** [e.g., 150ms query time]
- **Status:** ✅ Resolved / 🟡 In Progress / ❌ Not Started
```

---

## Database Preparation

### Schema & Migrations

- [ ] Production schema matches `supabase/production_schema.sql`
- [ ] All migrations applied to production Supabase project
  - [ ] Core schema (tables, columns, constraints)
  - [ ] RLS policies enabled on all tables
  - [ ] Database triggers (audit, change_history)
  - [ ] Performance indexes
  - [ ] Seed data (default categories)

### Database Backup

- [ ] **Create full database backup**
  - Supabase Dashboard → Database → Backups
  - Click "Create Backup" (manual backup point)
  - Download backup locally for safety
  - Verify backup can be restored to staging environment

### Performance Indexes

- [ ] Verify all indexes created (check with SQL query):

  ```sql
  SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
  ```

- [ ] Expected indexes:
  - `idx_transactions_bookset_account_date`
  - `idx_transactions_fingerprint`
  - `idx_transactions_bookset_reviewed`
  - `idx_rules_bookset_priority`
  - `idx_categories_bookset_parent`
  - `idx_access_grants_user_bookset`
  - And others from `production_schema.sql`

### Audit Triggers

- [ ] Verify change history triggers are enabled:

  ```sql
  SELECT
    trigger_name,
    event_object_table,
    action_statement
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'track_%_changes';
  ```

---

## Configuration & Environment

### Supabase Configuration

- [ ] **Authentication Settings**
  - [ ] Email verification ENABLED
  - [ ] Email template customized with branding
  - [ ] Redirect URL set to production domain
  - [ ] Password requirements configured (min 12 chars)
  - [ ] Rate limiting enabled (e.g., 5 login attempts per hour)

- [ ] **Security Settings**
  - [ ] CORS configured for production domain only
  - [ ] API rate limits reviewed
  - [ ] Service role key secured (not exposed in frontend)
  - [ ] JWT expiration set appropriately (e.g., 1 hour)

- [ ] **Database Settings**
  - [ ] Connection pooling configured (Supavisor enabled)
  - [ ] Statement timeout set (e.g., 30 seconds)
  - [ ] Idle transaction timeout set

### Vercel Configuration

- [ ] **Environment Variables Set**

  ```bash
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

- [ ] **Build Settings**
  - [ ] Node.js version: 20.x or higher
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
  - [ ] Install command: `npm ci`

- [ ] **Domain Configuration**
  - [ ] Custom domain configured (e.g., app.papasbooks.com)
  - [ ] SSL certificate valid
  - [ ] DNS records propagated

### Security Headers

- [ ] Verify Vercel security headers configured in `vercel.json`:

  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Permissions-Policy",
            "value": "camera=(), microphone=(), geolocation=()"
          }
        ]
      }
    ]
  }
  ```

---

## Deployment Day Checklist

### T-Minus 2 Hours: Final Verification

- [ ] **Code Review**
  - [ ] Pull latest from main branch
  - [ ] Review recent commits for any last-minute changes
  - [ ] No debugging code (console.log, debugger statements)
  - [ ] No TODO comments blocking deployment

- [ ] **Local Testing**
  - [ ] Run full test suite locally: `npm run test:all`
  - [ ] Build production bundle: `npm run build`
  - [ ] Preview build locally: `npm run preview`
  - [ ] Check for console errors in production build
  - [ ] Test critical workflows manually

### T-Minus 1 Hour: Database Snapshot

- [ ] Create pre-deployment database backup
- [ ] Document backup ID/timestamp in deployment notes
- [ ] Verify backup size is reasonable (not corrupted)

### T-Minus 30 Minutes: Pre-Flight Checks

- [ ] **Supabase Status Check**
  - [ ] All 2 security issues resolved
  - [ ] All 8 performance issues resolved
  - [ ] No active incidents on Supabase status page
  - [ ] Database connection pool healthy

- [ ] **Team Communication**
  - [ ] Notify stakeholders of deployment window
  - [ ] Deployment notes prepared
  - [ ] Support team on standby

### T-Minus 0: Deploy to Production

- [ ] **Deploy to Vercel**

  ```bash
  git push origin main
  ```

  - [ ] Monitor Vercel deployment logs
  - [ ] Verify build completes successfully
  - [ ] Note deployment URL and timestamp
  - [ ] Wait for deployment to go live (usually 1-2 minutes)

- [ ] **Verify Deployment**
  - [ ] Visit production URL
  - [ ] Check that version number updated (if displayed)
  - [ ] Verify no immediate errors in browser console

---

## Post-Deployment Verification

> **Target:** Complete within 15 minutes of deployment

### Smoke Tests (Critical Path)

- [ ] **Authentication**
  - [ ] Login with existing test account
  - [ ] Logout works
  - [ ] Signup flow works (creates new user)
  - [ ] Email verification sent (check inbox)

- [ ] **Dashboard**
  - [ ] Dashboard loads without errors
  - [ ] Account balances display correctly
  - [ ] Navigation works (all menu items)

- [ ] **CSV Import Workflow**
  - [ ] Upload CSV file (use test file from `e2e/fixtures/`)
  - [ ] Preview shows correctly
  - [ ] Duplicate detection works
  - [ ] Confirm import succeeds
  - [ ] Transactions appear in workbench

- [ ] **Workbench**
  - [ ] Transactions load (< 2 seconds)
  - [ ] Filtering works (by account, date, reviewed status)
  - [ ] Edit transaction (inline edit or modal)
  - [ ] Apply rules to transactions
  - [ ] Mark transactions as reviewed

- [ ] **Reconciliation**
  - [ ] Select account
  - [ ] Enter date range and ending balance
  - [ ] Mark transactions as reconciled
  - [ ] Finalize reconciliation
  - [ ] Verify balance updates

- [ ] **Reports**
  - [ ] Generate report with filters
  - [ ] Pagination works
  - [ ] Export to CSV works
  - [ ] Report data accurate

### Technical Verification

- [ ] **Browser Console**
  - [ ] No JavaScript errors
  - [ ] No failed network requests
  - [ ] No CORS errors

- [ ] **Supabase Logs**
  - [ ] No authentication errors
  - [ ] No RLS policy violations
  - [ ] No slow queries (> 1 second)
  - [ ] Connection pool healthy

- [ ] **Performance**
  - [ ] Lighthouse audit (target: > 80 performance score)
  - [ ] First Contentful Paint < 1.5s
  - [ ] Time to Interactive < 3.5s
  - [ ] No layout shift (CLS < 0.1)

### Error Monitoring

- [ ] Verify error tracking configured (if using Sentry/LogRocket)
- [ ] Test error boundary (trigger intentional error in dev tools)
- [ ] Verify errors reported to monitoring service

---

## Monitoring Setup

> **Target:** Configure within 1 hour of deployment

### Uptime Monitoring

- [ ] **Set up uptime monitor** (UptimeRobot, Pingdom, or similar)
  - [ ] Monitor production URL (<https://app.papasbooks.com>)
  - [ ] Check interval: 5 minutes
  - [ ] Alert email configured
  - [ ] SMS alerts for critical downtime (optional)

### Error Tracking

- [ ] **Configure error tracking service** (Sentry recommended)
  - [ ] Install @sentry/react
  - [ ] Configure DSN in environment variables
  - [ ] Test error reporting
  - [ ] Set up error alerts (email/Slack)

### Performance Monitoring

- [ ] **Vercel Analytics** (included free)
  - [ ] Verify analytics enabled
  - [ ] Review real user metrics

- [ ] **Supabase Monitoring**
  - [ ] Review database performance metrics
  - [ ] Set up slow query alerts (> 1 second)
  - [ ] Monitor connection pool usage

### Log Aggregation

- [ ] Review Supabase logs for:
  - [ ] Authentication failures
  - [ ] RLS policy violations
  - [ ] Database errors
  - [ ] API rate limit hits

---

## Rollback Procedure

**If critical issues are discovered, follow this procedure:**

### Immediate Rollback (< 5 minutes)

1. **Vercel Rollback**
   - Go to Vercel Dashboard → Project → Deployments
   - Find previous stable deployment
   - Click "..." → "Promote to Production"
   - Verify rollback successful (visit production URL)

2. **Verify Functionality**
   - Test critical workflows (login, import, workbench)
   - Check Supabase logs for errors
   - Monitor for 10 minutes

### Database Rollback (if needed)

> **WARNING:** ONLY if database changes were made that caused issues

1. **Restore from Backup**
   - Supabase Dashboard → Database → Backups
   - Select pre-deployment backup
   - Click "Restore"
   - Wait for restoration (can take 5-15 minutes)
   - **WARNING: This will lose any data created after backup**

2. **Verify Database State**
   - Check key tables for data integrity
   - Verify RLS policies still active
   - Test queries in SQL editor

### Communication

- [ ] **Notify Stakeholders**
  - [ ] Email users about temporary issues (if public)
  - [ ] Post status update (if applicable)
  - [ ] Document rollback reason

- [ ] **Post-Incident Report**
  - [ ] What went wrong
  - [ ] Why it wasn't caught in testing
  - [ ] Steps taken to resolve
  - [ ] Prevention plan for future

---

## Post-Launch Monitoring (First Week)

### Daily Checks (First 3 Days)

- [ ] **Day 1**
  - [ ] Review error logs (morning and evening)
  - [ ] Check performance metrics
  - [ ] Monitor user feedback
  - [ ] Verify email delivery working

- [ ] **Day 2**
  - [ ] Review error rates (should be declining)
  - [ ] Check for performance degradation
  - [ ] Verify backups running

- [ ] **Day 3**
  - [ ] Analyze usage patterns
  - [ ] Identify any bottlenecks
  - [ ] Plan hot fixes if needed

### Weekly Review (First Month)

- [ ] **Week 1**
  - [ ] Error rate analysis
  - [ ] Performance metrics review
  - [ ] User feedback summary
  - [ ] Database growth rate

- [ ] **Week 2-4**
  - [ ] Review monitoring dashboards
  - [ ] Plan feature improvements
  - [ ] Schedule maintenance windows

---

## Emergency Contacts

**Prepare before deployment:**

- **Supabase Support:** <support@supabase.io> (or dashboard support chat)
- **Vercel Support:** <https://vercel.com/support>
- **Team Lead:** [Your contact info]
- **Database Admin:** [Contact info]
- **DevOps:** [Contact info]

---

## Deployment Notes Template

**Use this template to document each deployment:**

```markdown
# Deployment: [Date] - v[Version]

## Pre-Deployment

- Branch: main
- Commit: [commit hash]
- Tests passed: ✅/❌
- Supabase issues resolved: ✅/❌
- Database backup: [backup ID]

## Deployment

- Start time: [HH:MM timezone]
- Deploy method: Vercel (git push)
- Deployment URL: [Vercel deployment URL]
- End time: [HH:MM timezone]

## Post-Deployment

- Smoke tests: ✅/❌
- Performance check: ✅/❌
- Error monitoring: ✅/❌
- Issues found: [List or "None"]

## Rollback

- Required: Yes/No
- Reason: [If applicable]
- Rollback time: [If applicable]

## Notes

[Any additional notes, observations, or follow-up items]
```

---

## Success Criteria

Deployment is considered successful when:

- ✅ All smoke tests pass
- ✅ No critical errors in logs (first hour)
- ✅ Performance metrics within acceptable range
- ✅ All 2 Supabase security issues resolved
- ✅ All 8 Supabase performance issues resolved
- ✅ User feedback positive (if applicable)
- ✅ Monitoring and alerts configured

---

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Next Review:** Before production deployment
