# 数据录入架构详解

## 设计目标

1. **双模录入**：支持手动录入 + AI 智能识别
2. **统一体验**：无论数据来源，编辑/确认流程一致
3. **可扩展**：预留电子表单导入接口

---

## 当前架构

### 录入方式对比

| 方式 | 实现 | 适用场景 | 状态 |
|------|------|----------|------|
| 手动录入 | 表单逐条输入 | 少量数据、精确录入 | 已完成 |
| AI 智能识别 | Gemini Vision | 纸质单据、批量识别 | 已完成 |
| 电子表单导入 | Excel/CSV 解析 | 供应商电子单据 | 待开发 |

---

## AI 智能识别（核心）

### 技术选型

使用 **Google Gemini** 多模态大模型替代传统 OCR：

| 维度 | 传统 OCR | Gemini Vision |
|------|----------|---------------|
| 理解能力 | 仅识别文字 | 理解图片语义 |
| 输出格式 | 需后处理 | 直接输出结构化 JSON |
| 格式适应 | 需模板训练 | 自适应各种单据格式 |
| 容错性 | 字符级错误 | 智能推理纠错 |

### 实现代码

```typescript
// services/geminiService.ts

const procurementSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    supplier: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          specification: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          unitPrice: { type: Type.NUMBER },
          total: { type: Type.NUMBER }
        }
      }
    },
    notes: { type: Type.STRING }
  }
};

// 调用 Gemini API
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: { parts: [
    { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
    { text: 'Analyze this receipt...' }
  ]},
  config: {
    responseMimeType: 'application/json',
    responseSchema: procurementSchema,
    temperature: 0.1
  }
});
```

### 识别流程

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  拍照/上传   │ ──▶ │  Base64 编码  │ ──▶ │  Gemini API  │
└─────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  用户确认    │ ◀── │  填充工作表   │ ◀── │  JSON 解析   │
└─────────────┘     └──────────────┘     └──────────────┘
```

### Prompt 设计

```
Analyze this receipt or inventory list (which may be in Chinese).
Extract the supplier and all items.

For each item, identify:
- Name: 品名
- Specification: 包装规格 (e.g. 500g, 10kg/bag)
- Quantity: 数量
- Unit: 单位
- Unit Price: 单价
- Total: 小计

If Unit Price is missing but Total is present, calculate it.
```

---

## 数据流

### 类型定义

```typescript
// types.ts

interface ProcurementItem {
  name: string;           // 品名
  specification: string;  // 包装规格
  quantity: number;       // 数量
  unit: string;           // 单位
  unitPrice: number;      // 单价
  total: number;          // 小计 (quantity × unitPrice)
}

interface DailyLog {
  id: string;
  date: string;
  category: CategoryType;
  supplier: string;
  items: ProcurementItem[];
  totalCost: number;
  notes: string;
  status: 'Stocked' | 'Pending' | 'Issue';
}

type CategoryType = 'Meat' | 'Vegetables' | 'Dry Goods' | 'Alcohol' | 'Consumables';
```

### 状态管理

```
App.tsx
  │
  ├── logs: DailyLog[]           # 所有入库记录
  │
  └── EntryForm.tsx
        │
        ├── step: EntryStep       # 当前步骤
        ├── selectedCategory      # 选中分类
        ├── supplier              # 供应商
        ├── items                 # 物品列表
        ├── notes                 # 备注
        └── isAnalyzing           # AI 识别中
```

---

## UI 组件结构

### 录入流程（4 步骤）

```
WelcomeScreen ──▶ CategoryScreen ──▶ WorksheetScreen ──▶ SummaryScreen
   (欢迎页)         (选择分类)         (编辑工作表)        (确认提交)
```

### 核心组件

| 组件 | 职责 |
|------|------|
| `WelcomeScreen` | 欢迎语 + 开始按钮 |
| `CategoryScreen` | 5 大品类选择 |
| `WorksheetScreen` | 供应商/物品编辑 + AI 识别入口 |
| `SummaryScreen` | 收据样式预览 + 确认入库 |

---

## Mock 数据策略

无 API Key 时自动降级为 Mock 模式：

```typescript
// geminiService.ts

if (!apiKey) {
  console.log("No API Key found. Returning mock data.");
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_PARSE_RESULT), 2000);
  });
}
```

---

## 扩展规划

### P1：电子表单导入

```typescript
// 预留接口
interface DataSource {
  type: 'manual' | 'vision' | 'excel';
  getData(): Promise<ProcurementItem[]>;
}

class ExcelDataSource implements DataSource {
  type = 'excel' as const;

  async getData(): Promise<ProcurementItem[]> {
    // 1. 解析 Excel 文件
    // 2. 列映射
    // 3. 返回标准化数据
  }
}
```

### P2：多模型切换

```typescript
// 预留多模型适配
interface VisionProvider {
  name: 'gemini' | 'claude' | 'qwen';
  analyze(image: File): Promise<ParseResult>;
}

const provider = createProvider(process.env.VISION_PROVIDER || 'gemini');
```
