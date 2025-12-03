# Supabase Auth + RBAC - Complete Documentation Index

## Quick Navigation

| Document | Purpose | Start Here If... |
|----------|---------|------------------|
| **[QUICKSTART.md](./QUICKSTART.md)** | 5-minute deployment guide | You want to deploy NOW |
| **[README.md](./README.md)** | Complete implementation guide | You need full technical details |
| **[SCHEMA.md](./SCHEMA.md)** | Database schema reference | You need to understand the data model |
| **[MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)** | Step-by-step deployment checklist | You're doing the migration |

---

## What's Included

### 🗄️ Database Migrations

| File | Description |
|------|-------------|
| `migrations/20241203000001_init_auth_rbac.sql` | Main schema: tables, ENUMs, RLS policies, triggers, helper functions |
| `migrations/20241203000002_seed_stores.sql` | Initial store data (5 stores across 四川 & 江苏) |

**Total Size**: ~13KB SQL

---

## Schema Summary

### Tables Created

1. **`ims_stores`** - 门店表
   - Stores store locations and metadata
   - 5 pre-seeded stores
   - RLS: All authenticated users can view

2. **`ims_profiles`** - 用户档案表
   - Extends `auth.users` with business data
   - Links to `ims_stores` via `store_id`
   - RLS: Role-based access control

### ENUMs Created

- `ims_user_role`: super_admin | store_manager | chef | employee
- `ims_user_status`: active | inactive | suspended
- `ims_store_status`: active | inactive | maintenance

### Helper Functions

- `get_user_role()` - Get current user's role
- `get_user_store_id()` - Get current user's store
- `is_super_admin()` - Check if super admin
- `is_store_manager()` - Check if store manager
- `update_last_login()` - Update login timestamp

### Triggers

- Auto-create profile on user signup
- Auto-update `updated_at` timestamp

---

## Key Features

✅ **No Approval Workflow** - Admins manually create users via Supabase Dashboard
✅ **Simplified RBAC** - 4 roles instead of 8
✅ **Built-in Security** - Row Level Security (RLS) on all tables
✅ **Auto-provisioning** - Profiles auto-created when users sign up
✅ **Flexible Metadata** - JSONB fields for future extensions
✅ **Audit Trail** - Timestamps on all records

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Run Migrations                                      │
│ - Open Supabase SQL Editor                                  │
│ - Execute 20241203000001_init_auth_rbac.sql                │
│ - Execute 20241203000002_seed_stores.sql                   │
│ - Verify tables created                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Create Admin User                                   │
│ - Go to Authentication → Users                              │
│ - Add User (email + password)                               │
│ - Update profile with super_admin role                      │
│ - Test login                                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Update Frontend                                     │
│ - Install @supabase/supabase-js                            │
│ - Update authService.ts                                     │
│ - Update AuthContext.tsx                                    │
│ - Test login flow                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Verify & Monitor                                    │
│ - Test RLS policies                                         │
│ - Check performance                                         │
│ - Monitor logs for 7 days                                   │
│ - Archive UserCenter (don't delete yet)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Role Permissions Matrix

| Operation | employee | chef | store_manager | super_admin |
|-----------|----------|------|---------------|-------------|
| View own profile | ✅ | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ | ✅ |
| View store profiles | ❌ | ❌ | ✅ (own store) | ✅ (all) |
| Create users | ❌ | ❌ | ✅ (own store) | ✅ (all) |
| Edit users | ❌ | ❌ | ✅ (own store) | ✅ (all) |
| Delete users | ❌ | ❌ | ✅ (own store) | ✅ (all) |
| View stores | ✅ | ✅ | ✅ | ✅ |
| Manage stores | ❌ | ❌ | ❌ | ✅ |

---

## Initial Store Data

| Store Code | Store Name | City | Status |
|------------|------------|------|--------|
| YBL-CD-001 | 野百灵春熙路店 | 成都 | active |
| YBL-MY-001 | 野百灵绵阳1958店 | 绵阳 | active |
| YBL-DY-001 | 野百灵德阳店 | 德阳 | active |
| NGX-NJ-001 | 宁桂杏南京新街口店 | 南京 | active |
| NGX-SZ-001 | 宁桂杏苏州观前街店 | 苏州 | active |

---

## Code Examples

### Login (Frontend)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Update last login
  await supabase.rpc('update_last_login');

  return data;
}
```

### Get Current User with Profile (Frontend)

```typescript
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch profile with store info (RLS auto-filters)
  const { data: profile } = await supabase
    .from('ims_profiles')
    .select('*, store:ims_stores(*)')
    .eq('user_id', user.id)
    .single();

  return { ...user, profile };
}
```

### Create User (Backend/SQL)

```sql
-- Step 1: Create auth user via Supabase Dashboard
-- Step 2: Update profile
UPDATE ims_profiles
SET
  role = 'store_manager',
  store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001'),
  status = 'active',
  name = '张三',
  phone = '13800138000'
WHERE user_id = 'USER_ID_FROM_DASHBOARD';
```

---

## FAQ

### Q: Can I use Supabase CLI instead of Dashboard?

**A**: Yes! Run `supabase db push` from the project root to apply migrations.

### Q: How do I create users programmatically?

**A**: Use the Supabase Admin SDK (with service_role key) in your backend:

```typescript
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'password123',
  email_confirm: true,
  user_metadata: {
    name: '张三',
    phone: '13800138000'
  }
});

// Then update profile
await supabase
  .from('ims_profiles')
  .update({
    role: 'store_manager',
    store_id: storeId,
    status: 'active'
  })
  .eq('user_id', data.user.id);
```

### Q: What happens to existing UserCenter data?

**A**: Keep UserCenter as-is for now. After migration is stable, you can:
1. Export UserCenter data
2. Migrate to new schema (see SCHEMA.md for migration SQL)
3. Archive UserCenter backend

### Q: Can I add more roles later?

**A**: Yes! Add new values to the `ims_user_role` enum:

```sql
ALTER TYPE ims_user_role ADD VALUE 'new_role';
```

Then update RLS policies accordingly.

### Q: How do I test RLS policies?

**A**: Use `SET LOCAL request.jwt.claims` to impersonate users:

```sql
SET LOCAL request.jwt.claims TO '{"sub": "USER_UUID"}';
SELECT * FROM ims_profiles;
RESET request.jwt.claims;
```

---

## Support Resources

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **SQL Reference**: https://www.postgresql.org/docs/current/
- **Project Supabase**: https://supabase.com/dashboard/project/wdpeoyugsxqnpwwtkqsl

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-03 | Initial release - Auth + RBAC schema |

---

## Next Steps

1. ✅ Read [QUICKSTART.md](./QUICKSTART.md) for 5-minute setup
2. ⏳ Deploy migrations to Supabase
3. ⏳ Create admin user
4. ⏳ Update frontend auth service
5. ⏳ Test and verify
6. ⏳ Archive UserCenter (after 30 days)

**Questions?** Check [README.md](./README.md) for detailed documentation.
