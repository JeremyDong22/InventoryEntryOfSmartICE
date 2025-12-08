/**
 * 简化认证服务 - 直接查询 ims_users 表
 * v4.3 - 添加 brand_code 品牌标识，支持按品牌过滤物料
 *
 * 变更历史：
 * - v4.3: 添加 brand_code 字段，用于区分野百灵(YBL)/宁桂杏(NGX)品牌
 * - v4.2: 添加 refreshUser 函数，支持 Stale-While-Revalidate 模式
 * - v4.1: 添加 nickname 字段，用于更亲切的显示名称
 * - v4.0: 登录失败5次锁定账号，支持修改密码
 * - v3.0: 移除 Supabase Auth，直接查询 ims_users 表，明文密码认证
 * - v2.0: 使用 Supabase Auth 替代 UserCenter
 * - v1.0: 使用 UserCenter JWT Token
 */

import { supabase } from './supabaseClient';

// 最大登录失败次数
const MAX_LOGIN_ATTEMPTS = 5;

// 当前用户信息类型
export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  nickname: string | null;  // 昵称，用于更亲切的显示
  phone: string | null;
  role: string;
  store_id: string | null;
  store_name: string | null;
  brand_code: string | null; // 品牌标识: YBL=野百灵, NGX=宁桂杏
}

/**
 * 登录 - 直接查询 ims_users 表验证用户名和密码
 * 支持账号锁定检查和失败计数
 */
export async function login(username: string, password: string): Promise<CurrentUser> {
  // 1. 先查询用户是否存在及锁定状态
  const { data: userData, error: userError } = await supabase
    .from('ims_users')
    .select('id, is_locked, login_failed_count')
    .eq('username', username)
    .eq('is_active', true)
    .single();

  if (userError || !userData) {
    throw new Error('用户名或密码错误');
  }

  // 2. 检查账号是否被锁定
  if (userData.is_locked) {
    throw new Error('账号已被锁定，请联系管理员解锁');
  }

  // 3. 验证密码
  const { data, error } = await supabase
    .from('ims_users')
    .select(`
      id,
      username,
      name,
      nickname,
      phone,
      role,
      store_id,
      ims_stores(store_name, brand_code)
    `)
    .eq('username', username)
    .eq('password', password)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    // 密码错误，增加失败次数
    const newFailedCount = (userData.login_failed_count || 0) + 1;
    const shouldLock = newFailedCount >= MAX_LOGIN_ATTEMPTS;

    await supabase
      .from('ims_users')
      .update({
        login_failed_count: newFailedCount,
        is_locked: shouldLock,
        locked_at: shouldLock ? new Date().toISOString() : null
      })
      .eq('id', userData.id);

    if (shouldLock) {
      throw new Error('密码错误次数过多，账号已被锁定');
    }

    const remainingAttempts = MAX_LOGIN_ATTEMPTS - newFailedCount;
    throw new Error(`密码错误，还剩 ${remainingAttempts} 次尝试机会`);
  }

  // 4. 登录成功，重置失败次数
  await supabase
    .from('ims_users')
    .update({
      login_failed_count: 0
    })
    .eq('id', data.id);

  const user: CurrentUser = {
    id: data.id,
    username: data.username,
    name: data.name,
    nickname: data.nickname || null,
    phone: data.phone,
    role: data.role,
    store_id: data.store_id,
    store_name: (data.ims_stores as any)?.store_name || null,
    brand_code: (data.ims_stores as any)?.brand_code || null,
  };

  // 保存到 localStorage
  localStorage.setItem('user', JSON.stringify(user));

  return user;
}

/**
 * 修改密码 - 验证原密码后更新新密码
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // 1. 验证原密码
  const { data: userData, error: verifyError } = await supabase
    .from('ims_users')
    .select('id')
    .eq('id', userId)
    .eq('password', currentPassword)
    .single();

  if (verifyError || !userData) {
    throw new Error('原密码错误');
  }

  // 2. 更新新密码
  const { error: updateError } = await supabase
    .from('ims_users')
    .update({ password: newPassword })
    .eq('id', userId);

  if (updateError) {
    console.error('更新密码失败:', updateError);
    throw new Error('修改密码失败，请稍后重试');
  }
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

/**
 * 刷新用户信息 - SWR 模式核心函数
 * 从数据库获取最新用户信息，如果有变化则更新 localStorage
 *
 * @param userId 用户 ID
 * @returns 最新的用户信息，如果用户不存在或已禁用则返回 null
 */
export async function refreshUser(userId: string): Promise<CurrentUser | null> {
  try {
    const { data, error } = await supabase
      .from('ims_users')
      .select(`
        id,
        username,
        name,
        nickname,
        phone,
        role,
        store_id,
        ims_stores(store_name, brand_code)
      `)
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // 用户不存在或已禁用，清除本地缓存
      console.warn('用户信息刷新失败，可能已被禁用:', error?.message);
      return null;
    }

    const freshUser: CurrentUser = {
      id: data.id,
      username: data.username,
      name: data.name,
      nickname: data.nickname || null,
      phone: data.phone,
      role: data.role,
      store_id: data.store_id,
      store_name: (data.ims_stores as any)?.store_name || null,
      brand_code: (data.ims_stores as any)?.brand_code || null,
    };

    // 更新 localStorage
    localStorage.setItem('user', JSON.stringify(freshUser));

    return freshUser;
  } catch (err) {
    // 网络错误等，静默失败，继续使用缓存
    console.warn('刷新用户信息时网络错误，继续使用缓存:', err);
    return null;
  }
}
