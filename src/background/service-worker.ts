import {
  MESSAGE_TYPES,
  type ExtensionMessage,
  type StateSyncPayload,
} from '../shared/messages';
import {
  calculateChangePct,
  computeMetrics,
  defaultDateRange,
  evaluateAlert,
  filterBarsByDateRange,
} from '../shared/metrics';
import {
  loadMetricsCache,
  loadPeakTTRBySymbol,
  loadSettings,
  loadWatchlist,
  saveMetricsCache,
  savePeakTTRBySymbol,
  saveSettings,
  saveWatchlist,
} from '../shared/storage';
import type {
  AppSettings,
  ConnectionStatus,
  DateRange,
  MetricsCacheEntry,
  SymbolBars,
  WatchlistItem,
} from '../shared/types';
import { DEFAULT_SETTINGS, STALE_THRESHOLD_MS } from '../shared/types';

type TabState = {
  symbolBars: SymbolBars | null;
  connectionStatus: ConnectionStatus;
  dateRange: DateRange | null;
  alertDismissed: boolean;
};

const tabStates = new Map<number, TabState>();
const panelTabs = new Set<number>();

let settings: AppSettings = { ...DEFAULT_SETTINGS };
let watchlist: WatchlistItem[] = [];
let metricsCache: Record<string, MetricsCacheEntry> = {};
let peakTTRBySymbol: Record<string, number> = {};

function getTabState(tabId: number): TabState {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      symbolBars: null,
      connectionStatus: 'connecting',
      dateRange: null,
      alertDismissed: false,
    });
  }
  return tabStates.get(tabId)!;
}

async function initStorage() {
  settings = await loadSettings();
  watchlist = await loadWatchlist();
  metricsCache = await loadMetricsCache();
  peakTTRBySymbol = await loadPeakTTRBySymbol();
}

function sortWatchlist(items: WatchlistItem[]): WatchlistItem[] {
  return [...items].sort((a, b) => {
    const scoreA = a.cachedMetrics?.compositeScore ?? metricsCache[a.symbol]?.metrics.compositeScore ?? 0;
    const scoreB = b.cachedMetrics?.compositeScore ?? metricsCache[b.symbol]?.metrics.compositeScore ?? 0;
    return scoreB - scoreA;
  });
}

function enrichWatchlist(): WatchlistItem[] {
  return sortWatchlist(
    watchlist.map((item) => {
      const cached = metricsCache[item.symbol];
      if (!cached) return item;
      return {
        ...item,
        cachedMetrics: cached.metrics,
        changePct: cached.changePct,
        updatedAt: cached.updatedAt,
      };
    })
  );
}

async function updateWatchlistCache(symbol: string, bars: import('../shared/types').Bar[]) {
  const inWatchlist = watchlist.some((w) => w.symbol === symbol);
  if (!inWatchlist || bars.length < 2) return;

  const windowBars = filterBarsByDateRange(
    bars,
    defaultDateRange(bars, settings.defaultWindowDays).start,
    defaultDateRange(bars, settings.defaultWindowDays).end
  );
  const metrics = computeMetrics(windowBars);
  if (!metrics) return;

  metricsCache[symbol] = {
    metrics,
    changePct: calculateChangePct(windowBars),
    updatedAt: Date.now(),
  };
  await saveMetricsCache(metricsCache);
  watchlist = enrichWatchlist();
  await saveWatchlist(watchlist);
}

function resolveConnectionStatus(tabState: TabState): ConnectionStatus {
  const bars = tabState.symbolBars;
  if (!bars?.symbol) return 'symbol_unknown';
  if (!bars.bars.length) return 'no_data';
  const elapsed = Date.now() - bars.lastUpdatedAt;
  if (elapsed > STALE_THRESHOLD_MS) return 'stale';
  return tabState.connectionStatus === 'symbol_unknown' ? 'symbol_unknown' : 'connected';
}

