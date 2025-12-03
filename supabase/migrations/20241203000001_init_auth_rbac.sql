-- Version: 1.0.0
-- Migration: Initial Auth + RBAC Setup for Inventory Management System
-- Description: Creates ims_profiles, ims_stores tables and integrates with Supabase Auth
-- Date: 2024-12-03

-- ============================================================
-- SECTION 1: Enable Required Extensions
-- ============================================================

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for additional security functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- SECTION 2: Create ENUMs for Type Safety
-- ============================================================

-- User roles enum
CREATE TYPE ims_user_role AS ENUM (
  'super_admin',      -- 超级管理员 - 全局权限
  'store_manager',    -- 店长 - 门店管理
  'chef',            -- 厨师长 - 厨房相关
  'employee'         -- 普通员工 - 基础权限
);

-- User status enum
CREATE TYPE ims_user_status AS ENUM (
  'active',          -- 活跃用户
  'inactive',        -- 停用
  'suspended'        -- 暂停
);

-- Store status enum
CREATE TYPE ims_store_status AS ENUM (
  'active',          -- 营业中
  'inactive',        -- 已关闭
  'maintenance'      -- 维护中
);


-- ============================================================
-- SECTION 3: Create ims_stores Table (Must be first for FK)
-- ============================================================

-- Stores table - simplified structure
CREATE TABLE ims_stores (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Store Information
  store_code VARCHAR(50) UNIQUE NOT NULL,
  store_name VARCHAR(200) NOT NULL,

  -- Location
  province VARCHAR(50),
  city VARCHAR(50),
  district VARCHAR(50),
  address TEXT,

  -- Contact
  phone VARCHAR(20),

  -- Status
  status ims_store_status DEFAULT 'active' NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for stores
CREATE INDEX idx_ims_stores_code ON ims_stores(store_code);
CREATE INDEX idx_ims_stores_status ON ims_stores(status);
CREATE INDEX idx_ims_stores_city ON ims_stores(city);

-- Add comment
COMMENT ON TABLE ims_stores IS '门店表 - 存储门店基本信息';


-- ============================================================
-- SECTION 4: Create ims_profiles Table (Links to auth.users)
-- ============================================================

-- User profiles table - extends Supabase auth.users
CREATE TABLE ims_profiles (
  -- Primary Key (same as auth.users.id)
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User Information
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,

  -- Role and Store Assignment
  role ims_user_role DEFAULT 'employee' NOT NULL,
  store_id UUID REFERENCES ims_stores(id) ON DELETE SET NULL,

  -- Status
  status ims_user_status DEFAULT 'active' NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_login_at TIMESTAMPTZ,

  -- Additional Metadata (flexible for future extensions)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for profiles
CREATE INDEX idx_ims_profiles_role ON ims_profiles(role);
CREATE INDEX idx_ims_profiles_store_id ON ims_profiles(store_id);
CREATE INDEX idx_ims_profiles_status ON ims_profiles(status);
CREATE INDEX idx_ims_profiles_phone ON ims_profiles(phone);

-- Add comments
COMMENT ON TABLE ims_profiles IS '用户档案表 - 关联 auth.users，存储业务相关信息';
COMMENT ON COLUMN ims_profiles.user_id IS '用户ID - 关联 auth.users.id';
COMMENT ON COLUMN ims_profiles.role IS '用户角色';
COMMENT ON COLUMN ims_profiles.store_id IS '所属门店ID';


-- ============================================================
-- SECTION 5: Create Trigger for Updated_at
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ims_profiles
CREATE TRIGGER update_ims_profiles_updated_at
  BEFORE UPDATE ON ims_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for ims_stores
CREATE TRIGGER update_ims_stores_updated_at
  BEFORE UPDATE ON ims_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 6: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE ims_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ims_stores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies for ims_profiles
-- ============================================================

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON ims_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can update their own profile (limited fields)
CREATE POLICY "Users can update their own profile"
  ON ims_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON ims_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ims_profiles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- Policy 4: Store managers can view profiles in their store
CREATE POLICY "Store managers can view their store profiles"
  ON ims_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ims_profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'store_manager'
      AND p.status = 'active'
      AND p.store_id = ims_profiles.store_id
    )
  );

-- Policy 5: Super admins can insert/update/delete profiles
CREATE POLICY "Super admins can manage all profiles"
  ON ims_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ims_profiles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ims_profiles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
    )
  );

-- Policy 6: Store managers can manage profiles in their store
CREATE POLICY "Store managers can manage their store profiles"
  ON ims_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ims_profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'store_manager'
      AND p.status = 'active'
      AND p.store_id = ims_profiles.store_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ims_profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'store_manager'
      AND p.status = 'active'
      AND p.store_id = ims_profiles.store_id
    )
  );

-- ============================================================
-- RLS Policies for ims_stores
-- ============================================================

-- Policy 1: All authenticated users can view stores
CREATE POLICY "All authenticated users can view stores"
  ON ims_stores
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy 2: Only super admins can manage stores
CREATE POLICY "Super admins can manage stores"
  ON ims_stores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ims_profiles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ims_profiles
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND status = 'active'
    )
  );


-- ============================================================
-- SECTION 7: Helper Functions
-- ============================================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS ims_user_role AS $$
  SELECT role FROM ims_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get current user's store_id
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM ims_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM ims_profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is store manager
CREATE OR REPLACE FUNCTION is_store_manager()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM ims_profiles
    WHERE user_id = auth.uid()
    AND role = 'store_manager'
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ============================================================
-- SECTION 8: Trigger to Auto-create Profile on Auth Signup
-- ============================================================

-- Function to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ims_profiles (user_id, name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE(NEW.phone, NEW.email, 'no-phone'),
    'employee',
    'inactive'  -- New users start as inactive until admin assigns role/store
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SECTION 9: Update Last Login Timestamp Function
-- ============================================================

-- Function to update last_login_at
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS VOID AS $$
BEGIN
  UPDATE ims_profiles
  SET last_login_at = NOW()
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- SECTION 10: Grant Permissions
-- ============================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ims_profiles TO authenticated;
GRANT SELECT ON ims_stores TO authenticated;

-- Service role gets full access
GRANT ALL ON ims_profiles TO service_role;
GRANT ALL ON ims_stores TO service_role;


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

COMMENT ON SCHEMA public IS 'Inventory Management System - Auth & RBAC Schema v1.0.0';
