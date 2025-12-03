/**
 * 修改密码页面
 * v1.0 - 验证原密码后修改新密码
 *
 * 流程：
 * 1. 输入原密码
 * 2. 验证原密码正确
 * 3. 输入新密码（两次确认）
 * 4. 更新数据库密码
 */

import React, { useState } from 'react';
import { Icons } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/authService';

interface ChangePasswordPageProps {
  onBack: () => void;
}

export const ChangePasswordPage: React.FC<ChangePasswordPageProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 验证新密码
    if (newPassword.length < 6) {
      setError('新密码长度至少6位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    if (newPassword === currentPassword) {
      setError('新密码不能与原密码相同');
      return;
    }

    setLoading(true);

    try {
      await changePassword(user!.id, currentPassword, newPassword);
      setSuccess(true);
      // 3秒后返回
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err: any) {
      setError(err.message || '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          className="w-full max-w-md p-8 rounded-glass-xl text-center"
          style={{
            background: 'rgba(25,25,30,0.75)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.15)'
          }}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-green-500/20">
            <Icons.Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">密码修改成功</h2>
          <p className="text-white/60">正在返回...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md p-8 rounded-glass-xl"
        style={{
          background: 'rgba(25,25,30,0.75)',
          backdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.15)'
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-glass-md hover:bg-white/10 transition-colors"
          >
            <Icons.ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">修改密码</h1>
            <p className="text-sm text-white/60">{user?.name}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 原密码 */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              原密码
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="请输入原密码"
              required
              className="w-full px-4 py-3 rounded-glass-md text-white placeholder-white/40 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(91,163,192,0.5)';
                e.target.style.background = 'rgba(255,255,255,0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.background = 'rgba(255,255,255,0.08)';
              }}
            />
          </div>

          {/* 新密码 */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              新密码
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-glass-md text-white placeholder-white/40 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(91,163,192,0.5)';
                e.target.style.background = 'rgba(255,255,255,0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.background = 'rgba(255,255,255,0.08)';
              }}
            />
          </div>

          {/* 确认新密码 */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              确认新密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              required
              className="w-full px-4 py-3 rounded-glass-md text-white placeholder-white/40 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(91,163,192,0.5)';
                e.target.style.background = 'rgba(255,255,255,0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.background = 'rgba(255,255,255,0.08)';
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-glass-md bg-red-500/20 border border-red-500/30">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-glass-lg font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(91,163,192,0.6) 0%, rgba(91,163,192,0.4) 100%)',
              boxShadow: '0 4px 20px rgba(91,163,192,0.3)'
            }}
          >
            {loading ? '提交中...' : '确认修改'}
          </button>
        </form>
      </div>
    </div>
  );
};
