# API 接口文档

## 当前状态

前端目前使用 **本地状态 + Mock 数据**，暂未对接后端 API。

---

## 数据存储

### 当前方案

```typescript
// App.tsx
const [logs, setLogs] = useState<DailyLog[]>(INITIAL_DATA);

const handleSaveEntry = (logData: Omit<DailyLog, 'id'>) => {
  const newLog: DailyLog = {
    ...logData,
    id: Math.random().toString(36).substr(2, 9),
  };
  setLogs(prev => [...prev, newLog]);
};
```

**限制**：页面刷新后数据丢失

---

## 外部 API

### Google Gemini API

**用途**：图片识别，提取采购单据信息

**端点**：`@google/genai` SDK

**配置**：
```typescript
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey });
```

**请求**：
```typescript
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

---

## 后端 API 规划（待实现）

### 数据库

```
PostgreSQL @ localhost:5432/yebailing_db
```

### 采购记录 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/purchases` | 获取采购记录列表 |
| POST | `/api/purchases` | 创建采购记录 |
| GET | `/api/purchases/:id` | 获取单条记录 |
| PUT | `/api/purchases/:id` | 更新记录 |
| DELETE | `/api/purchases/:id` | 删除记录 |

### 请求/响应格式

```typescript
// POST /api/purchases
// Request
{
  "date": "2025-11-26",
  "category": "Meat",
  "supplier": "双汇冷鲜肉直供",
  "items": [...],
  "notes": "..."
}

// Response
{
  "success": true,
  "data": {
    "id": "abc123",
    "date": "2025-11-26",
    ...
  }
}
```

---

## 对接计划

1. 搭建 Node.js/Python 后端
2. 设计数据库表结构
3. 实现 REST API
4. 前端切换数据源

```typescript
// 环境变量控制
const saveEntry = process.env.NEXT_PUBLIC_USE_API
  ? apiService.createPurchase
  : localService.addLog;
```
