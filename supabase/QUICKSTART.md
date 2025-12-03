# Quick Deployment Guide - Supabase Auth + RBAC

## 5-Minute Setup

### 1. Deploy Migrations (Choose One Method)

#### Method A: Via Supabase Dashboard (Recommended)

1. Open: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl/sql/new

2. Copy and run `20241203000001_init_auth_rbac.sql` (full content)

3. Copy and run `20241203000002_seed_stores.sql`

4. Verify:
   ```sql
   SELECT * FROM ims_stores;
   SELECT * FROM ims_profiles;
   ```

#### Method B: Via Supabase CLI

```bash
cd /Users/jeremydong/Desktop/Smartice/APPs/InventoryEntryOfSmartICE
supabase db push
```

---

### 2. Create Your First Admin User

#### Step 1: Create Auth User

1. Go to: **Authentication** → **Users** → **Add User**

2. Fill in:
   ```
   Email: admin@smartice.ai
   Password: (auto-generate or set)
   Auto Confirm User: ✅
   User Metadata:
   {
     "name": "系统管理员",
     "phone": "13900000000"
   }
   ```

3. Click **Create User**, copy the `user_id`

#### Step 2: Assign Admin Role

1. Go to: **SQL Editor**

2. Run:
   ```sql
   UPDATE ims_profiles
   SET
     role = 'super_admin',
     status = 'active',
     name = '系统管理员',
     phone = '13900000000'
   WHERE user_id = 'PASTE_USER_ID_HERE';
   ```

3. Verify:
   ```sql
   SELECT * FROM ims_profiles WHERE role = 'super_admin';
   ```

✅ Done! You can now login with this admin account.

---

### 3. Create Store Manager (Optional)

```sql
-- Create user in Dashboard first, then run:
UPDATE ims_profiles
SET
  role = 'store_manager',
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active',
  name = '李店长',
  phone = '13800138001'
WHERE user_id = 'MANAGER_USER_ID';
```

---

### 4. Frontend Integration

Update `frontend/.env`:

```bash
VITE_SUPABASE_URL=https://wdpeoyugsxqnpwwtkqsl.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Update auth service to use Supabase Auth (see README.md for full code).

---

## Quick Reference

### User Roles

| Role | Code | Description |
|------|------|-------------|
| 超级管理员 | `super_admin` | Full access |
| 店长 | `store_manager` | Manage one store |
| 厨师长 | `chef` | Kitchen operations |
| 员工 | `employee` | Basic access |

### Initial Stores

| Store Code | Store Name | City |
|------------|------------|------|
| YBL-CD-001 | 野百灵春熙路店 | 成都 |
| YBL-MY-001 | 野百灵绵阳1958店 | 绵阳 |
| YBL-DY-001 | 野百灵德阳店 | 德阳 |
| NGX-NJ-001 | 宁桂杏南京新街口店 | 南京 |
| NGX-SZ-001 | 宁桂杏苏州观前街店 | 苏州 |

### Helper SQL Queries

```sql
-- List all users with roles
SELECT
  p.name,
  p.phone,
  p.role,
  s.store_name,
  p.status,
  p.created_at
FROM ims_profiles p
LEFT JOIN ims_stores s ON p.store_id = s.id
ORDER BY p.created_at DESC;

-- List all stores
SELECT * FROM ims_stores ORDER BY city, store_name;

-- Count users by role
SELECT role, COUNT(*) as count
FROM ims_profiles
GROUP BY role;

-- Find inactive users
SELECT * FROM ims_profiles WHERE status != 'active';
```

---

## Troubleshooting

### Can't login after creating user?

Check profile status:
```sql
SELECT user_id, name, role, status FROM ims_profiles WHERE phone = 'YOUR_PHONE';
```

If status is `inactive`, update it:
```sql
UPDATE ims_profiles SET status = 'active' WHERE user_id = 'USER_ID';
```

### RLS blocking queries?

Verify user has correct role:
```sql
SELECT * FROM ims_profiles WHERE user_id = auth.uid();
```

### Need to reset everything?

```sql
-- Delete all profiles (keeps auth users)
DELETE FROM ims_profiles;

-- Delete all stores
DELETE FROM ims_stores;

-- Re-run seed migration
-- (paste content of 20241203000002_seed_stores.sql)
```

---

## Next Steps

1. ✅ Deploy migrations
2. ✅ Create admin user
3. ⏳ Update frontend to use Supabase Auth
4. ⏳ Test RLS policies
5. ⏳ Create additional users as needed
6. ⏳ Archive UserCenter backend (don't delete yet)

For detailed documentation, see [README.md](./README.md)