function buildState(tabId: number): StateSyncPayload {
  const tabState = getTabState(tabId);
  const bars = tabState.symbolBars?.bars ?? [];
  const symbol = tabState.symbolBars?.symbol || null;

  const dateRange =
    tabState.dateRange ??
    (bars.length > 0 ? defaultDateRange(bars, settings.defaultWindowDays) : { start: '', end: '' });

  const filteredBars = filterBarsByDateRange(bars, dateRange.start, dateRange.end);
  const metrics = computeMetrics(filteredBars);
  const fullMetrics = computeMetrics(bars);

  let alert = null;
  if (metrics && symbol && !tabState.alertDismissed) {
    const peakTTR = peakTTRBySymbol[symbol] ?? 0;
    const watchItem = watchlist.find((w) => w.symbol === symbol);
    const isEligible =
      settings.alert.alertScope === 'current_symbol' ||
      (settings.alert.alertScope === 'monitored_only' && watchItem?.monitoring === true);

    alert = evaluateAlert(symbol, metrics, peakTTR, settings.alert, isEligible);

    if (alert && metrics.maxTTR > peakTTR) {
      peakTTRBySymbol[symbol] = metrics.maxTTR;
      void savePeakTTRBySymbol(peakTTRBySymbol);
    }
  }

  return {
    symbol,
    bars: filteredBars,
    metrics,
    fullMetrics,
    settings,
    watchlist: enrichWatchlist(),
    dateRange,
    connectionStatus: resolveConnectionStatus(tabState),
    alert,
    alertDismissed: tabState.alertDismissed,
  };
}

async function broadcastState(tabId: number) {
  const payload = buildState(tabId);
  if (panelTabs.has(tabId)) {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.STATE_SYNC, payload }).catch(() => {
      // panel may be closed
    });
  }
}

async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id ?? (message as { tabId?: number }).tabId;
  if (tabId === undefined) return;

  switch (message.type) {
    case MESSAGE_TYPES.BARS_UPDATE: {
      const tabState = getTabState(tabId);
      tabState.symbolBars = {
        symbol: message.symbol,
        bars: message.bars,
        lastUpdatedAt: message.lastUpdatedAt,
      };
      tabState.connectionStatus = message.bars.length > 0 ? 'connected' : 'no_data';
      if (!tabState.dateRange && message.bars.length > 0) {
        tabState.dateRange = defaultDateRange(message.bars, settings.defaultWindowDays);
      }
      await updateWatchlistCache(message.symbol, message.bars);
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.SYMBOL_CHANGED: {
      const tabState = getTabState(tabId);
      tabState.symbolBars = {
        symbol: message.symbol,
        bars: [],
        lastUpdatedAt: Date.now(),
      };
      tabState.dateRange = null;
      tabState.alertDismissed = false;
      tabState.connectionStatus = message.symbol ? 'connecting' : 'symbol_unknown';
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.CONNECTION_STATUS: {
      const tabState = getTabState(tabId);
      tabState.connectionStatus = message.status;
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.GET_STATE: {
      panelTabs.add(tabId);
      const tabState = getTabState(tabId);
      if (!tabState.dateRange && tabState.symbolBars?.bars.length) {
        tabState.dateRange = defaultDateRange(
          tabState.symbolBars.bars,
          settings.defaultWindowDays
        );
      }
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.UPDATE_SETTINGS: {
      settings = message.settings;
      await saveSettings(settings);
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.UPDATE_DATE_RANGE: {
      const tabState = getTabState(tabId);
      tabState.dateRange = message.dateRange;
      tabState.alertDismissed = false;
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.UPDATE_WATCHLIST: {
      watchlist = message.watchlist;
      await saveWatchlist(watchlist);
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.ADD_CURRENT_TO_WATCHLIST: {
      if (!watchlist.some((w) => w.symbol === message.symbol)) {
        watchlist.push({ symbol: message.symbol, monitoring: false });
        watchlist = enrichWatchlist();
        await saveWatchlist(watchlist);
        const tabState = getTabState(tabId);
        if (tabState.symbolBars?.symbol === message.symbol) {
          await updateWatchlistCache(message.symbol, tabState.symbolBars.bars);
        }
      }
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.REMOVE_FROM_WATCHLIST: {
      watchlist = watchlist.filter((w) => w.symbol !== message.symbol);
      await saveWatchlist(watchlist);
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.TOGGLE_MONITORING: {
      watchlist = watchlist.map((w) =>
        w.symbol === message.symbol ? { ...w, monitoring: !w.monitoring } : w
      );
      await saveWatchlist(watchlist);
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.DISMISS_ALERT: {
      const tabState = getTabState(tabId);
      tabState.alertDismissed = true;
      await broadcastState(tabId);
      break;
    }
    default:
      break;
  }
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);

chrome.tabs.onUpdated.addListener(async (tabId, _info, tab) => {
  const isTVChart = tab.url?.includes('tradingview.com/chart') ?? false;
  await chrome.sidePanel.setOptions({
    tabId,
    enabled: isTVChart,
  });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void handleMessage(message, sender).then(() => sendResponse({ ok: true }));
  return true;
});

void initStorage();
