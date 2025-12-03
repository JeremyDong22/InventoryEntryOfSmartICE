# Supabase Auth + RBAC Migration Guide

## Overview

This directory contains Supabase migrations for implementing authentication and role-based access control (RBAC) using **Supabase Auth** instead of the custom UserCenter backend.

**Key Features:**
- Uses Supabase Auth's built-in `auth.users` table for account management
- Simplified RBAC with 4 roles: `super_admin`, `store_manager`, `chef`, `employee`
- No approval workflow - admins manually create users via Supabase Dashboard
- All tables prefixed with `ims_` (Inventory Management System)

---

## Schema Design

### Tables Created

#### 1. `ims_stores` - 门店表
Stores information about physical store locations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `store_code` | VARCHAR(50) | Unique store identifier (e.g., YBL-CD-001) |
| `store_name` | VARCHAR(200) | Store display name |
| `province` | VARCHAR(50) | Province/State |
| `city` | VARCHAR(50) | City |
| `district` | VARCHAR(50) | District |
| `address` | TEXT | Full address |
| `phone` | VARCHAR(20) | Contact phone |
| `status` | ENUM | active/inactive/maintenance |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `metadata` | JSONB | Additional flexible data |

#### 2. `ims_profiles` - 用户档案表
Extends `auth.users` with business-specific profile data.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Foreign key to `auth.users.id` |
| `name` | VARCHAR(100) | Display name |
| `phone` | VARCHAR(20) | Phone number (unique) |
| `role` | ENUM | super_admin/store_manager/chef/employee |
| `store_id` | UUID | Foreign key to `ims_stores.id` (nullable) |
| `status` | ENUM | active/inactive/suspended |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `last_login_at` | TIMESTAMPTZ | Last login timestamp |
| `metadata` | JSONB | Additional flexible data |

---

## Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| `super_admin` | 超级管理员 | Full system access, can manage all stores and users |
| `store_manager` | 店长 | Manage assigned store, view/edit store employees |
| `chef` | 厨师长 | Kitchen operations, inventory management |
| `employee` | 普通员工 | Basic data entry, view own store data |

---

## Row Level Security (RLS) Policies

### ims_profiles Policies

1. **View Own Profile**: Users can view their own profile
2. **Update Own Profile**: Users can update their own profile
3. **Super Admin View**: Super admins can view all profiles
4. **Store Manager View**: Store managers can view profiles in their store
5. **Super Admin Manage**: Super admins can insert/update/delete all profiles
6. **Store Manager Manage**: Store managers can manage profiles in their store

### ims_stores Policies

1. **View Stores**: All authenticated users can view all stores
2. **Manage Stores**: Only super admins can insert/update/delete stores

---

## Deployment Instructions

### Step 1: Link Supabase Project (if not already linked)

```bash
# Login to Supabase
supabase login

# Link to your Supabase project
supabase link --project-ref wdpeoyugsxqnpwwtkqsl
```

### Step 2: Run Migrations

```bash
# Navigate to project root
cd /Users/jeremydong/Desktop/Smartice/APPs/InventoryEntryOfSmartICE

# Run all migrations
supabase db push
```

**Alternative: Manual Migration via Supabase Dashboard**

If CLI is not available, manually run the SQL files in order:

1. Go to: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl/sql/new
2. Copy contents of `20241203000001_init_auth_rbac.sql`
3. Execute SQL
4. Copy contents of `20241203000002_seed_stores.sql`
5. Execute SQL

### Step 3: Verify Migration

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'ims_%';

-- Expected output:
-- ims_profiles
-- ims_stores

-- Check if enums exist
SELECT typname
FROM pg_type
WHERE typname LIKE 'ims_%';

-- Expected output:
-- ims_user_role
-- ims_user_status
-- ims_store_status
```

---

## Manual User Creation via Supabase Dashboard

Since there's no approval workflow, admins manually create users via the Supabase Dashboard.

### Method 1: Create User via Dashboard

1. Navigate to: **Authentication** → **Users** → **Add User**
2. Fill in:
   - **Email**: user@example.com
   - **Password**: (auto-generate or set manually)
   - **Auto Confirm User**: ✅ (skip email confirmation)
   - **User Metadata** (JSON):
     ```json
     {
       "name": "张三",
       "phone": "13800138000"
     }
     ```
3. Click **Create User**
4. Copy the generated `user_id` (UUID)

### Method 2: Update Profile via SQL Editor

After creating the user, update their profile:

```sql
-- Update the auto-created profile with role and store assignment
UPDATE ims_profiles
SET
  role = 'store_manager',  -- or 'chef', 'employee'
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active',
  name = '张三',
  phone = '13800138000'
WHERE user_id = 'USER_ID_FROM_STEP_1';
```

### Method 3: Direct SQL Insert (Full Control)

```sql
-- 1. Create auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'user@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"name": "张三", "phone": "13800138000"}'::jsonb,
  NOW(),
  NOW()
)
RETURNING id;

