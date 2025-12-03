# Database Schema - Simplified Auth

## Schema Overview

```
┌───────────────────────────────────────────────────────────────┐
│ ims_users (Self-contained User Table)                         │
│ ------------------------------------------------------------- │
│ id                UUID PRIMARY KEY                            │
│ username          VARCHAR(50) UNIQUE NOT NULL                 │
│ password          VARCHAR(100) NOT NULL                       │
│ name              VARCHAR(50) NOT NULL                        │
│ phone             VARCHAR(20)                                 │
│ role              VARCHAR(20) DEFAULT 'employee'              │
│ store_id          UUID → ims_stores.id (NULLABLE)            │
│ is_active         BOOLEAN DEFAULT true                        │
│ created_at        TIMESTAMPTZ NOT NULL                        │
│ updated_at        TIMESTAMPTZ NOT NULL                        │
│ metadata          JSONB DEFAULT '{}'                          │
└─────────────┬─────────────────────────────────────────────────┘
              │
              │ N:1 (SET NULL)
              ↓
┌───────────────────────────────────────────────────────────────┐
│ ims_stores (Store Locations)                                  │
│ ------------------------------------------------------------- │
│ id                UUID PRIMARY KEY                            │
│ store_code        VARCHAR(50) UNIQUE NOT NULL                 │
│ store_name        VARCHAR(200) NOT NULL                       │
│ province          VARCHAR(50)                                 │
│ city              VARCHAR(50)                                 │
│ district          VARCHAR(50)                                 │
│ address           TEXT                                        │
│ phone             VARCHAR(20)                                 │
│ status            ims_store_status NOT NULL DEFAULT 'active'  │
│ created_at        TIMESTAMPTZ NOT NULL                        │
│ updated_at        TIMESTAMPTZ NOT NULL                        │
│ metadata          JSONB DEFAULT '{}'                          │
└───────────────────────────────────────────────────────────────┘
```

---

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | 超级管理员 - 全局权限 |
| `store_manager` | 店长 - 门店管理 |
| `chef` | 厨师长 - 厨房相关 |
| `employee` | 普通员工 - 基础权限 |

---

## ENUM Types

### ims_store_status

```sql
CREATE TYPE ims_store_status AS ENUM (
  'active',          -- 营业中
  'inactive',        -- 已关闭
  'maintenance'      -- 维护中
);
```

---

## Relationships

### ims_stores → ims_users (1:N)

