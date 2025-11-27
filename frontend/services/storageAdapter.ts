/**
 * 存储适配器接口
 * 预留后端对接：支持 Supabase / 阿里云 OSS / 自建后端
 */

import { AttachedImage, DailyLog } from '../types';

/**
 * 抽象存储接口
 * 后续对接后端只需实现此接口
 */
export interface IStorageAdapter {
  // 图片操作
  saveImage(image: AttachedImage): Promise<string>;  // 返回图片 ID/URL
  getImage(id: string): Promise<AttachedImage | null>;
  deleteImage(id: string): Promise<void>;

  // 日志操作
  saveLog(log: DailyLog): Promise<void>;
  getLogs(): Promise<DailyLog[]>;
  getLog(id: string): Promise<DailyLog | null>;
  deleteLog(id: string): Promise<void>;
}

/**
 * 内存存储适配器
 * 当前实现：会话级别存储，刷新页面后数据丢失
 * 用于开发和演示，后续替换为后端存储
 */
export class MemoryStorageAdapter implements IStorageAdapter {
  private images: Map<string, AttachedImage> = new Map();
  private logs: Map<string, DailyLog> = new Map();

  async saveImage(image: AttachedImage): Promise<string> {
    this.images.set(image.id, image);
    console.log(`[MemoryStorage] 保存图片: ${image.id}, 大小: ${image.compressedSize} bytes`);
    return image.id;
  }

  async getImage(id: string): Promise<AttachedImage | null> {
    return this.images.get(id) || null;
  }

  async deleteImage(id: string): Promise<void> {
    this.images.delete(id);
    console.log(`[MemoryStorage] 删除图片: ${id}`);
  }

  async saveLog(log: DailyLog): Promise<void> {
    this.logs.set(log.id, log);
    console.log(`[MemoryStorage] 保存日志: ${log.id}, 供应商: ${log.supplier}`);
  }

  async getLogs(): Promise<DailyLog[]> {
    return Array.from(this.logs.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async getLog(id: string): Promise<DailyLog | null> {
    return this.logs.get(id) || null;
  }

  async deleteLog(id: string): Promise<void> {
    const log = this.logs.get(id);
    if (log?.attachments) {
      // 同时删除关联的图片
      for (const img of log.attachments) {
        await this.deleteImage(img.id);
      }
    }
    this.logs.delete(id);
    console.log(`[MemoryStorage] 删除日志: ${id}`);
  }

  // 开发辅助：获取存储统计
  getStats() {
    return {
      imageCount: this.images.size,
      logCount: this.logs.size,
      totalImageSize: Array.from(this.images.values()).reduce(
        (sum, img) => sum + (img.compressedSize || 0), 0
      )
    };
  }
}

// ============ 预留：Supabase 存储适配器 ============

/*
import { createClient } from '@supabase/supabase-js';
import { base64ToBlob } from './imageService';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export class SupabaseStorageAdapter implements IStorageAdapter {
  private bucket = 'receipts';
  private table = 'procurement_logs';

  async saveImage(image: AttachedImage): Promise<string> {
    const blob = base64ToBlob(image.data, image.mimeType);
    const filePath = `${new Date().toISOString().slice(0,10)}/${image.id}.jpg`;

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, blob, {
        contentType: image.mimeType,
        upsert: true
      });

    if (error) throw error;

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async getImage(id: string): Promise<AttachedImage | null> {
    // 从数据库查询图片元信息
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as AttachedImage;
  }

  async deleteImage(id: string): Promise<void> {
    // 从存储桶删除文件
    await supabase.storage.from(this.bucket).remove([`${id}.jpg`]);
    // 从数据库删除记录
    await supabase.from('images').delete().eq('id', id);
  }

  async saveLog(log: DailyLog): Promise<void> {
    const { error } = await supabase
      .from(this.table)
      .upsert(log);

    if (error) throw error;
  }

  async getLogs(): Promise<DailyLog[]> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    return data as DailyLog[];
  }

  async getLog(id: string): Promise<DailyLog | null> {
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as DailyLog;
  }

  async deleteLog(id: string): Promise<void> {
    await supabase.from(this.table).delete().eq('id', id);
  }
}
*/

// ============ 导出默认适配器 ============

// 当前使用内存存储，后续切换只需修改此处
export const storage = new MemoryStorageAdapter();

// 导出适配器类型，方便依赖注入
export type { IStorageAdapter };
