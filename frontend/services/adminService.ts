/**
 * Admin 管理 API 服务
 * 处理审批相关操作
 */

import { authFetch } from './authService';
import { PaginatedResponse, PendingAccount } from '../types';

// UserCenter API 基础 URL
const USER_CENTER_URL = import.meta.env.VITE_USER_CENTER_URL || 'http://localhost:8001';

// 审批响应类型
export interface ReviewResponse {
  success: boolean;
  message: string;
  account_id?: string;
}

/**
 * 获取待审批账号列表
 */
export async function getPendingAccounts(
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedResponse<PendingAccount>> {
  const response = await authFetch(
    `${USER_CENTER_URL}/api/v1/admin/accounts/pending?page=${page}&page_size=${pageSize}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '获取待审批列表失败');
  }

  return response.json();
}

/**
 * 审批单个账号
 * @param accountId 账号ID
 * @param action 操作: approve 通过, reject 拒绝
 * @param reason 拒绝原因（拒绝时必填）
 */
export async function reviewAccount(
  accountId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<ReviewResponse> {
  const response = await authFetch(
    `${USER_CENTER_URL}/api/v1/admin/accounts/${accountId}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '审批操作失败');
  }

  return response.json();
}