- **Type**: One-to-Many
- **Constraint**: `store_id` FK to `ims_stores.id`
- **On Delete**: SET NULL (keep user, remove store assignment)
- **Nullable**: Yes (super_admin doesn't need store assignment)

---

## Indexes

### ims_users

```sql
CREATE INDEX idx_ims_users_username ON ims_users(username);
CREATE INDEX idx_ims_users_store_id ON ims_users(store_id);
CREATE INDEX idx_ims_users_role ON ims_users(role);
CREATE INDEX idx_ims_users_is_active ON ims_users(is_active);
```

**Purpose**: Fast lookups by username (login), store, role, and active status.

### ims_stores

```sql
CREATE INDEX idx_ims_stores_code ON ims_stores(store_code);
CREATE INDEX idx_ims_stores_status ON ims_stores(status);
CREATE INDEX idx_ims_stores_city ON ims_stores(city);
```

**Purpose**: Fast lookups by store code, status, and city.

---

## Triggers

### Update Timestamp on Changes

```sql
CREATE TRIGGER update_ims_users_updated_at
  BEFORE UPDATE ON ims_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ims_stores_updated_at
  BEFORE UPDATE ON ims_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Function**:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**When**: Automatically runs before any UPDATE operation.

**What it does**: Updates the `updated_at` column to current timestamp.

---

## Row Level Security (RLS) Policies

### ims_users

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| Allow anonymous to read users for login | SELECT | `true` (allows login verification) |
| Allow users to update own record | UPDATE | `true` (allows profile updates) |

**Note**: RLS is simplified for internal project use. In production, consider more restrictive policies.

### ims_stores

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| (No RLS enabled) | - | Direct access allowed for authenticated users |

---

## Data Flow Examples

### Example 1: User Login

```
1. User submits username + password
   ↓
2. Frontend queries ims_users:
   SELECT * FROM ims_users
   WHERE username = ? AND password = ? AND is_active = true
   ↓
3. If match found, return user data with store info:
   SELECT u.*, s.store_name
   FROM ims_users u
   LEFT JOIN ims_stores s ON u.store_id = s.id
   WHERE u.username = ? AND u.password = ?
   ↓
4. Frontend saves user to localStorage
   ↓
5. User is logged in
```

### Example 2: Get User with Store Info

```sql
SELECT
  u.id,
  u.username,
  u.name,
  u.phone,
  u.role,
  u.is_active,
  s.store_code,
  s.store_name,
  s.city
FROM ims_users u
LEFT JOIN ims_stores s ON u.store_id = s.id
WHERE u.username = 'admin';
```

### Example 3: Create New User

```sql
INSERT INTO ims_users (username, password, name, phone, role, store_id)
VALUES (
  'newuser',
  'password123',
  '新用户',
  '13900000000',
  'employee',
  (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001')
);
```

---

## Default Test Accounts

After migration, the following test accounts are available:

| Username | Password | Role | Store | Name |
|----------|----------|------|-------|------|
| `admin` | `admin123` | super_admin | 野百灵春熙路店 | 系统管理员 |
| `manager` | `manager123` | store_manager | 野百灵德阳店 | 德阳店店长 |
| `employee` | `employee123` | employee | 野百灵绵阳1958店 | 普通员工 |

---

## Query Examples

### Verify Login

```sql
SELECT
  id,
  username,
  name,
  phone,
  role,
  store_id
FROM ims_users
WHERE username = 'admin'
AND password = 'admin123'
AND is_active = true;
```

### Get All Users in a Store

```sql
SELECT
  name,
  phone,
  role,
  is_active
FROM ims_users
WHERE store_id = (SELECT id FROM ims_stores WHERE store_code = 'YBL-DY-001')
ORDER BY name;
```

### Count Users by Role

```sql
SELECT
  role,
  COUNT(*) as user_count
FROM ims_users
WHERE is_active = true
GROUP BY role
ORDER BY user_count DESC;
```

### Active Stores by City

```sql
SELECT
  city,
  COUNT(*) as store_count
FROM ims_stores
WHERE status = 'active'
GROUP BY city
ORDER BY store_count DESC;
```

### Update User Password

```sql
UPDATE ims_users
SET password = 'newpassword123'
WHERE username = 'admin';
```

### Deactivate User

```sql
UPDATE ims_users
SET is_active = false
WHERE username = 'oldemployee';
```

---

## Design Principles

### 1. Simplicity
- Single self-contained user table
- No complex auth system integration
- Plaintext passwords (internal project)
- localStorage session management

### 2. Flexibility
- `metadata` JSONB field for future extensions
- Nullable `store_id` for super admins
- Simple role system with 4 roles

### 3. Performance
- Strategic indexes on lookup columns
- Efficient queries for login and user management

### 4. Auditability
- Timestamps on all tables
- Auto-updating `updated_at` via trigger

---

## Security Considerations

### Internal Project Use

This simplified auth system is designed for internal project use:

- **Plaintext passwords**: Suitable for internal tools with trusted users
- **No token management**: Uses localStorage for session
- **Simplified RLS**: Minimal policies for ease of development

### For Production

If deploying to production, consider:

1. **Hash passwords**: Use `pgcrypto` to hash passwords
   ```sql
   password = crypt('plaintext', gen_salt('bf'))
   ```

2. **Add JWT tokens**: Implement proper token-based auth

3. **Stricter RLS**: Implement role-based access policies

4. **Session expiry**: Add session timeout logic

5. **Audit logging**: Track login attempts and user actions

---

## Migration Path

### From Supabase Auth

If migrating from existing Supabase Auth setup:

```sql
-- Create ims_users from auth.users + ims_profiles
INSERT INTO ims_users (id, username, password, name, phone, role, store_id, is_active)
SELECT
  p.user_id,
  COALESCE(p.username, a.email),
  'changeme123',  -- Default password, users must reset
  p.name,
  p.phone,
  p.role::text,
  p.store_id,
  CASE WHEN p.status = 'active' THEN true ELSE false END
FROM ims_profiles p
JOIN auth.users a ON p.user_id = a.id;
```

---

## Future Extensions

Potential additions without breaking changes:

### 1. Password Hashing

```sql
-- Add hashed password column
ALTER TABLE ims_users ADD COLUMN password_hash VARCHAR(255);

-- Update trigger to auto-hash
CREATE OR REPLACE FUNCTION hash_password_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password IS NOT NULL THEN
    NEW.password_hash = crypt(NEW.password, gen_salt('bf'));
    NEW.password = NULL;  -- Clear plaintext
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Session Tokens

```sql
CREATE TABLE ims_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ims_users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Audit Log

```sql
CREATE TABLE ims_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ims_users(id),
  action VARCHAR(50),
  table_name VARCHAR(50),
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

All extensions use `metadata` JSONB field to avoid schema changes.

---

## Summary

This simplified schema provides:
- ✅ Simple, maintainable structure
- ✅ Self-contained user management
- ✅ No external auth dependencies
- ✅ Easy to understand and modify
- ✅ Suitable for internal projects
- ✅ Ready for immediate use

For deployment instructions, see [QUICKSTART.md](./QUICKSTART.md).
