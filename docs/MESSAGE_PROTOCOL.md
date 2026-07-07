# 消息协议

扩展内部通过 `chrome.runtime.sendMessage` 与 `window.postMessage` 通信。

## 页面上下文 -> Content Script

| 字段 | 值 |
|------|-----|
| 通道 | `window.postMessage` |
| type | `TV_QUANTS_DATA` |
| payload | TradingView WebSocket 解析后的 JSON（`m` 为 `timescale_update` 或 `du`） |

## Content Script -> Service Worker

发送方通过 `sender.tab.id` 标识标签页，消息体不含 `tabId`。

### `BARS_UPDATE`

K 线数据更新。

```typescript
{
  type: 'BARS_UPDATE',
  symbol: string,
  bars: Bar[],
  lastUpdatedAt: number
}
```

触发时机：解析到新的 timeseries 数据后。

### `SYMBOL_CHANGED`

当前图表标的变更。

```typescript
{
  type: 'SYMBOL_CHANGED',
  symbol: string
}
```

触发时机：`SymbolObserver` 检测到 symbol 变化。

### `CONNECTION_STATUS`

连接状态变更。

```typescript
{
  type: 'CONNECTION_STATUS',
  status: 'connecting' | 'connected' | 'stale' | 'no_data' | 'symbol_unknown'
}
```

触发时机：标的变更、30 秒无新数据、无法识别标的。

## Side Panel -> Service Worker

Side Panel 消息必须包含 `tabId`（来自 `chrome.tabs.query`）。

### `GET_STATE`

请求当前标签页的完整状态。

```typescript
{ type: 'GET_STATE', tabId: number }
```

### `UPDATE_SETTINGS`

```typescript
{ type: 'UPDATE_SETTINGS', tabId: number, settings: AppSettings }
```

### `UPDATE_DATE_RANGE`

```typescript
{ type: 'UPDATE_DATE_RANGE', tabId: number, dateRange: { start: string, end: string } }
```

### `UPDATE_WATCHLIST`

```typescript
{ type: 'UPDATE_WATCHLIST', tabId: number, watchlist: WatchlistItem[] }
```

### `ADD_CURRENT_TO_WATCHLIST`

```typescript
{ type: 'ADD_CURRENT_TO_WATCHLIST', tabId: number, symbol: string }
```

### `REMOVE_FROM_WATCHLIST`

```typescript
{ type: 'REMOVE_FROM_WATCHLIST', tabId: number, symbol: string }
```

### `TOGGLE_MONITORING`

```typescript
{ type: 'TOGGLE_MONITORING', tabId: number, symbol: string }
```

### `DISMISS_ALERT`

```typescript
{ type: 'DISMISS_ALERT', tabId: number }
```

## Service Worker -> Side Panel

### `STATE_SYNC`

状态同步广播，Side Panel 监听此消息更新 UI。

```typescript
{
  type: 'STATE_SYNC',
  payload: {
    symbol: string | null,
    bars: Bar[],
    metrics: Metrics | null,
    fullMetrics: Metrics | null,
    settings: AppSettings,
    watchlist: WatchlistItem[],
    dateRange: { start: string, end: string },
    connectionStatus: ConnectionStatus,
    alert: AlertResult | null,
    alertDismissed: boolean
  }
}
```

触发时机：任何状态变更后，若该 tabId 的 Side Panel 曾发送过 `GET_STATE`。

## Storage Keys

| Key | 类型 | 说明 |
|-----|------|------|
| `settings` | `AppSettings` | 用户设置 |
| `watchlist` | `WatchlistItem[]` | 监控列表 |
| `metricsCache` | `Record<symbol, MetricsCacheEntry>` | 标的指标缓存 |
| `peakTTRBySymbol` | `Record<symbol, number>` | 历史 TTR 极值（提醒用） |
