-- Version: 1.0.0
-- Migration: Seed Initial Store Data
-- Description: Populate ims_stores with initial store data
-- Date: 2024-12-03

-- ============================================================
-- Insert Initial Stores
-- ============================================================

-- Insert sample stores (based on project context)
INSERT INTO ims_stores (store_code, store_name, province, city, district, address, phone, status, metadata)
VALUES
  -- 四川区域门店
  (
    'YBL-CD-001',
    '野百灵春熙路店',
    '四川省',
    '成都市',
    '锦江区',
    '春熙路步行街',
    '028-12345678',
    'active',
    '{"opening_hours": "10:00-22:00", "area_sqm": 200}'::jsonb
  ),
  (
    'YBL-MY-001',
    '野百灵绵阳1958店',
    '四川省',
    '绵阳市',
    '涪城区',
    '临园路东段1958创意园区',
    '0816-12345678',
    'active',
    '{"opening_hours": "10:00-22:00", "area_sqm": 180}'::jsonb
  ),
  (
    'YBL-DY-001',
    '野百灵德阳店',
    '四川省',
    '德阳市',
    '旌阳区',
    '文庙广场',
    '0838-12345678',
    'active',
    '{"opening_hours": "10:00-22:00", "area_sqm": 150}'::jsonb
  ),

  -- 江苏区域门店
  (
    'NGX-NJ-001',
    '宁桂杏南京新街口店',
    '江苏省',
    '南京市',
    '玄武区',
    '新街口商业区',
    '025-12345678',
    'active',
    '{"opening_hours": "10:00-22:00", "area_sqm": 220}'::jsonb
  ),
  (
    'NGX-SZ-001',
    '宁桂杏苏州观前街店',
    '江苏省',
    '苏州市',
    '姑苏区',
    '观前街步行街',
    '0512-12345678',
    'active',
    '{"opening_hours": "10:00-22:00", "area_sqm": 190}'::jsonb
  )
ON CONFLICT (store_code) DO NOTHING;

-- Add comment
COMMENT ON TABLE ims_stores IS '门店表 - 已初始化5家门店数据';
