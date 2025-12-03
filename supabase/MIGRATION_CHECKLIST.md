# Migration Checklist - Supabase Auth + RBAC Deployment

## Pre-Deployment

- [ ] **Backup existing data** (if any UserCenter data exists)
  ```bash
  # Export UserCenter data if needed
  pg_dump -h host -U user -d database -t usercenter.* > backup.sql
  ```

- [ ] **Verify Supabase project access**
  - Project URL: `https://wdpeoyugsxqnpwwtkqsl.supabase.co`
  - Dashboard access: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl
  - Admin permissions confirmed

- [ ] **Review migration files**
  - `20241203000001_init_auth_rbac.sql` - Main schema
  - `20241203000002_seed_stores.sql` - Initial stores

---

## Deployment Steps

### Step 1: Deploy Schema Migration

- [ ] Open Supabase SQL Editor
  - URL: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl/sql/new

- [ ] Run `20241203000001_init_auth_rbac.sql`
  - Copy full file contents
  - Paste into SQL Editor
  - Execute
  - ✅ Confirm: "Success. No rows returned"

- [ ] Verify tables created
  ```sql
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name LIKE 'ims_%'
  ORDER BY table_name;
  ```
  - Expected: `ims_profiles`, `ims_stores`

- [ ] Verify ENUMs created
  ```sql
  SELECT typname
  FROM pg_type
  WHERE typname LIKE 'ims_%'
  ORDER BY typname;
  ```
  - Expected: `ims_store_status`, `ims_user_role`, `ims_user_status`

- [ ] Verify triggers created
  ```sql
  SELECT trigger_name, event_object_table
  FROM information_schema.triggers
  WHERE trigger_name LIKE '%ims_%' OR trigger_name = 'on_auth_user_created'
  ORDER BY event_object_table, trigger_name;
  ```
  - Expected: `on_auth_user_created`, `update_ims_profiles_updated_at`, `update_ims_stores_updated_at`

- [ ] Verify helper functions created
  ```sql
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND (routine_name LIKE '%user%' OR routine_name LIKE '%admin%')
  ORDER BY routine_name;
  ```
  - Expected: `get_user_role`, `get_user_store_id`, `is_super_admin`, `is_store_manager`, `update_last_login`

### Step 2: Deploy Seed Data

- [ ] Run `20241203000002_seed_stores.sql`
  - Copy full file contents
  - Paste into SQL Editor
  - Execute
  - ✅ Confirm: "Success. No rows returned"

- [ ] Verify stores inserted
  ```sql
  SELECT store_code, store_name, city, status
  FROM ims_stores
  ORDER BY city, store_name;
  ```
  - Expected: 5 stores (成都, 绵阳, 德阳, 南京, 苏州)

### Step 3: Create First Admin User

- [ ] Navigate to Authentication → Users
  - URL: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl/auth/users

- [ ] Click "Add User" (Manual or Invite)
  - Method chosen: _______________

- [ ] **Manual Creation**:
  - Email: ___________________________
  - Password: (auto-generated or set)
  - Auto Confirm User: ✅
  - User Metadata:
    ```json
    {
      "name": "系统管理员",
      "phone": "13900000000"
    }
    ```
  - Click "Create User"
  - **Copy user_id**: ___________________________

- [ ] Assign super_admin role
  ```sql
  -- Replace USER_ID_HERE with actual user_id
  UPDATE ims_profiles
  SET
    role = 'super_admin',
    status = 'active',
    name = '系统管理员',
    phone = '13900000000'
  WHERE user_id = 'USER_ID_HERE';
  ```

- [ ] Verify admin created
  ```sql
  SELECT
    p.user_id,
    u.email,
    p.name,
    p.phone,
    p.role,
    p.status
  FROM ims_profiles p
  JOIN auth.users u ON p.user_id = u.id
  WHERE p.role = 'super_admin';
  ```
  - ✅ Confirm: 1 row returned with correct data

### Step 4: Test Authentication

- [ ] Test login via frontend (if frontend updated)
  - Email: ___________________________
  - Password: ___________________________
  - ✅ Login successful
  - ✅ User profile displayed correctly

- [ ] **OR** Test via Supabase client:
  ```javascript
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@smartice.ai',
    password: 'your-password'
  });
  console.log(data.user);
  ```

### Step 5: Test RLS Policies

- [ ] Test as super_admin (view all profiles)
  ```sql
  -- Set session as admin user
  SET LOCAL request.jwt.claims TO '{"sub": "ADMIN_USER_ID"}';

  -- Should return all profiles
  SELECT * FROM ims_profiles;

  -- Reset
  RESET request.jwt.claims;
  ```
  - ✅ Returns all profiles

- [ ] Create test store manager
  - Email: ___________________________
  - user_id: ___________________________
  - Assigned to store: ___________________________

  ```sql
  UPDATE ims_profiles
  SET
    role = 'store_manager',
    store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
    status = 'active',
    name = '测试店长',
    phone = '13800000001'
  WHERE user_id = 'MANAGER_USER_ID';
  ```

- [ ] Test as store_manager (view own store only)
  ```sql
  -- Set session as manager
  SET LOCAL request.jwt.claims TO '{"sub": "MANAGER_USER_ID"}';

  -- Should only return profiles in same store
  SELECT * FROM ims_profiles;

  -- Reset
  RESET request.jwt.claims;
  ```
  - ✅ Returns only profiles in manager's store

- [ ] Test as employee (view own profile only)
  - Create test employee
  - Test query returns only own profile

### Step 6: Verify Helper Functions

