# Rollback Procedure

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Project:** Papa's Books

---

## When to Rollback

Initiate rollback immediately if any of these conditions occur:

- 🔴 **Critical Bug:** App completely broken or unusable
- 🔴 **Data Loss:** Users reporting lost transactions or data
- 🔴 **Security Breach:** Unauthorized data access detected
- 🔴 **Performance Collapse:** App loading > 10 seconds or timing out
- 🔴 **Authentication Failure:** Users cannot log in
- 🟡 **Major Bug:** Significant feature broken affecting >50% of users

**Do NOT rollback for:**

- Minor UI issues (typos, styling bugs)
- Non-critical feature bugs
- Issues affecting <10% of users
- Issues with known workarounds

---

## Rollback Decision Matrix

| Severity | User Impact           | Action                        | Timeframe    |
| -------- | --------------------- | ----------------------------- | ------------ |
| Critical | >75% users affected   | Immediate rollback            | < 5 minutes  |
| High     | 25-75% users affected | Rollback if no quick fix      | < 15 minutes |
| Medium   | 10-25% users affected | Attempt quick fix first       | < 30 minutes |
| Low      | <10% users affected   | Schedule fix for next release | Next deploy  |

---

## Rollback Types

### Type 1: Frontend Rollback (Vercel)

**Use when:** Frontend code issue (UI bugs, JavaScript errors, React errors)

**Time to complete:** < 5 minutes

**Data impact:** None (database unchanged)

### Type 2: Database Rollback (Supabase)

**Use when:** Database migration caused issues, data corruption

**Time to complete:** 5-15 minutes

**Data impact:** ⚠️ **HIGH** - All data created after backup will be lost

### Type 3: Full Rollback (Frontend + Database)

**Use when:** Both frontend and database changes caused issues

**Time to complete:** 10-20 minutes

**Data impact:** ⚠️ **HIGH** - All data created after backup will be lost

---

## Type 1: Frontend Rollback (Vercel)

### Step-by-Step Procedure

#### Step 1: Verify Issue (1 minute)

- [ ] Confirm issue is frontend-related (JavaScript errors, UI bugs, build issues)
- [ ] Check Vercel deployment logs for build errors
- [ ] Verify database is functioning (check Supabase logs)

#### Step 2: Identify Last Known Good Deployment (1 minute)

1. Go to Vercel Dashboard → Your Project → Deployments
2. Identify the last stable deployment (usually previous production deployment)
3. Note the commit hash and deployment time
4. Verify it was production (has "Production" badge)

#### Step 3: Promote Previous Deployment (2 minutes)

1. Click the "..." menu on the last stable deployment
2. Select "Promote to Production"
3. Confirm promotion
4. Wait for deployment to go live (usually 30-60 seconds)

#### Step 4: Verify Rollback (1 minute)

- [ ] Visit production URL
- [ ] Test critical workflows:
  - [ ] Login works
  - [ ] Dashboard loads
  - [ ] Workbench loads
  - [ ] Can create/edit transactions
- [ ] Check browser console for errors
- [ ] Verify correct version deployed (check commit hash)

#### Step 5: Monitor (10 minutes)

- [ ] Watch Supabase logs for errors
- [ ] Monitor Vercel logs
- [ ] Check error tracking service (if configured)
- [ ] Watch for user reports

### Verification Commands

```bash
# Check current deployment (locally)
git log -1 --oneline

# Verify production deployment matches expected commit
# (Check in Vercel dashboard)
```

---

## Type 2: Database Rollback (Supabase)

### ⚠️ WARNING

**Database rollbacks are destructive!**

- All data created after the backup will be **permanently lost**
- All users will lose recent changes (transactions, edits, etc.)
- Only use for critical issues (data corruption, broken RLS policies)

### Step-by-Step Procedure

#### Step 1: Assess Impact (2 minutes)

- [ ] Confirm issue is database-related (RLS failures, trigger errors, data corruption)
- [ ] Estimate data loss window (time since last backup)
- [ ] Decide if data loss is acceptable vs. leaving issue unfixed
- [ ] **Get approval from stakeholder if possible**

