/**
 * Supabase 客户端 - 数据库访问
 * v3.1 - 修复全局 Content-Type 覆盖 Storage 上传问题
 *
 * 变更历史：
 * - v3.1: 移除全局 Content-Type header，避免覆盖 Storage 上传的 MIME 类型
 * - v3.0: 移除 Auth 配置，简化为仅数据库访问
 * - v2.0: 添加 Auth 配置，启用会话持久化
 * - v1.0: 初始版本（仅数据库访问）
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wdpeoyugsxqnpwwtkqsl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 创建 Supabase 客户端（单例）
let supabaseClient: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端实例
 * 仅用于数据库访问，不使用 Auth
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_ANON_KEY) {
      console.warn('⚠️ VITE_SUPABASE_ANON_KEY 未配置');
    }

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: {
        schema: 'public', // 使用 public schema
      },
      global: {
        headers: {
          // 注意：不要设置全局 Content-Type，会覆盖 Storage 上传的 MIME 类型
          'Accept': 'application/json',
          'Accept-Profile': 'public', // 指定 schema
          'Prefer': 'return=representation', // 要求返回完整数据
        },
      },
    });
  }

  return supabaseClient;
}

// 导出单例实例
export const supabase = getSupabaseClient();