-- 2. Create profile (auto-created by trigger, but you can update it)
UPDATE ims_profiles
SET
  role = 'store_manager',
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active'
WHERE user_id = 'RETURNED_ID_FROM_ABOVE';
```

---

## Example User Creation Script

### Create Super Admin

```sql
-- Super admin doesn't need store_id
UPDATE ims_profiles
SET
  role = 'super_admin',
  status = 'active',
  name = '系统管理员',
  phone = '13900000000'
WHERE user_id = 'ADMIN_USER_ID';
```

### Create Store Manager

```sql
-- Store manager for 野百灵春熙路店
UPDATE ims_profiles
SET
  role = 'store_manager',
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active',
  name = '李店长',
  phone = '13800138001'
WHERE user_id = 'MANAGER_USER_ID';
```

### Create Chef

```sql
-- Chef for 野百灵春熙路店
UPDATE ims_profiles
SET
  role = 'chef',
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active',
  name = '王师傅',
  phone = '13800138002'
WHERE user_id = 'CHEF_USER_ID';
```

### Create Employee

```sql
-- Employee for 野百灵春熙路店
UPDATE ims_profiles
SET
  role = 'employee',
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active',
  name = '张员工',
  phone = '13800138003'
WHERE user_id = 'EMPLOYEE_USER_ID';
```

---

## Helper Functions

The migration includes several helper functions for common operations:

### Check User Role

```sql
-- Get current user's role
SELECT get_user_role();

-- Returns: 'super_admin', 'store_manager', 'chef', or 'employee'
```

### Check User Store

```sql
-- Get current user's store_id
SELECT get_user_store_id();

-- Returns: UUID or NULL
```

### Check Permissions

```sql
-- Check if current user is super admin
SELECT is_super_admin();

-- Check if current user is store manager
SELECT is_store_manager();

-- Returns: true or false
```

### Update Last Login

```sql
-- Call this after successful login (from backend)
SELECT update_last_login();
```

---

## Frontend Integration

Update frontend to use Supabase Auth instead of UserCenter:

### 1. Install Supabase Client

```bash
cd frontend
npm install @supabase/supabase-js
```

### 2. Update Environment Variables

```bash
# frontend/.env
VITE_SUPABASE_URL=https://wdpeoyugsxqnpwwtkqsl.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Auth Service

```typescript
// frontend/services/authService.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Update last login timestamp
  await supabase.rpc('update_last_login');

  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile data
  const { data: profile } = await supabase
    .from('ims_profiles')
    .select('*, store:ims_stores(*)')
    .eq('user_id', user.id)
    .single();

  return { ...user, profile };
}
```

---

## Querying Data with RLS

### Example: Get Users in My Store (as Store Manager)

```typescript
// RLS automatically filters to current user's store
const { data: employees } = await supabase
  .from('ims_profiles')
  .select('*, store:ims_stores(*)')
  .order('name');

// Returns only employees in the same store as the logged-in manager
```

### Example: Get All Users (as Super Admin)

```typescript
// RLS allows super admin to see all profiles
const { data: allUsers } = await supabase
  .from('ims_profiles')
  .select('*, store:ims_stores(*)')
  .order('created_at', { ascending: false });
```

---

## Testing RLS Policies

### Test as Different Users

```sql
-- Impersonate user (in SQL Editor, set auth.uid())
SET LOCAL request.jwt.claims TO '{"sub": "USER_UUID_HERE"}';

-- Test query
SELECT * FROM ims_profiles;

-- Reset
RESET request.jwt.claims;
```

---

## Migration Rollback

If you need to rollback the migration:

```sql
-- Drop tables (cascades to RLS policies)
DROP TABLE IF EXISTS ims_profiles CASCADE;
DROP TABLE IF EXISTS ims_stores CASCADE;

-- Drop enums
DROP TYPE IF EXISTS ims_user_role CASCADE;
DROP TYPE IF EXISTS ims_user_status CASCADE;
DROP TYPE IF EXISTS ims_store_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_store_id() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS is_store_manager() CASCADE;
DROP FUNCTION IF EXISTS update_last_login() CASCADE;
```

---

## Common Issues

### Issue 1: RLS Blocking Queries

**Symptom**: Queries return 0 rows even when data exists

**Solution**: Check if user has the correct role and store assignment:

```sql
-- Check current user's profile
SELECT * FROM ims_profiles WHERE user_id = auth.uid();
```

### Issue 2: Auto-profile Creation Not Working

**Symptom**: New users don't have profiles in `ims_profiles`

**Solution**: Check if trigger exists:

```sql
-- Verify trigger
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

### Issue 3: Permission Denied Errors

**Symptom**: Error: "new row violates row-level security policy"

**Solution**: Ensure user has active status and correct role:

```sql
UPDATE ims_profiles
SET status = 'active'
WHERE user_id = 'USER_ID';
```

---

## Next Steps

1. ✅ Deploy migrations to Supabase
2. ✅ Create initial super admin user via Dashboard
3. ⏳ Update frontend auth service to use Supabase Auth
4. ⏳ Remove UserCenter backend dependencies
5. ⏳ Test RLS policies with different user roles
6. ⏳ Migrate existing users (if any) from UserCenter to Supabase Auth

---

## Support

For questions or issues, refer to:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
