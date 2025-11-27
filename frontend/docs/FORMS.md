# 表单字段与验证规则

## 采购数据录入表单

### 数据结构

```typescript
// types.ts

interface ProcurementItem {
  name: string;           // 品名（必填）
  specification: string;  // 包装规格（选填）
  quantity: number;       // 数量（必填，> 0）
  unit: string;           // 单位（必填）
  unitPrice: number;      // 单价（必填，> 0）
  total: number;          // 小计（自动计算）
}

interface DailyLog {
  id: string;
  date: string;           // ISO 日期字符串
  category: CategoryType; // 分类
  supplier: string;       // 供应商（必填）
  items: ProcurementItem[];
  totalCost: number;      // 总计（自动计算）
  notes: string;          // 备注（选填）
  status: 'Stocked' | 'Pending' | 'Issue';
}
```

---

## 字段说明

### 分类 (category)

| ID | 显示名 | 图标 |
|----|--------|------|
| Meat | 肉类 | Icons.Meat |
| Vegetables | 蔬果 | Icons.Vegetable |
| Dry Goods | 干杂 | Icons.Cube |
| Alcohol | 酒水 | Icons.Beaker |
| Consumables | 低耗 | Icons.Sparkles |

### 供应商 (supplier)

- 类型：文本输入
- 必填：是
- 占位符：`请输入...`
- 默认值：AI 识别结果或空

### 物品清单 (items)

每条物品包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 品名 |
| specification | string | 否 | 包装规格，如 "500g/袋" |
| quantity | number | 是 | 数量，支持小数 |
| unit | string | 是 | 单位：斤、kg、箱、袋、瓶、桶等 |
| unitPrice | number | 是 | 单价（元） |
| total | number | 自动 | 小计 = quantity × unitPrice |

### 备注 (notes)

- 类型：多行文本
- 必填：否
- 占位符：`可选...`

---

## 自动计算

```typescript
// EntryForm.tsx

const handleItemChange = (index: number, field: keyof ProcurementItem, value: any) => {
  const newItems = [...items];
  const updatedItem = { ...newItems[index], [field]: value };

  // 自动计算小计
  if (field === 'quantity' || field === 'unitPrice') {
    const q = parseFloat(updatedItem.quantity as any) || 0;
    const p = parseFloat(updatedItem.unitPrice as any) || 0;
    updatedItem.total = q * p;
  }

  newItems[index] = updatedItem;
  setItems(newItems);
};

// 总计
const calculateGrandTotal = () => items.reduce((acc, curr) => acc + curr.total, 0);
```

---

## 验证规则

### 提交前验证

```typescript
const handleWorksheetSubmit = () => {
  // 至少有一条有效物品
  if (items.filter(i => i.name.trim() !== '').length === 0) {
    alert("请至少录入一项物品");
    return;
  }
  setStep('SUMMARY');
};
```

### 最终提交

```typescript
const handleSummaryConfirm = () => {
  // 过滤空白项
  const validItems = items.filter(i => i.name.trim() !== '');

  onSave({
    date: new Date().toISOString(),
    category: selectedCategory,
    supplier: supplier || '未知供应商',
    items: validItems,
    totalCost: calculateGrandTotal(),
    notes: notes,
    status: 'Stocked'
  });
};
```

---

## AI 识别输出映射

Gemini 返回结构：

```json
{
  "supplier": "双汇冷鲜肉直供",
  "items": [
    {
      "name": "精品五花肉",
      "specification": "带皮",
      "quantity": 20,
      "unit": "kg",
      "unitPrice": 28.5,
      "total": 570
    }
  ],
  "notes": "今日五花肉品质不错"
}
```

映射到表单：

```typescript
if (result) {
  const currentItems = items.filter(i => i.name.trim() !== '');
  setItems([...currentItems, ...result.items]);  // 追加到现有列表
  if (!supplier && result.supplier) setSupplier(result.supplier);
  if (!notes && result.notes) setNotes(result.notes);
}
```

---

## 常用单位

| 类别 | 常用单位 |
|------|----------|
| 肉类 | 斤、kg |
| 蔬果 | 斤、筐、把 |
| 干杂 | 袋、桶、箱 |
| 酒水 | 箱、瓶 |
| 低耗 | 包、桶、箱 |