#### Step 2: Notify Users (1 minute)

- [ ] Post status update: "We're experiencing technical issues and performing emergency maintenance"
- [ ] Set realistic expectation: "Any changes made in the last [X hours] will be lost"

#### Step 3: Create Emergency Backup (2 minutes)

**Before restoring, create one final backup of current state:**

1. Supabase Dashboard → Database → Backups
2. Click "Create Backup"
3. Label: "Emergency backup before rollback [timestamp]"
4. Wait for backup to complete
5. **This gives you a safety net in case rollback fails**

#### Step 4: Restore from Backup (5 minutes)

1. Supabase Dashboard → Database → Backups
2. Find pre-deployment backup (should be labeled with timestamp)
3. Click "Restore"
4. **Confirm restoration** (final warning before data loss)
5. Wait for restoration to complete (5-10 minutes for large databases)

#### Step 5: Verify Database State (3 minutes)

- [ ] **Test RLS Policies**

  ```bash
  npx tsx scripts/test-rls-policies.ts
  ```

- [ ] **Verify Triggers Active**

  ```sql
  SELECT trigger_name, event_object_table
  FROM information_schema.triggers
  WHERE trigger_schema = 'public';
  ```

- [ ] **Check Key Tables**

  ```sql
  -- Verify data exists
  SELECT COUNT(*) FROM transactions;
  SELECT COUNT(*) FROM accounts;
  SELECT COUNT(*) FROM booksets;
  ```

- [ ] **Test Authentication**
  - Try logging in with test account
  - Verify session creation works

#### Step 6: Monitor (15 minutes)

- [ ] Watch Supabase logs for errors
- [ ] Verify users can log in
- [ ] Check for RLS policy violations
- [ ] Monitor error rates

---

## Type 3: Full Rollback (Frontend + Database)

### Step-by-Step Procedure

1. **Perform Database Rollback first** (Type 2) - See above
2. **Wait for database restoration to complete**
3. **Then perform Frontend Rollback** (Type 1) - See above
4. **Verify both systems working together**

### Verification

- [ ] Login works (auth + database)
- [ ] Dashboard loads with correct data
- [ ] Transactions display correctly
- [ ] Can create new transaction (database write test)
- [ ] CSV import works (full workflow test)

---

## Post-Rollback Procedure

### Immediate Actions (Within 1 Hour)

- [ ] **Document the Incident**
  - What went wrong
  - When it was detected
  - Rollback type used
  - Data loss estimate
  - Time to resolve

- [ ] **Notify Users** (if applicable)
  - Explain what happened
  - Apologize for inconvenience
  - Explain data loss (if any)
  - Provide workaround or timeline for fix

- [ ] **Notify Team**
  - Alert developers to the issue
  - Share incident report
  - Schedule post-mortem meeting

### Root Cause Analysis (Within 24 Hours)

- [ ] **Identify Root Cause**
  - What code change caused the issue?
  - Why wasn't it caught in testing?
  - What test coverage is missing?

- [ ] **Create Fix**
  - Develop fix in separate branch
  - Add test coverage for the bug
  - Test fix thoroughly in staging

- [ ] **Update Deployment Process**
  - Add new test to prevent regression
  - Update checklist to catch similar issues
  - Improve monitoring/alerting

### Post-Mortem Meeting (Within 48 Hours)

Discuss:

1. Timeline of events
2. Root cause analysis
3. Response effectiveness
4. Prevention strategies
5. Process improvements

---

## Rollback Scenarios & Examples

### Scenario 1: RLS Policy Bug

**Symptoms:**

- Users seeing other users' transactions
- Security alert in Supabase logs

**Rollback Type:** Type 2 (Database)

**Procedure:**

1. Immediately rollback database to pre-deployment backup
2. Verify RLS policies working with test script
3. Investigate RLS policy changes in recent migration
4. Fix RLS policy, test thoroughly
5. Schedule new deployment with fix

