/**
 * 草稿服务 - 自动保存录入表单草稿到 localStorage
 * v1.0 - 初始版本：支持自动保存、恢复、清除草稿
 *
 * 功能：
 * - 自动保存表单数据（防抖 1 秒）
 * - 页面加载时恢复草稿
 * - 提交成功后清除草稿
 * - 24 小时过期自动忽略
 *
 * 存储策略：
 * - 只存储文本数据，不存储图片（避免 localStorage 超限）
 * - 单份草稿，新的覆盖旧的
 */

import { ProcurementItem, CategoryType } from '../types';

// ============ 类型定义 ============

export type EntryStep = 'WELCOME' | 'CATEGORY' | 'WORKSHEET' | 'SUMMARY';

export interface EntryDraft {
  step: EntryStep;
  selectedCategory: CategoryType;
  supplier: string;
  supplierOther: string;
  notes: string;
  items: ProcurementItem[];
  savedAt: number;  // 时间戳
}

export interface DraftInfo {
  category: string;
  itemCount: number;
  savedAt: number;
  timeAgo: string;  // 格式化的时间：刚刚 / 5分钟前 / 今天 10:32
}

// ============ 常量配置 ============

const STORAGE_KEY = 'entry_draft';
const EXPIRE_HOURS = 24;  // 草稿过期时间（小时）
const DEBOUNCE_MS = 1000; // 防抖延迟（毫秒）

// ============ 工具函数 ============

/**
 * 格式化时间为相对时间
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    // 今天，显示具体时间
    const date = new Date(timestamp);
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `今天 ${hour}:${minute}`;
  } else {
    // 超过一天，显示日期
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hour}:${minute}`;
  }
}

/**
 * 检查草稿是否过期
 */
function isExpired(savedAt: number): boolean {
  const now = Date.now();
  const expireMs = EXPIRE_HOURS * 60 * 60 * 1000;
  return now - savedAt > expireMs;
}

// ============ 草稿管理类 ============

class DraftManager {
  private debounceTimer: NodeJS.Timeout | null = null;

  /**
   * 保存草稿（带防抖）
   */
  saveDraft(draft: Omit<EntryDraft, 'savedAt'>): void {
    // 清除之前的定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 防抖保存
    this.debounceTimer = setTimeout(() => {
      this.saveImmediately(draft);
    }, DEBOUNCE_MS);
  }

  /**
   * 立即保存草稿（不防抖）
   */
  saveImmediately(draft: Omit<EntryDraft, 'savedAt'>): boolean {
    try {
      const fullDraft: EntryDraft = {
        ...draft,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullDraft));
      console.log('[草稿] 已保存');
      return true;
    } catch (error) {
      console.error('[草稿] 保存失败:', error);
      return false;
    }
  }

  /**
   * 加载草稿
   * 返回 null 表示没有草稿或草稿已过期
   */
  loadDraft(): EntryDraft | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const draft = JSON.parse(stored) as EntryDraft;

      // 检查是否过期
      if (isExpired(draft.savedAt)) {
        console.log('[草稿] 已过期，自动清除');
        this.clearDraft();
        return null;
      }

      console.log('[草稿] 已加载');
      return draft;
    } catch (error) {
      console.error('[草稿] 加载失败:', error);
      return null;
    }
  }

  /**
   * 获取草稿摘要信息（用于显示恢复弹窗）
   */
  getDraftInfo(): DraftInfo | null {
    const draft = this.loadDraft();
    if (!draft) {
      return null;
    }

    // 检查草稿是否有实质内容（不只是空表单）
    const hasContent = draft.selectedCategory ||
                       draft.supplier ||
                       draft.supplierOther ||
                       draft.notes ||
                       draft.items.length > 0;

    if (!hasContent) {
      // 空草稿，不需要恢复
      return null;
    }

    return {
      category: draft.selectedCategory || '',
      itemCount: draft.items.length,
      savedAt: draft.savedAt,
      timeAgo: formatTimeAgo(draft.savedAt),
    };
  }

  /**
   * 清除草稿
   */
  clearDraft(): void {
    try {
      // 取消待执行的防抖保存
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      localStorage.removeItem(STORAGE_KEY);
      console.log('[草稿] 已清除');
    } catch (error) {
      console.error('[草稿] 清除失败:', error);
    }
  }

  /**
   * 检查是否有草稿
   */
  hasDraft(): boolean {
    return this.getDraftInfo() !== null;
  }
}

// ============ 导出单例 ============

export const draftService = new DraftManager();

// ============ 便捷函数 ============

export function saveDraft(draft: Omit<EntryDraft, 'savedAt'>): void {
  draftService.saveDraft(draft);
}

export function loadDraft(): EntryDraft | null {
  return draftService.loadDraft();
}

export function getDraftInfo(): DraftInfo | null {
  return draftService.getDraftInfo();
}

export function clearDraft(): void {
  draftService.clearDraft();
}

export function hasDraft(): boolean {
  return draftService.hasDraft();
}
