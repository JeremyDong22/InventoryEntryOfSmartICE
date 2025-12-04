/**
 * QueueHistoryPage - 采购记录页面
 * v4.1 - 修复收货单图片加载（解析JSON数组格式的URL）
 * v4.0 - 合并显示历史记录和上传队列，供应商作为标题，支持删除
 *
 * 功能：
 * - 混合显示数据库历史记录 + 本地上传队列
 * - 按时间倒序排列
 * - 供应商名称作为标题
 * - 历史记录支持删除（同步数据库）
 * - 懒加载：滚动到底部自动加载更多
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { uploadQueueService, QueueItem, QueueStatus } from '../services/uploadQueueService';
import { getProcurementHistory, deleteProcurementRecord, ProcurementHistoryItem } from '../services/supabaseService';
import { Icons } from '../constants';
import { GlassCard } from './ui';
import { ProcurementItem } from '../types';

interface QueueHistoryPageProps {
  onBack: () => void;
}

// 统一的记录类型
type RecordType = 'queue' | 'history';
interface UnifiedRecord {
  type: RecordType;
  id: string | number;
  supplierName: string;
  totalAmount: number;
  itemCount: number;
  timestamp: number;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'completed';
  original: QueueItem | ProcurementHistoryItem;
}

type ViewMode = 'list' | 'detail';

export const QueueHistoryPage: React.FC<QueueHistoryPageProps> = ({ onBack }) => {
  // 本地队列状态
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // 数据库历史状态
  const [history, setHistory] = useState<ProcurementHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // UI 状态
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedRecord, setSelectedRecord] = useState<UnifiedRecord | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 订阅本地队列变化
  useEffect(() => {
    setQueue(uploadQueueService.getQueue());
    const unsubscribe = uploadQueueService.subscribe((newQueue) => {
      setQueue(newQueue);
    });
    return () => unsubscribe();
  }, []);

  // 加载数据库历史记录
  const loadHistory = useCallback(async (page: number, append: boolean = false) => {
    if (loadingHistory) return;
    setLoadingHistory(true);

    try {
      const result = await getProcurementHistory(page, 20);
      if (append) {
        setHistory(prev => [...prev, ...result.data]);
      } else {
        setHistory(result.data);
      }
      setHasMore(result.hasMore);
      setHistoryPage(page);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [loadingHistory]);

  // 初始加载历史记录
  useEffect(() => {
    loadHistory(0);
  }, []);

  // 滚动加载更多
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMore || loadingHistory) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      loadHistory(historyPage + 1, true);
    }
  }, [hasMore, loadingHistory, historyPage, loadHistory]);

  // 合并并排序记录
  const unifiedRecords: UnifiedRecord[] = [
    // 本地队列（未成功的）
    ...queue
      .filter(item => item.status !== 'success')
      .map(item => ({
        type: 'queue' as RecordType,
        id: item.id,
        supplierName: item.data.supplier || '未知供应商',
        totalAmount: item.data.totalCost,
        itemCount: item.data.items.length,
        timestamp: item.createdAt,
        status: item.status as UnifiedRecord['status'],
        original: item,
      })),
    // 数据库历史记录
    ...history.map(item => ({
      type: 'history' as RecordType,
      id: item.id,
      supplierName: item.supplier_name || '未知供应商',
      totalAmount: item.total_amount,
      itemCount: 1,
      timestamp: new Date(item.created_at).getTime(),
      status: 'completed' as UnifiedRecord['status'],
      original: item,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  // 撤回/删除队列项
  const handleDeleteQueue = (id: string) => {
    if (confirm('确认删除该上传任务？')) {
      uploadQueueService.removeQueueItem(id);
      if (selectedRecord?.id === id) {
        setViewMode('list');
        setSelectedRecord(null);
      }
    }
  };

  // 删除历史记录（数据库）
  const handleDeleteHistory = async (id: number) => {
    if (confirm('确认删除该采购记录？此操作不可撤销。')) {
      try {
        await deleteProcurementRecord(id);
        setHistory(prev => prev.filter(item => item.id !== id));
        if (selectedRecord?.id === id) {
          setViewMode('list');
          setSelectedRecord(null);
        }
      } catch (error) {
        alert('删除失败，请重试');
      }
    }
  };

  // 点击记录
  const handleRecordClick = (record: UnifiedRecord) => {
    setSelectedRecord(record);
    setViewMode('detail');
  };

  // 返回列表
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedRecord(null);
  };

  // 格式化时间
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

  // 详情视图
  if (viewMode === 'detail' && selectedRecord) {
    if (selectedRecord.type === 'queue') {
      return (
        <QueueDetailView
          item={selectedRecord.original as QueueItem}
          onBack={handleBackToList}
          onDelete={handleDeleteQueue}
        />
      );
    }
    return (
      <HistoryDetailView
        item={selectedRecord.original as ProcurementHistoryItem}
        onBack={handleBackToList}
        onDelete={handleDeleteHistory}
      />
    );
  }

  // 列表视图
  return (
    <div className="h-full flex flex-col animate-slide-in relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-glass-bg backdrop-blur-glass border border-glass-border flex items-center justify-center text-secondary hover:bg-glass-bg-hover transition-colors"
        >
          <Icons.ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-primary tracking-tight">采购记录</h2>
      </div>

      {/* 列表内容 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 pb-6"
      >
        {unifiedRecords.length === 0 && !loadingHistory ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted">暂无采购记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unifiedRecords.map((record) => (
              <RecordCard
                key={`${record.type}-${record.id}`}
                record={record}
                onClick={() => handleRecordClick(record)}
                onDelete={record.type === 'queue'
                  ? () => handleDeleteQueue(record.id as string)
                  : () => handleDeleteHistory(record.id as number)
                }
                formatTime={formatTime}
              />
            ))}
            {loadingHistory && (
              <div className="py-4 flex justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && unifiedRecords.length > 0 && (
              <p className="text-center text-muted text-sm py-4">已加载全部记录</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============ 统一记录卡片 ============

const RecordCard: React.FC<{
  record: UnifiedRecord;
  onClick: () => void;
  onDelete: () => void;
  formatTime: (t: number) => string;
}> = ({ record, onClick, onDelete, formatTime }) => {
  const statusConfig: Record<UnifiedRecord['status'], { color: string; bgColor: string; icon: any; label: string }> = {
    pending: { color: 'text-ios-blue', bgColor: 'bg-ios-blue/10', icon: Icons.Clock, label: '等待上传' },
    uploading: { color: 'text-ios-blue', bgColor: 'bg-ios-blue/10', icon: Icons.ArrowRight, label: '上传中' },
    success: { color: 'text-ios-green', bgColor: 'bg-ios-green/10', icon: Icons.Check, label: '已上传' },
    failed: { color: 'text-ios-red', bgColor: 'bg-ios-red/10', icon: Icons.X, label: '上传失败' },
    completed: { color: 'text-ios-green', bgColor: 'bg-ios-green/10', icon: Icons.Check, label: '已完成' },
  };

  const config = statusConfig[record.status];
  const StatusIcon = config.icon;
  const isUploading = record.status === 'uploading';

  return (
    <GlassCard padding="md" className="active:scale-[0.99] transition-transform" onClick={onClick}>
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
          ) : (
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-primary truncate">{record.supplierName}</h3>
            <span className="text-ios-blue font-bold">¥{record.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-secondary">
            <span>{record.itemCount} 项商品</span>
            <span className={`text-xs ${config.color}`}>{config.label}</span>
          </div>
          <div className="text-xs text-muted mt-1">{formatTime(record.timestamp)}</div>

          {/* 失败原因 */}
          {record.status === 'failed' && record.type === 'queue' && (record.original as QueueItem).error && (
            <div className="mt-2 p-2 rounded-lg bg-ios-red/10 border border-ios-red/20">
              <p className="text-xs text-ios-red line-clamp-1">{(record.original as QueueItem).error}</p>
            </div>
          )}
        </div>

        {/* 删除按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-ios-red/20 flex items-center justify-center text-white/40 hover:text-ios-red transition-colors flex-shrink-0"
        >
          <Icons.X className="w-4 h-4" />
        </button>
      </div>
    </GlassCard>
  );
};

// ============ 队列详情视图 ============

const QueueDetailView: React.FC<{
  item: QueueItem;
  onBack: () => void;
  onDelete: (id: string) => void;
}> = ({ item, onBack, onDelete }) => {
  const [editedItems, setEditedItems] = useState<ProcurementItem[]>(item.data.items);
  const [editedSupplier, setEditedSupplier] = useState(item.data.supplier);
  const [editedNotes, setEditedNotes] = useState(item.data.notes || '');
  const [isResubmitting, setIsResubmitting] = useState(false);

  const isEditable = item.status === 'failed';

  const handleResubmit = async () => {
    if (!isEditable) return;
    setIsResubmitting(true);
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

  const handleItemChange = (index: number, field: keyof ProcurementItem, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unitPrice || 0);
    }
    setEditedItems(newItems);
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
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-glass-bg backdrop-blur-glass border border-glass-border flex items-center justify-center text-secondary hover:bg-glass-bg-hover transition-colors">
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

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        {item.status === 'failed' && item.error && (
          <div className="mb-4 p-4 rounded-glass-lg border border-ios-red/30" style={{ background: 'rgba(232, 90, 79, 0.15)' }}>
            <div className="flex items-start gap-3">
              <Icons.X className="w-5 h-5 text-ios-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ios-red mb-1">上传失败原因</p>
                <p className="text-sm text-white/90">{item.error}</p>
              </div>
            </div>
          </div>
        )}

        <GlassCard padding="lg" className="mb-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wider mb-2 block">供应商</label>
              {isEditable ? (
                <input type="text" value={editedSupplier} onChange={(e) => setEditedSupplier(e.target.value)}
                  className="w-full px-4 py-3 rounded-glass-lg bg-white/5 border border-white/10 text-white focus:border-ios-blue/50 focus:outline-none" />
              ) : (
                <p className="text-lg font-semibold text-primary">{item.data.supplier}</p>
              )}
            </div>
            {(item.data.notes || isEditable) && (
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-2 block">备注</label>
                {isEditable ? (
                  <textarea value={editedNotes} onChange={(e) => setEditedNotes(e.target.value)} rows={2}
                    className="w-full px-4 py-3 rounded-glass-lg bg-white/5 border border-white/10 text-white focus:border-ios-blue/50 focus:outline-none resize-none" />
                ) : (
                  <p className="text-sm text-secondary">{item.data.notes || '无'}</p>
                )}
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard padding="lg">
          <h3 className="text-base font-bold text-primary mb-4">物品清单（{editedItems.length} 项）</h3>
          <div className="space-y-4">
            {editedItems.map((procItem, idx) => (
              <div key={idx} className="p-3 rounded-glass-lg bg-white/5 border border-white/10">
                {isEditable ? (
                  <div className="space-y-2">
                    <input type="text" value={procItem.name} onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" placeholder="商品名称" />
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" value={procItem.quantity || ''} onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" placeholder="数量" />
                      <input type="text" value={procItem.unit || ''} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" placeholder="单位" />
                      <input type="number" value={procItem.unitPrice || ''} onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" placeholder="单价" />
                    </div>
                    <div className="text-right text-sm text-ios-blue">小计：¥{(procItem.total || 0).toFixed(2)}</div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-primary">{procItem.name}</p>
                      <p className="text-sm text-muted mt-1">{procItem.quantity}{procItem.unit} × ¥{procItem.unitPrice}</p>
                    </div>
                    <p className="font-mono font-bold text-ios-blue">¥{(procItem.total || 0).toFixed(2)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
            <span className="text-secondary">总计金额</span>
            <span className="text-2xl font-bold text-ios-blue">
              ¥{editedItems.reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}
            </span>
          </div>
        </GlassCard>
      </div>

      {/* 底部操作 */}
      <div className="fixed bottom-6 left-4 right-4 z-50 safe-area-bottom">
        {isEditable ? (
          <div className="flex gap-3">
            <button onClick={() => onDelete(item.id)}
              className="flex-1 py-4 rounded-2xl text-white font-semibold border border-white/10 flex items-center justify-center gap-2"
              style={{ background: 'rgba(30, 30, 35, 0.65)', backdropFilter: 'blur(40px)' }}>
              <Icons.X className="w-5 h-5" /><span>删除</span>
            </button>
            <button onClick={handleResubmit} disabled={isResubmitting}
              className="flex-1 py-4 rounded-2xl text-white font-semibold border border-ios-blue/30 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, rgba(91,163,192,0.3) 0%, rgba(91,163,192,0.15) 100%)', backdropFilter: 'blur(40px)' }}>
              {isResubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icons.Check className="w-5 h-5" />}
              <span>重新上传</span>
            </button>
          </div>
        ) : (
          <button onClick={() => onDelete(item.id)}
            className="w-full py-4 rounded-2xl text-white font-semibold border border-white/10 flex items-center justify-center gap-2"
            style={{ background: 'rgba(30, 30, 35, 0.65)', backdropFilter: 'blur(40px)' }}>
            <Icons.X className="w-5 h-5" /><span>删除记录</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ============ 历史详情视图 ============

const HistoryDetailView: React.FC<{
  item: ProcurementHistoryItem;
  onBack: () => void;
  onDelete: (id: number) => void;
}> = ({ item, onBack, onDelete }) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric'
    });
  };

  // 解析图片URL（可能是JSON数组或纯字符串）
  const parseImageUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const parsed = JSON.parse(url);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
      return url;
    } catch {
      return url;
    }
  };

  const receiptImageUrl = parseImageUrl(item.receipt_image);
  const goodsImageUrl = parseImageUrl(item.goods_image);

  return (
    <div className="h-full flex flex-col animate-slide-in relative overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-glass-bg backdrop-blur-glass border border-glass-border flex items-center justify-center text-secondary hover:bg-glass-bg-hover transition-colors">
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-primary tracking-tight">采购详情</h2>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium text-ios-green bg-ios-green/10">
          已完成
        </span>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <GlassCard padding="lg" className="mb-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wider mb-1 block">供应商</label>
              <p className="text-xl font-bold text-primary">{item.supplier_name || '未知供应商'}</p>
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wider mb-1 block">商品名称</label>
              <p className="text-lg text-primary">{item.item_name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">数量</label>
                <p className="text-lg text-primary">{item.quantity} {item.unit}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">单价</label>
                <p className="text-lg text-primary">¥{item.unit_price.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wider mb-1 block">总金额</label>
              <p className="text-2xl font-bold text-ios-blue">¥{item.total_amount.toFixed(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">采购日期</label>
                <p className="text-sm text-secondary">{item.price_date}</p>
              </div>
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">录入时间</label>
                <p className="text-sm text-secondary">{formatDate(item.created_at)}</p>
              </div>
            </div>

            {item.notes && (
              <div>
                <label className="text-xs text-muted uppercase tracking-wider mb-1 block">备注</label>
                <p className="text-sm text-secondary">{item.notes}</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* 图片预览 */}
        {(receiptImageUrl || goodsImageUrl) && (
          <GlassCard padding="lg">
            <h3 className="text-base font-bold text-primary mb-4">凭证图片</h3>
            <div className="grid grid-cols-2 gap-3">
              {receiptImageUrl && (
                <div>
                  <p className="text-xs text-muted mb-2">收货单</p>
                  <img src={receiptImageUrl} alt="收货单" className="w-full rounded-lg object-cover" />
                </div>
              )}
              {goodsImageUrl && (
                <div>
                  <p className="text-xs text-muted mb-2">货物照片</p>
                  <img src={goodsImageUrl} alt="货物照片" className="w-full rounded-lg object-cover" />
                </div>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      {/* 底部删除按钮 */}
      <div className="fixed bottom-6 left-4 right-4 z-50 safe-area-bottom">
        <button
          onClick={() => onDelete(item.id)}
          className="w-full py-4 rounded-2xl text-ios-red font-semibold border border-ios-red/30 flex items-center justify-center gap-2"
          style={{ background: 'rgba(232, 90, 79, 0.15)', backdropFilter: 'blur(40px)' }}
        >
          <Icons.X className="w-5 h-5" />
          <span>删除记录</span>
        </button>
      </div>
    </div>
  );
};
