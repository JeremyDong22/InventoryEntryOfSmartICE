/**
 * QueueHistoryPage - 上传队列历史记录页面
 * v2.0 - 重构：点击进入详情页，成功显示详情，失败可编辑重试，支持撤回
 *
 * 功能：
 * - 显示所有队列项（等待中、上传中、成功、失败）
 * - 点击卡片进入详情页
 * - 成功记录：显示只读详情
 * - 失败记录：可编辑并重新提交
 * - 等待中/上传中：支持撤回（取消）
 */

import React, { useState, useEffect } from 'react';
import { uploadQueueService, QueueItem, QueueStatus } from '../services/uploadQueueService';
import { Icons } from '../constants';
import { GlassCard } from './ui';
import { ProcurementItem } from '../types';

interface QueueHistoryPageProps {
  onBack: () => void;
}

type ViewMode = 'list' | 'detail';

export const QueueHistoryPage: React.FC<QueueHistoryPageProps> = ({ onBack }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<'all' | QueueStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);

  // 订阅队列变化
  useEffect(() => {
    setQueue(uploadQueueService.getQueue());
    const unsubscribe = uploadQueueService.subscribe((newQueue) => {
      setQueue(newQueue);
      // 如果正在查看的项被更新，同步更新
      if (selectedItem) {
        const updated = newQueue.find(i => i.id === selectedItem.id);
        if (updated) {
          setSelectedItem(updated);
        } else {
          // 项被删除，返回列表
          setViewMode('list');
          setSelectedItem(null);
        }
      }
    });
    return () => unsubscribe();
  }, [selectedItem?.id]);

  // 过滤和排序
  const filteredQueue = filter === 'all' ? queue : queue.filter(item => item.status === filter);
  const sortedQueue = [...filteredQueue].sort((a, b) => {
    const order: Record<QueueStatus, number> = { pending: 1, uploading: 2, failed: 3, success: 4 };
    return order[a.status] - order[b.status];
  });

  // 统计
  const stats = {
    total: queue.length,
    pending: queue.filter(i => i.status === 'pending').length,
    uploading: queue.filter(i => i.status === 'uploading').length,
    success: queue.filter(i => i.status === 'success').length,
    failed: queue.filter(i => i.status === 'failed').length,
  };

  // 撤回（取消）
  const handleCancel = (id: string) => {
    if (confirm('确认撤回该上传任务？')) {
      uploadQueueService.removeQueueItem(id);
    }
  };

  // 删除
  const handleDelete = (id: string) => {
    if (confirm('确认删除该记录？')) {
      uploadQueueService.removeQueueItem(id);
      if (selectedItem?.id === id) {
        setViewMode('list');
        setSelectedItem(null);
      }
    }
  };

  // 清空成功记录
  const handleClearSuccess = () => {
    if (stats.success === 0) return;
    if (confirm(`确认清空 ${stats.success} 条成功记录？`)) {
      uploadQueueService.clearSuccessItems();
    }
  };

  // 点击卡片进入详情
  const handleItemClick = (item: QueueItem) => {
    setSelectedItem(item);
    setViewMode('detail');
  };

  // 返回列表
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedItem(null);
  };

  // 渲染列表视图
  if (viewMode === 'list') {
    return (
      <div className="h-full flex flex-col animate-slide-in relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-glass-bg backdrop-blur-glass border border-glass-border flex items-center justify-center text-secondary hover:bg-glass-bg-hover transition-colors"
            >
              <Icons.ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-primary tracking-tight">上传记录</h2>
          </div>
          {stats.success > 0 && (
            <button onClick={handleClearSuccess} className="text-sm text-white/60 hover:text-white transition-colors">
              清空成功
            </button>
          )}
        </div>

        {/* 统计信息 */}
        <div className="px-6 pb-4 flex-shrink-0">
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'all', label: '全部', count: stats.total, color: 'white' },
              { key: 'pending', label: '等待', count: stats.pending + stats.uploading, color: 'ios-blue' },
              { key: 'success', label: '成功', count: stats.success, color: 'ios-green' },
              { key: 'failed', label: '失败', count: stats.failed, color: 'ios-red' },
            ].map(({ key, label, count, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`py-2 rounded-glass-lg border transition-all ${
                  filter === key ? `border-${color}/40 bg-${color}/10` : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="text-xs text-muted mb-1">{label}</div>
                <div className={`text-lg font-bold ${color === 'white' ? 'text-primary' : `text-${color}`}`}>{count}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 队列列表 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {sortedQueue.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-muted">暂无上传记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedQueue.map((item) => (
                <QueueItemCard
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 渲染详情视图
  return (
    <DetailView
      item={selectedItem!}
      onBack={handleBackToList}
      onDelete={handleDelete}
    />
  );
};

// ============ 队列项卡片 ============

const QueueItemCard: React.FC<{
  item: QueueItem;
  onClick: () => void;
  onCancel: (id: string) => void;
}> = ({ item, onClick, onCancel }) => {
  const statusConfig: Record<QueueStatus, { color: string; icon: any; label: string; bgColor: string }> = {
    pending: { color: 'text-ios-blue', bgColor: 'bg-ios-blue/10', icon: Icons.Clock, label: '等待上传' },
    uploading: { color: 'text-ios-blue', bgColor: 'bg-ios-blue/10', icon: Icons.ArrowRight, label: '上传中...' },
    success: { color: 'text-ios-green', bgColor: 'bg-ios-green/10', icon: Icons.Check, label: '上传成功' },
    failed: { color: 'text-ios-red', bgColor: 'bg-ios-red/10', icon: Icons.X, label: '上传失败' },
  };

  const config = statusConfig[item.status];
  const StatusIcon = config.icon;
  const canCancel = item.status === 'pending' || item.status === 'uploading';

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  };

  return (
    <GlassCard padding="md" className="relative group cursor-pointer active:scale-[0.99] transition-transform" onClick={onClick}>
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          {item.status === 'uploading' ? (
            <div className="w-5 h-5 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
          ) : (
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-primary truncate">{item.data.supplier}</h3>
            <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-secondary mb-1">
            <span>{item.data.items.length} 项</span>
            <span>¥{item.data.totalCost.toFixed(2)}</span>
            <span className="text-muted">{formatTime(item.createdAt)}</span>
          </div>

          {/* 失败原因预览 */}
          {item.status === 'failed' && item.error && (
            <div className="mt-2 p-2 rounded-lg bg-ios-red/10 border border-ios-red/20">
              <p className="text-xs text-ios-red line-clamp-1">{item.error}</p>
            </div>
          )}

          {/* 撤回按钮 */}
          {canCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(item.id); }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-colors"
            >
              撤回
            </button>
          )}
        </div>

        {/* 进入详情箭头 */}
        <Icons.ArrowRight className="w-5 h-5 text-white/30 flex-shrink-0 self-center" />
      </div>
    </GlassCard>
  );
};

// ============ 详情视图 ============

const DetailView: React.FC<{
  item: QueueItem;
  onBack: () => void;
  onDelete: (id: string) => void;
}> = ({ item, onBack, onDelete }) => {
  // 编辑状态（仅失败记录可编辑）
  const [editedItems, setEditedItems] = useState<ProcurementItem[]>(item.data.items);
  const [editedSupplier, setEditedSupplier] = useState(item.data.supplier);
  const [editedNotes, setEditedNotes] = useState(item.data.notes || '');
  const [isResubmitting, setIsResubmitting] = useState(false);

  const isEditable = item.status === 'failed';
  const isSuccess = item.status === 'success';

  // 重新提交
  const handleResubmit = async () => {
    if (!isEditable) return;
    setIsResubmitting(true);

    // 更新队列项数据
    const newData = {
      ...item.data,
      supplier: editedSupplier,
      notes: editedNotes,
      items: editedItems,
      totalCost: editedItems.reduce((sum, i) => sum + (i.total || 0), 0),
    };

    uploadQueueService.updateQueueItemData(item.id, newData);
    setIsResubmitting(false);
    onBack();
  };

  // 物品编辑
  const handleItemChange = (index: number, field: keyof ProcurementItem, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    // 自动计算小计
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unitPrice || 0);
    }
    setEditedItems(newItems);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
  };

  const statusConfig: Record<QueueStatus, { color: string; label: string; bgColor: string }> = {
    pending: { color: 'text-ios-blue', bgColor: 'bg-ios-blue/10', label: '等待上传' },
    uploading: { color: 'text-ios-blue', bgColor: 'bg-ios-blue/10', label: '上传中...' },
    success: { color: 'text-ios-green', bgColor: 'bg-ios-green/10', label: '上传成功' },
    failed: { color: 'text-ios-red', bgColor: 'bg-ios-red/10', label: '上传失败' },
  };

  const config = statusConfig[item.status];

  return (
    <div className="h-full flex flex-col animate-slide-in relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-glass-bg backdrop-blur-glass border border-glass-border flex items-center justify-center text-secondary hover:bg-glass-bg-hover transition-colors"
          >
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-primary tracking-tight">
            {isEditable ? '编辑并重新上传' : '上传详情'}
          </h2>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
          {config.label}
        </span>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        {/* 失败原因 */}
        {item.status === 'failed' && item.error && (
          <div className="mb-4 p-4 rounded-glass-lg border border-ios-red/30"
               style={{ background: 'rgba(232, 90, 79, 0.15)' }}>
            <div className="flex items-start gap-3">
              <Icons.X className="w-5 h-5 text-ios-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ios-red mb-1">上传失败原因</p>
                <p className="text-sm text-white/90">{item.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 基本信息 */}
        <GlassCard padding="lg" className="mb-4">
          <div className="space-y-4">
            {/* 供应商 */}
            <div>
              <label className="text-xs text-muted uppercase tracking-wider mb-2 block">供应商</label>
              {isEditable ? (
                <input
                  type="text"
                  value={editedSupplier}
                  onChange={(e) => setEditedSupplier(e.target.value)}
                  className="w-full px-4 py-3 rounded-glass-lg bg-white/5 border border-white/10 text-white focus:border-ios-blue/50 focus:outline-none"
                />
              ) : (
                <p className="text-lg font-semibold text-primary">{item.data.supplier}</p>
              )}
            </div>

            {/* 时间 */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">创建时间</label>
                <p className="text-sm text-secondary">{formatTime(item.createdAt)}</p>
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">更新时间</label>
                <p className="text-sm text-secondary">{formatTime(item.updatedAt)}</p>
              </div>
            </div>

            {/* 备注 */}
            {(item.data.notes || isEditable) && (
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-2 block">备注</label>
                {isEditable ? (
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 rounded-glass-lg bg-white/5 border border-white/10 text-white focus:border-ios-blue/50 focus:outline-none resize-none"
                  />
                ) : (
                  <p className="text-sm text-secondary">{item.data.notes || '无'}</p>
                )}
              </div>
            )}
          </div>
        </GlassCard>

        {/* 物品清单 */}
        <GlassCard padding="lg">
          <h3 className="text-base font-bold text-primary mb-4">物品清单（{editedItems.length} 项）</h3>
          <div className="space-y-4">
            {editedItems.map((procItem, idx) => (
              <div key={idx} className="p-3 rounded-glass-lg bg-white/5 border border-white/10">
                {isEditable ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={procItem.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                      placeholder="商品名称"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        value={procItem.quantity || ''}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                        placeholder="数量"
                      />
                      <input
                        type="text"
                        value={procItem.unit || ''}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                        placeholder="单位"
                      />
                      <input
                        type="number"
                        value={procItem.unitPrice || ''}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                        placeholder="单价"
                      />
                    </div>
                    <div className="text-right text-sm text-ios-blue">
                      小计：¥{(procItem.total || 0).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-primary">{procItem.name}</p>
                      <p className="text-sm text-muted mt-1">
                        {procItem.specification ? `${procItem.specification} | ` : ''}
                        {procItem.quantity}{procItem.unit} × ¥{procItem.unitPrice}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-ios-blue">¥{(procItem.total || 0).toFixed(2)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 总计 */}
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <span className="text-secondary">总计金额</span>
            <span className="text-2xl font-bold text-ios-blue">
              ¥{editedItems.reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-6 left-4 right-4 z-50 safe-area-bottom">
        {isEditable ? (
          <div className="flex gap-3">
            <button
              onClick={() => onDelete(item.id)}
              className="flex-1 py-4 rounded-2xl text-white font-semibold transition-all border border-white/10 flex items-center justify-center gap-2"
              style={{
                background: 'rgba(30, 30, 35, 0.65)',
                backdropFilter: 'blur(40px)',
              }}
            >
              <Icons.X className="w-5 h-5" />
              <span>删除</span>
            </button>
            <button
              onClick={handleResubmit}
              disabled={isResubmitting}
              className="flex-1 py-4 rounded-2xl text-white font-semibold transition-all border border-ios-blue/30 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(91,163,192,0.3) 0%, rgba(91,163,192,0.15) 100%)',
                backdropFilter: 'blur(40px)',
              }}
            >
              {isResubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icons.Check className="w-5 h-5" />
              )}
              <span>重新上传</span>
            </button>
          </div>
        ) : isSuccess ? (
          <button
            onClick={() => onDelete(item.id)}
            className="w-full py-4 rounded-2xl text-white font-semibold transition-all border border-white/10 flex items-center justify-center gap-2"
            style={{
              background: 'rgba(30, 30, 35, 0.65)',
              backdropFilter: 'blur(40px)',
            }}
          >
            <Icons.X className="w-5 h-5" />
            <span>删除记录</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
