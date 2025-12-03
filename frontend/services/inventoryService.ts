/**
 * 入库数据提交服务
 * v3.0 - 简化版：移除 SKU 逻辑，只匹配 material，单位自由文本，图片分类
 *
 * 变更历史：
 * - v3.0: 移除 SKU 匹配，简化提交流程，支持图片分类
 * - v2.1: 添加 total_amount 采购总价字段
 * - v2.0: 单位改为直接使用 unitId
 */

import { DailyLog, ProcurementItem } from '../types';
import {
  matchProduct,
  matchSupplier,
  createPurchasePrices,
  StorePurchasePrice,
  Product,
} from './supabaseService';
import { uploadImageToStorage } from './imageService';

// ============ 类型定义 ============

export interface SubmitResult {
  success: boolean;
  insertedCount: number;
  pendingMatches: PendingMatch[];
  errors: string[];
}

export interface PendingMatch {
  itemName: string;
  matchType: 'product' | 'supplier';
  rawValue: string;
}

// ============ 主提交函数 ============

/**
 * 提交采购数据到数据库
 * v3.0 - 简化版，移除 SKU 逻辑
 *
 * @param dailyLog - 前端录入的日志数据
 * @param storeId - 门店 UUID
 * @param employeeId - 员工 UUID
 * @returns 提交结果
 */
export async function submitProcurement(
  dailyLog: Omit<DailyLog, 'id'>,
  storeId: string,
  employeeId: string
): Promise<SubmitResult> {
  const result: SubmitResult = {
    success: false,
    insertedCount: 0,
    pendingMatches: [],
    errors: [],
  };

  // 验证必要参数
  if (!storeId) {
    result.errors.push('缺少门店信息，请重新登录');
    return result;
  }

  if (!employeeId) {
    result.errors.push('缺少员工信息，请重新登录');
    return result;
  }

  // 过滤有效物品
  const validItems = dailyLog.items.filter(item => item.name.trim() !== '');
  if (validItems.length === 0) {
    result.errors.push('没有有效的物品记录');
    return result;
  }

  console.log(`[提交] 开始处理 ${validItems.length} 条采购记录`);
  console.log(`[提交] 门店: ${storeId}, 员工: ${employeeId}`);

  // 上传图片
  let receiptImageUrl: string | undefined;
  let goodsImageUrl: string | undefined;

  if (dailyLog.receiptImage) {
    try {
      console.log('[提交] 上传收货单图片...');
      receiptImageUrl = await uploadImageToStorage(
        dailyLog.receiptImage.data,
        dailyLog.receiptImage.mimeType,
        storeId,
        'receipt'
      );
      console.log('[提交] 收货单图片上传成功');
    } catch (err) {
      console.error('[提交] 收货单图片上传失败:', err);
      result.errors.push(`收货单图片上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  if (dailyLog.goodsImage) {
    try {
      console.log('[提交] 上传货物图片...');
      goodsImageUrl = await uploadImageToStorage(
        dailyLog.goodsImage.data,
        dailyLog.goodsImage.mimeType,
        storeId,
        'goods'
      );
      console.log('[提交] 货物图片上传成功');
    } catch (err) {
      console.error('[提交] 货物图片上传失败:', err);
      result.errors.push(`货物图片上传失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  // 匹配供应商
  let supplierId: number | null = null;
  let supplierName: string | undefined;

  if (dailyLog.supplier && dailyLog.supplier !== '其他') {
    const supplier = await matchSupplier(dailyLog.supplier);
    if (supplier) {
      supplierId = supplier.id;
      console.log(`[提交] 供应商匹配: ${dailyLog.supplier} -> ID: ${supplier.id}`);
    } else {
      console.log(`[提交] 供应商未匹配: ${dailyLog.supplier}`);
      result.pendingMatches.push({
        itemName: dailyLog.supplier,
        matchType: 'supplier',
        rawValue: dailyLog.supplier,
      });
      // 保存原始名称
      supplierName = dailyLog.supplier;
    }
  } else if (dailyLog.supplierOther) {
    // "其他"供应商
    supplierName = dailyLog.supplierOther;
    console.log(`[提交] 其他供应商: ${supplierName}`);
  }

  // 构建记录
  const records: StorePurchasePrice[] = [];
  const priceDate = new Date(dailyLog.date).toISOString().split('T')[0];

  for (const item of validItems) {
    // 验证必填字段
    if (!item.unit || item.unit.trim() === '') {
      result.errors.push(`物品 "${item.name}" 缺少单位`);
      continue;
    }

    if (!item.unitPrice || item.unitPrice <= 0) {
      result.errors.push(`物品 "${item.name}" 价格无效`);
      continue;
    }

    // 尝试匹配产品（可选）
    let materialId: number | undefined;
    const products = await matchProduct(item.name);
    if (products.length > 0) {
      materialId = products[0].id;
      console.log(`[提交] 产品匹配: ${item.name} -> ${products[0].name} (ID: ${materialId})`);
    } else {
      console.log(`[提交] 产品未匹配: ${item.name}（将保存原始名称）`);
      result.pendingMatches.push({
        itemName: item.name,
        matchType: 'product',
        rawValue: item.name,
      });
    }

    // 构建记录
    const record: StorePurchasePrice = {
      store_id: storeId,
      created_by: employeeId,
      material_id: materialId,
      supplier_id: supplierId || undefined,
      item_name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit,
      unit_price: item.unitPrice,
      total_amount: item.total || (item.quantity * item.unitPrice),
      receipt_image: receiptImageUrl,
      goods_image: goodsImageUrl,
      price_date: priceDate,
      supplier_name: supplierName,
      notes: item.specification || undefined,
      status: 'pending',
    };

    records.push(record);
  }

  // 批量插入
  if (records.length > 0) {
    try {
      console.log(`[提交] 准备插入 ${records.length} 条记录`);
      const inserted = await createPurchasePrices(records);
      result.insertedCount = inserted.length;

      if (inserted.length > 0) {
        result.success = true;
        console.log(`[提交] 成功插入 ${inserted.length} 条记录`);
      } else {
        result.errors.push('数据插入失败：未返回任何记录');
      }
    } catch (err) {
      console.error('[提交] 批量插入失败:', err);
      result.errors.push(`数据库写入失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  } else {
    result.errors.push('没有可提交的有效记录');
  }

  console.log(`[提交] 完成: 成功=${result.success}, 插入=${result.insertedCount}, 待匹配=${result.pendingMatches.length}, 错误=${result.errors.length}`);

  return result;
}

// ============ 辅助函数 ============

/**
 * 格式化提交结果为用户友好的消息
 */
export function formatSubmitResult(result: SubmitResult): string {
  if (!result.success && result.errors.length > 0) {
    return `提交失败: ${result.errors.join(', ')}`;
  }

  let message = `成功录入 ${result.insertedCount} 条采购记录`;

  if (result.pendingMatches.length > 0) {
    const productPending = result.pendingMatches.filter(p => p.matchType === 'product').length;
    const supplierPending = result.pendingMatches.filter(p => p.matchType === 'supplier').length;

    const pendingParts: string[] = [];
    if (productPending > 0) pendingParts.push(`${productPending} 个产品`);
    if (supplierPending > 0) pendingParts.push(`${supplierPending} 个供应商`);

    message += `（${pendingParts.join('、')} 待确认）`;
  }

  return message;
}
