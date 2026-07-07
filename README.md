# TradingView 量化指标分析 Chrome 扩展

在 TradingView 图表页面上，基于实时 K 线数据计算量化指标，并通过 Chrome Side Panel 展示分析结果。

## 功能

- 拦截 TradingView WebSocket 数据流，提取 OHLCV K 线
- 计算夏普比率、索提诺比率、指数回归（R方、k）、最大恢复时间（TTR）、最大回撤
- 综合置信度评分
- 可配置分析时间窗口（默认最近 180 日）
- Side Panel 内迷你价格图与指数拟合曲线
- 用户手动管理的标的监控榜单（打开图表时缓存指标）
- 可配置的指标恶化提醒（仅 Side Panel 内展示）
- 中英文界面切换

## 环境要求

- Node.js 18+
- Chrome 114+（支持 Side Panel API）

## 开发

```bash
npm install
npm run dev
```

在 Chrome 中打开 `chrome://extensions`，启用「开发者模式」，选择「加载已解压的扩展程序」，指向项目的 `dist/` 目录。

开发模式下修改源码后，Vite 会自动重新构建；在扩展管理页点击刷新按钮即可加载最新产物。

## 构建发布

```bash
npm run build
```

构建产物位于 `dist/`。可将 `dist/` 目录打包为 zip 用于发布。

## 使用

1. 打开 [TradingView 图表页](https://www.tradingview.com/chart/)
2. 点击扩展图标，打开 Side Panel
3. 等待数据连接后查看指标与图表
4. 可通过设置调整语言、默认窗口、提醒阈值等

## 架构

```
TradingView WebSocket
        |
        v
inject.ts (页面上下文) -- 拦截 WS 消息
        | postMessage
        v
content.ts (扩展隔离上下文) -- 解析 K 线、检测标的
        | chrome.runtime.sendMessage
        v
service-worker.ts -- 计算指标、管理 storage
        | STATE_SYNC
        v
sidepanel (React) -- 展示 UI
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `sidePanel` | 在浏览器侧边栏展示分析面板 |
| `storage` | 保存设置、监控列表、指标缓存 |
| `host_permissions: tradingview.com` | 在 TV 图表页注入 content script |

## 已知限制

- 仅能采集**当前打开图表**的 WebSocket 数据，无法并行扫描多个标的
- 监控榜单依赖用户曾打开对应图表页面，指标为缓存值而非实时推送
- 标的识别依赖 TradingView 页面 DOM 结构，TV 更新后可能需要维护 selector
- Side Panel 关闭时不发送系统通知

## Symbol 检测维护

标的检测逻辑位于 `src/content/symbol-observer.ts`，按以下优先级解析：

1. `[data-symbol-short]` / `[data-symbol-full]`
2. chart header 内 symbol 相关 class 节点
3. `document.title` 正则解析

若检测失败，面板显示「无法识别标的」。更新步骤：

1. 在 TV 图表页打开 DevTools，定位 symbol 元素
2. 将新 selector 添加到 `SYMBOL_SELECTORS` 数组
3. 重新构建并加载扩展

## 消息协议

详见 [docs/MESSAGE_PROTOCOL.md](docs/MESSAGE_PROTOCOL.md)。

## 项目结构

```
src/
  manifest.json          # MV3 清单
  background/            # Service Worker
  content/               # Content Script
  inject/                # 页面上下文 WS 拦截
  sidepanel/             # React Side Panel UI
  shared/                # 共享类型、计算、i18n、storage
_locales/                # 扩展名称/描述国际化
dist/                    # 构建输出
```
