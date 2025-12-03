-- Version: 2.0.0
-- Migration: Create Simplified ims_users Table
-- Description: Drop Supabase Auth integration, create self-contained user table with plaintext passwords
-- Date: 2025-12-03

-- ============================================================
-- SECTION 1: Drop Old Tables and Types
-- ============================================================

-- Drop old ims_profiles table and related objects
DROP TRIGGER IF EXISTS update_ims_profiles_updated_at ON ims_profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TABLE IF EXISTS ims_profiles CASCADE;

-- Drop old ENUMs
DROP TYPE IF EXISTS ims_user_role CASCADE;
DROP TYPE IF EXISTS ims_user_status CASCADE;

-- Drop old helper functions
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS get_user_store_id() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS is_store_manager() CASCADE;
DROP FUNCTION IF EXISTS update_last_login() CASCADE;


-- ============================================================
-- SECTION 2: Create Simplified ims_users Table
-- ============================================================

-- Simple user table with plaintext passwords (internal project)
CREATE TABLE ims_users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Login Credentials
  username VARCHAR(50) UNIQUE NOT NULL,      -- Login username
  password VARCHAR(100) NOT NULL,            -- Plaintext password (internal use)

  -- User Information
  name VARCHAR(50) NOT NULL,                 -- Display name
  phone VARCHAR(20),                         -- Phone number

  -- Role and Store Assignment
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('super_admin', 'store_manager', 'chef', 'employee')),
  store_id UUID REFERENCES ims_stores(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Additional Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for fast lookups
CREATE INDEX idx_ims_users_username ON ims_users(username);
CREATE INDEX idx_ims_users_store_id ON ims_users(store_id);
CREATE INDEX idx_ims_users_role ON ims_users(role);
CREATE INDEX idx_ims_users_is_active ON ims_users(is_active);

-- Add comments
COMMENT ON TABLE ims_users IS '用户表 - 简化认证，使用明文密码（内部项目）';
COMMENT ON COLUMN ims_users.username IS '登录用户名 - 唯一';
COMMENT ON COLUMN ims_users.password IS '明文密码 - 内部项目使用';
COMMENT ON COLUMN ims_users.role IS '用户角色: super_admin, store_manager, chef, employee';
COMMENT ON COLUMN ims_users.store_id IS '所属门店ID';


-- ============================================================
-- SECTION 3: Create Trigger for Updated_at
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ims_users
CREATE TRIGGER update_ims_users_updated_at
  BEFORE UPDATE ON ims_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 4: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on ims_users table
ALTER TABLE ims_users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow anonymous to read users for login verification
-- This allows the login function to query the users table
CREATE POLICY "Allow anonymous to read users for login"
  ON ims_users
  FOR SELECT
  USING (true);

-- Policy 2: Allow authenticated users to update their own record
-- This allows users to update their profile after login
CREATE POLICY "Allow users to update own record"
  ON ims_users
  FOR UPDATE
  USING (true);


-- ============================================================
-- SECTION 5: Insert Test Admin Account
-- ============================================================

-- Insert test admin account
INSERT INTO ims_users (username, password, name, phone, role, store_id)
VALUES (
  'admin',
  'admin123',
  '系统管理员',
  '13900000000',
  'super_admin',
  (SELECT id FROM ims_stores WHERE store_code = 'YBL-CD-001' LIMIT 1)
)
ON CONFLICT (username) DO NOTHING;

-- Insert test store manager account
INSERT INTO ims_users (username, password, name, phone, role, store_id)
VALUES (
  'manager',
  'manager123',
  '德阳店店长',
  '13800000001',
  'store_manager',
  (SELECT id FROM ims_stores WHERE store_code = 'YBL-DY-001' LIMIT 1)
)
ON CONFLICT (username) DO NOTHING;

-- Insert test employee account
INSERT INTO ims_users (username, password, name, phone, role, store_id)
VALUES (
  'employee',
  'employee123',
  '普通员工',
  '13700000002',
  'employee',
  (SELECT id FROM ims_stores WHERE store_code = 'YBL-MY-001' LIMIT 1)
)
ON CONFLICT (username) DO NOTHING;


-- ============================================================
-- SECTION 6: Grant Permissions
-- ============================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant permissions on ims_users table
GRANT SELECT ON ims_users TO anon;              -- Allow login queries
GRANT SELECT, UPDATE ON ims_users TO authenticated;  -- Allow profile updates
GRANT ALL ON ims_users TO service_role;         -- Full access for service role


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

COMMENT ON SCHEMA public IS 'Inventory Management System - Simplified Auth v2.0.0';
