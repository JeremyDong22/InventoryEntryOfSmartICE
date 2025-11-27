# UI 设计规范

## 设计风格：iOS 26 Liquid Glass

基于 Apple WWDC 2025 发布的 iOS 26 Liquid Glass 设计语言，融合 Glassmorphism 2025 趋势。

---

## 核心设计原则

### 1. 毛玻璃质感 (Frosted Glass)

```css
.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4.7px);
  -webkit-backdrop-filter: blur(4.7px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### 2. 图层结构

```
┌─ 背景模糊层 (backdrop-filter: blur)
├─ 液化效果层 (半透明填充)
├─ 高光层 (顶部微光边框)
└─ 内容层 (文字/图标)
```

---

## 色彩系统

### 背景色

| 用途 | CSS 值 | Tailwind |
|------|--------|----------|
| 主背景 | `#0a0a0a` | `bg-[#0a0a0a]` |
| 毛玻璃卡片 | `rgba(255,255,255,0.1)` | `bg-white/10` |
| 卡片悬停 | `rgba(255,255,255,0.15)` | `bg-white/15` |

### 强调色 - 沙漠黄昏色系

| 名称 | 色值 | 用途 |
|------|------|------|
| 蜜桃色 | `#ffb38a` | 主强调、光晕 |
| 暖橙色 | `#ff8c42` | 次强调、悬停 |
| 柔粉色 | `#ffc4d6` | 装饰光晕 |
| 金色 | `#ffd700` | 高亮数字 |

### 文字色

| 层级 | Tailwind 类 | 说明 |
|------|-------------|------|
| 主要 | `text-white` | 标题、重要信息 |
| 次要 | `text-zinc-400` | 正文内容 |
| 辅助 | `text-zinc-500` | 说明文字 |
| 禁用 | `text-zinc-600` | 占位符 |

### 渐变背景

```css
.mesh-gradient {
  background:
    radial-gradient(ellipse at 20% 80%, rgba(255,179,138,0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(255,140,66,0.2) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(255,196,214,0.15) 0%, transparent 60%),
    #0a0a0a;
}
```

---

## 圆角规范

| 元素类型 | 圆角值 | Tailwind | 说明 |
|---------|--------|----------|------|
| 大卡片 | 32px | `rounded-[32px]` | 胶囊形/液态感 |
| 标准卡片 | 24px | `rounded-3xl` | 内容区块 |
| 按钮 | 24px | `rounded-[24px]` | 圆润触感 |
| 输入框 | 16px | `rounded-2xl` | 清晰边界 |
| 小元素 | 12px | `rounded-xl` | 标签、徽章 |
| 圆形 | 50% | `rounded-full` | 头像、图标按钮 |

---

## 组件样式

### 毛玻璃卡片

```tsx
<div className="
  bg-white/10
  backdrop-blur-[4.7px]
  border border-white/15
  rounded-[32px]
  shadow-[0_8px_32px_rgba(0,0,0,0.3)]
  p-6
">
  {/* 内容 */}
</div>
```

### 主要按钮

```tsx
<button className="
  bg-white text-black
  px-6 py-3
  rounded-[24px]
  font-semibold
  hover:scale-[1.02]
  active:scale-95
  transition-all
">
  确认
</button>
```

### 次要按钮 (玻璃效果)

```tsx
<button className="
  bg-white/10
  backdrop-blur-sm
  border border-white/15
  text-white
  px-6 py-3
  rounded-[24px]
  hover:bg-white/15
  transition-all
">
  取消
</button>
```

### 输入框

```tsx
<input className="
  bg-black/50
  backdrop-blur-sm
  border border-white/10
  rounded-2xl
  px-4 py-3
  text-white
  placeholder-zinc-600
  focus:border-white/30
  focus:outline-none
  transition-colors
"/>
```

### 浮动操作栏

```tsx
<div className="
  absolute bottom-6 left-4 right-4 z-30
">
  <div className="
    bg-white/10
    backdrop-blur-md
    border border-white/15
    rounded-[32px]
    p-3
    shadow-[0_8px_32px_rgba(0,0,0,0.4)]
  ">
    {/* 操作按钮 */}
  </div>
</div>
```

---

## 动效规范

### 过渡时间

| 交互类型 | 时间 | 缓动函数 |
|---------|------|---------|
| 悬停 | 150ms | ease-out |
| 点击 | 100ms | ease-in-out |
| 页面切换 | 300ms | ease-out |
| 模态框 | 200ms | ease-out |

### 页面进入动画

```css
@keyframes slide-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-in { animation: slide-in 0.3s ease-out; }
```

### 缩放进入

```css
@keyframes scale-up {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale-up { animation: scale-up 0.3s ease-out; }
```

### 交互反馈

```tsx
{/* 悬停放大 + 点击缩小 */}
<button className="hover:scale-[1.02] active:scale-95 transition-all">
```

---

## 图标规范

使用 SF Symbols 风格的线性图标：

- **线条宽度**：`strokeWidth: 1.5` ~ `2`
- **端点**：`strokeLinecap: round`
- **拐角**：`strokeLinejoin: round`

定义在 `constants.ts` 中。

---

## 响应式布局

| 断点 | 宽度 | 布局调整 |
|------|------|----------|
| 默认 | < 768px | 单列，移动端优先，侧边栏隐藏 |
| md | >= 768px | 侧边栏展开，双栏布局 |

### 页面结构

```
┌─────────────────────────────────────┐
│  移动端: 汉堡菜单 │ 桌面端: 固定侧边栏 │
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │      Main Content        │
│  (md+)   │      (全屏滚动)          │
│          │                          │
└──────────┴──────────────────────────┘
```

### 安全区域

```tsx
{/* iOS 底部安全区域 */}
<div className="pb-safe pb-6">
```

---

## 设计参考资源

| 资源 | 位置 |
|------|------|
| 设计 Prompt | `ui设计风格/磨砂毛玻璃prompt.md` |
| 参考图片 | `ui设计风格/*.jpg` (15+ 张) |
| Figma 模板 | iOS 26 Liquid Glass Simulation (JoyTaung) |

---

## 设计检查清单

- [ ] 所有卡片使用毛玻璃效果 (`backdrop-blur`)
- [ ] 圆角统一遵循规范 (32px/24px/16px)
- [ ] 色彩使用沙漠黄昏色系强调
- [ ] 交互有明显视觉反馈 (scale/opacity)
- [ ] 文字对比度满足可读性
- [ ] 移动端触控区域 >= 44px
- [ ] 边框使用微光效果 (`border-white/15`)
