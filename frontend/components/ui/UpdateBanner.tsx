// v1.0 - 版本更新提示横幅，温和提示不打断用户操作
import React from 'react';
import { clsx } from 'clsx';

interface UpdateBannerProps {
  visible: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  visible,
  onRefresh,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50',
        'flex items-center justify-center gap-3 px-4 py-3',
        'bg-ios-blue/90 backdrop-blur-md',
        'text-white text-sm',
        'shadow-lg',
        'animate-slide-down'
      )}
    >
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        发现新版本
      </span>

      <button
        onClick={onRefresh}
        className={clsx(
          'px-3 py-1 rounded-full',
          'bg-white/20 hover:bg-white/30',
          'text-white font-medium text-xs',
          'transition-colors duration-200'
        )}
      >
        立即刷新
      </button>

      <button
        onClick={onDismiss}
        className={clsx(
          'p-1 rounded-full',
          'hover:bg-white/20',
          'transition-colors duration-200'
        )}
        aria-label="关闭"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
