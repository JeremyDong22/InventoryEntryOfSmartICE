/**
 * 简化认证服务 - 直接查询 ims_users 表
 * v3.0 - 使用自建 ims_users 表，localStorage 会话管理
 *
 * 变更历史：
 * - v3.0: 移除 Supabase Auth，直接查询 ims_users 表，明文密码认证
 * - v2.0: 使用 Supabase Auth 替代 UserCenter
 * - v1.0: 使用 UserCenter JWT Token
 */

import { supabase } from './supabaseClient';

// 当前用户信息类型
export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  phone: string | null;
  role: string;
  store_id: string | null;
  store_name: string | null;
}

/**
 * 登录 - 直接查询 ims_users 表验证用户名和密码
 */
export async function login(username: string, password: string): Promise<CurrentUser> {
  const { data, error } = await supabase
    .from('ims_users')
    .select(`
      id,
      username,
      name,
      phone,
      role,
      store_id,
      ims_stores(store_name)
    `)
    .eq('username', username)
    .eq('password', password)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error('用户名或密码错误');
  }

  const user: CurrentUser = {
    id: data.id,
    username: data.username,
    name: data.name,
    phone: data.phone,
    role: data.role,
    store_id: data.store_id,
    store_name: (data.ims_stores as any)?.store_name || null,
  };

  // 保存到 localStorage
  localStorage.setItem('user', JSON.stringify(user));

  return user;
}

/**
 * 获取当前用户 - 从 localStorage 读取
 */
export function getCurrentUser(): CurrentUser | null {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 登出 - 清除 localStorage
 */
export function logout(): void {
  localStorage.removeItem('user');
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

/**
 * 检查是否已认证（异步版本，兼容旧代码）
 */
export async function isAuthenticated(): Promise<boolean> {
  return isLoggedIn();
}
