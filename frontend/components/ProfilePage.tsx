/**
 * 个人中心页面
 * Storm Glass 风格
 */
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppView } from '../types';
import { Icons } from '../constants';

interface ProfilePageProps {
  onNavigate: (view: AppView) => void;
}

// 职位代码转中文
function getPositionLabel(code: string | null | undefined): string {
  const labels: Record<string, string> = {
    super_admin: '超级管理员',
    brand_admin: '品牌管理员',
    region_manager: '区域经理',
    city_manager: '城市经理',
    store_manager: '店长',
    supervisor: '主管',
    trainer: '培训师',
    employee: '员工',
  };
  return labels[code || ''] || '员工';
}

// 有审批权限的职位
const APPROVAL_ROLES = ['super_admin', 'brand_admin', 'region_manager', 'city_manager', 'store_manager'];

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();

  // 判断是否有审批权限
  const canApprove = APPROVAL_ROLES.includes(user?.position_code || '');

  // 用户首字母
  const userInitials = user?.name?.substring(0, 2) || user?.username?.substring(0, 2) || 'U';

  const handleLogout = async () => {
    await logout();
    // logout 后 isAuthenticated 变为 false，App.tsx 会自动显示登录页
  };

  return (
    <div className="space-y-6 animate-slide-in pb-20 max-w-2xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate(AppView.NEW_ENTRY)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <Icons.ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-2xl font-bold text-white">个人中心</h1>
      </div>

      {/* 用户信息卡片 */}
      <div className="glass-card-elevated p-6 space-y-4">
        {/* 头像 + 姓名 */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, rgba(91,163,192,0.4) 0%, rgba(91,163,192,0.2) 100%)' }}
          >
            {userInitials}
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{user?.name || '未设置姓名'}</div>
            <div className="text-white/60">{getPositionLabel(user?.position_code)}</div>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* 详细信息列表 */}
        <div className="space-y-3">
          <InfoRow label="手机号" value={user?.phone || '未绑定'} />
          <InfoRow label="用户名" value={user?.username || '-'} />
          <InfoRow label="所属品牌" value={user?.brand_name || '未绑定'} />
          <InfoRow label="所属门店" value={user?.store_name || '未绑定'} />
          <InfoRow label="员工编号" value={user?.employee_no || '-'} />
        </div>
      </div>

      {/* 审批管理入口 - 仅店长及以上可见 */}
      {canApprove && (
        <div
          onClick={() => onNavigate(AppView.APPROVAL)}
          className="glass-card p-4 flex items-center justify-between cursor-pointer active:opacity-90 transition-all hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(91,163,192,0.2)' }}
            >
              <Icons.Shield className="w-5 h-5 text-ios-blue" />
            </div>
            <div>
              <div className="text-white font-medium">审批管理</div>
              <div className="text-white/50 text-sm">审核待注册账号</div>
            </div>
          </div>
          <Icons.ChevronRight className="w-5 h-5 text-white/40" />
        </div>
      )}

      {/* 退出登录按钮 */}
      <button
        onClick={handleLogout}
        className="w-full py-4 flex items-center justify-center gap-2 rounded-glass-xl transition-all"
        style={{
          background: 'rgba(232, 90, 79, 0.15)',
          border: '1px solid rgba(232, 90, 79, 0.3)',
          color: '#E85A4F'
        }}
      >
        <Icons.Logout className="w-5 h-5" />
        退出登录
      </button>
    </div>
  );
};

// 信息行组件
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-white/60">{label}</span>
    <span className="text-white">{value}</span>
  </div>
);

export default ProfilePage;
