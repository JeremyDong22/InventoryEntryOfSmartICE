/**
 * 审批管理页面
 * Storm Glass 风格
 */
import React, { useState, useEffect } from 'react';
import { getPendingAccounts, reviewAccount } from '../services/adminService';
import { PendingAccount, AppView } from '../types';
import { Icons } from '../constants';

interface ApprovalPageProps {
  onNavigate: (view: AppView) => void;
}

export const ApprovalPage: React.FC<ApprovalPageProps> = ({ onNavigate }) => {
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadPendingAccounts();
  }, []);

  const loadPendingAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getPendingAccounts();
      setAccounts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (accountId: string, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const reason = prompt('请输入拒绝原因：');
      if (!reason) return;
      await doReview(accountId, action, reason);
    } else {
      await doReview(accountId, action);
    }
  };

  const doReview = async (accountId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      setActionLoading(accountId);
      await reviewAccount(accountId, action, reason);
      // 移除已处理的账号
      setAccounts(prev => prev.filter(a => a.account_id !== accountId));
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-slide-in pb-20 max-w-2xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate(AppView.PROFILE)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <Icons.ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-2xl font-bold text-white">审批管理</h1>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="text-center py-12 text-white/60">加载中...</div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="glass-card p-4 text-center">
          <span className="text-ios-red">{error}</span>
          <button
            onClick={loadPendingAccounts}
            className="ml-2 text-ios-blue underline"
          >
            重试
          </button>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && !error && accounts.length === 0 && (
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(107, 158, 138, 0.2)' }}
          >
            <Icons.Check className="w-8 h-8 text-ios-green" />
          </div>
          <div className="text-white font-medium">暂无待审批账号</div>
          <div className="text-white/50 text-sm mt-1">所有注册请求已处理完毕</div>
        </div>
      )}

      {/* 待审批列表 */}
      {!isLoading && accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.account_id} className="glass-card p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-white font-semibold">{account.employee_name}</div>
                  <div className="text-white/60 text-sm">{account.phone}</div>
                  <div className="text-white/40 text-xs mt-1">门店：{account.store_name}</div>
                  <div className="text-white/40 text-xs">邀请码：{account.invitation_code || '-'}</div>
                  <div className="text-white/40 text-xs">
                    申请时间：{new Date(account.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleReview(account.account_id, 'approve')}
                  disabled={actionLoading === account.account_id}
                  className="flex-1 py-2 rounded-glass-lg font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: 'rgba(107, 158, 138, 0.2)',
                    color: '#6B9E8A',
                  }}
                >
                  {actionLoading === account.account_id ? '处理中...' : '通过'}
                </button>
                <button
                  onClick={() => handleReview(account.account_id, 'reject')}
                  disabled={actionLoading === account.account_id}
                  className="flex-1 py-2 rounded-glass-lg font-medium transition-colors disabled:opacity-50"
                  style={{
                    background: 'rgba(232, 90, 79, 0.2)',
                    color: '#E85A4F',
                  }}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalPage;