- [ ] Test get_user_role()
  ```sql
  SET LOCAL request.jwt.claims TO '{"sub": "ADMIN_USER_ID"}';
  SELECT get_user_role();
  -- Expected: 'super_admin'
  RESET request.jwt.claims;
  ```

- [ ] Test is_super_admin()
  ```sql
  SET LOCAL request.jwt.claims TO '{"sub": "ADMIN_USER_ID"}';
  SELECT is_super_admin();
  -- Expected: true
  RESET request.jwt.claims;
  ```

- [ ] Test update_last_login()
  ```sql
  SET LOCAL request.jwt.claims TO '{"sub": "ADMIN_USER_ID"}';
  SELECT update_last_login();
  SELECT last_login_at FROM ims_profiles WHERE user_id = 'ADMIN_USER_ID';
  -- Expected: current timestamp
  RESET request.jwt.claims;
  ```

---

## Frontend Integration

- [ ] **Update environment variables**
  ```bash
  # frontend/.env
  VITE_SUPABASE_URL=https://wdpeoyugsxqnpwwtkqsl.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```
  - Anon Key from: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl/settings/api

- [ ] **Update auth service** (`frontend/services/authService.ts`)
  - Replace UserCenter API calls with Supabase Auth
  - Implement login/logout/getCurrentUser
  - Test login flow

- [ ] **Update AuthContext** (`frontend/contexts/AuthContext.tsx`)
  - Replace UserCenter state management with Supabase session
  - Test context provider

- [ ] **Test frontend auth flow**
  - [ ] Login page works
  - [ ] User profile displays correctly
  - [ ] Logout works
  - [ ] Protected routes enforce authentication
  - [ ] Role-based UI displays correctly

---

## Post-Deployment Verification

### Data Integrity

- [ ] All tables have proper indexes
  ```sql
  SELECT
    tablename,
    indexname,
    indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename LIKE 'ims_%'
  ORDER BY tablename, indexname;
  ```

- [ ] All tables have RLS enabled
  ```sql
  SELECT
    tablename,
    rowsecurity
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename LIKE 'ims_%';
  ```
  - Expected: All tables have `rowsecurity = true`

- [ ] All policies are active
  ```sql
  SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename LIKE 'ims_%'
  ORDER BY tablename, policyname;
  ```
  - Expected: Multiple policies per table

### Performance

- [ ] Query performance test
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM ims_profiles WHERE role = 'employee';
  ```
  - ✅ Uses index scan

- [ ] Join performance test
  ```sql
  EXPLAIN ANALYZE
  SELECT p.*, s.*
  FROM ims_profiles p
  LEFT JOIN ims_stores s ON p.store_id = s.id;
  ```
  - ✅ Efficient join

### Security

- [ ] Anonymous access blocked
  ```sql
  -- Should fail (no auth context)
  SELECT * FROM ims_profiles;
  ```
  - ✅ Error: "new row violates row-level security policy"

- [ ] Service role has full access (for backend)
  - Verify service_role key has full permissions
  - Test via backend API calls

### Monitoring

- [ ] Set up Supabase monitoring
  - Enable email alerts for errors
  - Monitor database usage
  - Track API request volume

---

## Documentation

- [ ] Update project README.md
  - Document new auth flow
  - Remove UserCenter references (or mark as deprecated)
  - Add Supabase Auth setup instructions

- [ ] Update API documentation
  - Document RLS behavior
  - Add helper function examples
  - Update authentication section

- [ ] Team training (if applicable)
  - Share QUICKSTART.md with team
  - Demonstrate user creation workflow
  - Explain role assignments

---

## Cleanup (After Successful Migration)

**DO NOT DELETE YET** - Keep UserCenter as backup

- [ ] Archive UserCenter backend (don't delete)
  - Move to `archive/UserCenter-backup-YYYYMMDD/`
  - Keep for 30 days as rollback option

- [ ] Update deployment configs
  - Remove UserCenter from `render.yaml` (if applicable)
  - Update Cloudflare Pages env vars

- [ ] Monitor for 7 days
  - Check error logs
  - Verify no UserCenter dependencies remain
  - Confirm all auth flows working

- [ ] **After 30 days**: Permanently delete UserCenter (if no issues)

---

## Rollback Plan (If Issues Occur)

### Immediate Rollback

1. **Drop new tables**:
   ```sql
   DROP TABLE IF EXISTS ims_profiles CASCADE;
   DROP TABLE IF EXISTS ims_stores CASCADE;
   DROP TYPE IF EXISTS ims_user_role CASCADE;
   DROP TYPE IF EXISTS ims_user_status CASCADE;
   DROP TYPE IF EXISTS ims_store_status CASCADE;
   ```

2. **Restore UserCenter backend** (from archive)

3. **Revert frontend changes** (git revert)

4. **Investigate issues**, fix, and retry migration

---

## Issue Tracking

### Issues Encountered

| Issue | Date | Resolution | Status |
|-------|------|------------|--------|
| | | | |
| | | | |
| | | | |

### Notes

```
[Add any deployment notes, observations, or issues here]
```

---

## Sign-off

- [ ] **Database Admin**: _________________ Date: _______
- [ ] **Backend Lead**: _________________ Date: _______
- [ ] **Frontend Lead**: _________________ Date: _______
- [ ] **QA/Testing**: _________________ Date: _______

---

## Success Criteria

✅ All checklist items completed
✅ Admin user can login successfully
✅ RLS policies working as expected
✅ Frontend auth flow functional
✅ No errors in Supabase logs
✅ Performance meets requirements
✅ Team trained on new workflow

**Migration Status**: [ ] Not Started | [ ] In Progress | [ ] Completed | [ ] Rolled Back

**Completion Date**: _______________