---

### Scenario 2: React Error on Dashboard

**Symptoms:**

- Dashboard shows white screen
- JavaScript error in console
- Vercel build succeeded but runtime error

**Rollback Type:** Type 1 (Frontend)

**Procedure:**

1. Rollback Vercel to previous deployment
2. Verify dashboard loads correctly
3. Investigate React component causing error
4. Fix component, add error boundary
5. Deploy fix after testing

---

### Scenario 3: Broken CSV Import

**Symptoms:**

- CSV import fails with 500 error
- Database foreign key constraint violation
- Supabase logs show constraint errors

**Rollback Type:** Type 1 (Frontend) - if frontend validation broken
**OR**
**Rollback Type:** Type 3 (Full) - if database schema changed

**Procedure:**

1. Assess if database schema changed
2. If yes → Type 3 rollback (database + frontend)
3. If no → Type 1 rollback (frontend only)
4. Fix validation logic or schema migration
5. Test import with various CSV files
6. Deploy fix

---

### Scenario 4: Performance Degradation

**Symptoms:**

- Workbench loading 10+ seconds
- Database queries timing out
- Supabase connection pool maxed out

**Rollback Type:** Type 2 (Database) - if migration removed indexes
**OR**
**Alternative:** Add missing indexes without rollback

**Procedure:**

1. Check if indexes are missing (compare to production_schema.sql)
2. If indexes missing → add them manually (no rollback needed)

   ```sql
   CREATE INDEX idx_transactions_bookset_account_date
     ON transactions(bookset_id, account_id, date DESC);
   ```

3. Run ANALYZE to update query planner statistics
4. Monitor performance improvement
5. If indexes not the issue → investigate query optimization

---

## Rollback Checklist Template

Use this template for documenting rollbacks:

```markdown
# Rollback Incident Report

**Date:** [YYYY-MM-DD]
**Time Detected:** [HH:MM timezone]
**Severity:** Critical / High / Medium
**Rollback Type:** Type 1 / Type 2 / Type 3

## Issue Description

[What went wrong?]

## User Impact

- Users affected: [Estimate %]
- Data loss: Yes/No [If yes, estimate window]
- Functionality broken: [List features]

## Rollback Procedure

- Start time: [HH:MM]
- End time: [HH:MM]
- Duration: [X minutes]
- Deployment rolled back to: [commit hash]
- Database rolled back to: [backup timestamp]

## Verification

- [ ] Critical workflows tested
- [ ] Error logs clear
- [ ] User reports resolved

## Root Cause

[Why did this happen?]

## Prevention

[What will we do differently next time?]

## Follow-up Actions

- [ ] Fix developed and tested
- [ ] Additional test coverage added
- [ ] Process improvement documented
```

---

## Emergency Contact Information

**Before deployment, ensure these are accessible:**

- **Vercel Dashboard:** <https://vercel.com/dashboard>
- **Supabase Dashboard:** <https://supabase.com/dashboard>
- **Team Lead:** [Phone/Email]
- **Database Admin:** [Phone/Email]
- **Stakeholder:** [Phone/Email]

---

## Testing the Rollback Procedure

> **Recommended:** Test rollback in staging environment

### Staging Environment Rollback Test

1. **Setup**
   - Deploy a "broken" version to staging
   - Create a backup before deploying broken version

2. **Execute Rollback**
   - Follow Type 1 procedure on staging
   - Measure time to complete
   - Document any issues encountered

3. **Verify**
   - Ensure rollback restored functionality
   - Check for data integrity issues
   - Test all critical workflows

4. **Document**
   - Update rollback procedure with lessons learned
   - Note any steps that took longer than expected
   - Identify areas for automation

---

**Remember:** Rollbacks are a last resort. Always attempt a quick fix first if the issue is minor and fixable within 5-10 minutes.

**Document Version:** 1.0
**Last Updated:** 2025-12-26
**Next Review:** After first production deployment
