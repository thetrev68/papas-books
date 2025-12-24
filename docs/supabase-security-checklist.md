# Supabase Security Checklist

This document tracks security configurations and best practices for the Papa's Books Supabase project.

## Status Overview

| Issue                        | Status     | Priority | Notes                                      |
| ---------------------------- | ---------- | -------- | ------------------------------------------ |
| Function Search Path Mutable | ✅ FIXED   | MEDIUM   | Migration: `fix_function_search_paths.sql` |
| Leaked Password Protection   | ⚠️ PENDING | LOW      | Fix in Supabase dashboard                  |
| Insufficient MFA Options     | ⚠️ PENDING | LOW      | Consider for post-launch                   |

---

## 1. Function Search Path Security ✅ FIXED

### Issue

PostgreSQL functions without a fixed `search_path` can be vulnerable to search path injection attacks where a malicious user creates objects in a schema that gets searched before the intended schema.

### Impact

- **Risk Level:** Medium
- **Affected Functions:** 12 functions (all RLS helpers, audit triggers, and business logic)
- **Mitigation:** Low risk due to RLS policies, but still a security best practice

### Resolution

**Migration File:** `supabase/fix_function_search_paths.sql`

Added `SET search_path = public, pg_temp` to all functions:

- `user_owns_bookset`
- `user_has_access_grant`
- `user_can_read_bookset`
- `user_can_write_bookset`
- `user_is_admin`
- `set_audit_fields_on_create`
- `prevent_audit_field_changes`
- `add_payee_alias`
- `finalize_reconciliation`
- `grant_access_by_email`
- `track_change_history`
- `undo_import_batch`
- `handle_new_user`

**To Apply:**

```sql
-- Run in Supabase SQL Editor
\i supabase/fix_function_search_paths.sql
```

**To Verify:**

```sql
SELECT
  p.proname as function_name,
  p.proconfig as config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname LIKE 'user_%'
     OR p.proname IN ('add_payee_alias', 'finalize_reconciliation', 'grant_access_by_email', 'track_change_history', 'undo_import_batch', 'handle_new_user')
ORDER BY p.proname;
```

All functions should show `{search_path=public,pg_temp}` in the config_settings column.

---

## 2. Leaked Password Protection ⚠️ PENDING

### Issue

Supabase can check passwords against the HaveIBeenPwned database to prevent users from using compromised passwords.

### Impact

- **Risk Level:** Low
- **User Impact:** Prevents use of known compromised passwords
- **Recommendation:** Enable before production launch

### How to Enable

1. Go to Supabase Dashboard → Authentication → Settings
2. Scroll to "Password Security"
3. Enable "Leaked Password Protection"
4. No code changes required

**Reference:** [Password Security Documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

---

## 3. Multi-Factor Authentication (MFA) ⚠️ PENDING

### Issue

Project has insufficient MFA options enabled, which may weaken account security for financial data.

### Impact

- **Risk Level:** Low-to-Medium (depends on use case)
- **User Impact:** Enhanced account security for financial data
- **Recommendation:** Consider for post-launch based on user feedback

### MFA Options Available

- **TOTP (Time-based One-Time Password):** Authenticator apps (Google Authenticator, Authy, etc.)
- **SMS:** Text message codes (requires additional setup)
- **Email OTP:** One-time codes via email

### Implementation Plan

#### Option 1: TOTP (Recommended for financial app)

1. Enable TOTP in Supabase Dashboard → Authentication → Settings
2. Add MFA enrollment UI to user settings page
3. Require MFA for sensitive operations (imports, reconciliation)

#### Option 2: Email OTP (Simpler, less secure)

1. Already available via Supabase Auth
2. Add UI to prompt for code on login
3. Less secure but easier for non-technical users

**Reference:** [MFA Documentation](https://supabase.com/docs/guides/auth/auth-mfa)

---

## Pre-Production Checklist

Before deploying to production, complete these steps:

### Database Security

- [x] Fix function search_path vulnerabilities (migration created)
- [ ] Run `fix_function_search_paths.sql` migration in production
- [ ] Verify RLS policies are active on all tables
- [ ] Review and test access grants for multi-user scenarios

### Auth Security

- [ ] Enable leaked password protection in Supabase dashboard
- [ ] Verify email verification is enabled
- [ ] Test password reset flow
- [ ] Configure email templates with branding
- [ ] Set up proper redirect URLs for production domain

### Optional (Post-Launch)

- [ ] Enable MFA (TOTP recommended)
- [ ] Set up rate limiting for sensitive endpoints
- [ ] Configure audit logging for compliance
- [ ] Set up monitoring/alerts for failed auth attempts

---

## Additional Security Best Practices

### Row Level Security (RLS)

All tables have RLS enabled with policies enforcing:

- Bookset-scoped data isolation
- Role-based access control (owner/editor/viewer)
- User can only access their own booksets or granted booksets

### Input Validation

- CSV imports sanitize HTML and control characters
- Field length limits enforced (description: 500 chars, payee: 200 chars)
- Zod schemas validate all user input

### Error Handling

- Database errors show user-friendly messages (not raw SQL errors)
- Error boundary catches unhandled exceptions
- Supabase client calls wrapped in try-catch

---

## Monitoring & Auditing

### Database Audit Trail

- `change_history` JSONB column tracks all changes
- Automatically populated via triggers
- Stores last 50 changes per record
- Includes timestamp, user_id, and field-level diffs

### Auth Events

Monitor these Supabase auth events:

- `user.created` - New user signups
- `user.deleted` - Account deletions
- `token.refreshed` - Session refreshes
- `user.password_recovery.requested` - Password reset attempts

### Security Alerts

Set up alerts for:

- Failed login attempts (>5 in 5 minutes)
- Unusual access patterns (geographic anomalies)
- Bulk data exports
- Admin privilege escalations

---

**Last Updated:** 2025-12-24
**Status:** Pre-production security hardening in progress
