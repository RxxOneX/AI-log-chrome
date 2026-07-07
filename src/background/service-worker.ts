import {
  MESSAGE_TYPES,
  type ExtensionMessage,
  type PipelineDiagnosticState,
  type StateSyncPayload,
  type TvSessionPayload,
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
import { mergeBars, shouldAcceptBarReplace } from '../shared/bar-merge';
import { sanitizeBars } from '../shared/bar-sanitize';
import { DEFAULT_SETTINGS, STALE_THRESHOLD_MS } from '../shared/types';
import { readTvSessionForUrl } from './tv-session';

type TabState = {
  symbolBars: SymbolBars | null;
  connectionStatus: ConnectionStatus;
  dateRange: DateRange | null;
  alertDismissed: boolean;
};

const tabStates = new Map<number, TabState>();
const panelTabs = new Set<number>();
const injectedTabs = new Set<number>();

const SIDE_PANEL_PATH = 'src/sidepanel/index.html';
const INJECT_FILE = 'inject/main-world.js';
const MAIN_WORLD_SCRIPT_ID = 'tv-quant-main-world';

async function configureSidePanelForTab(tabId: number, url?: string) {
  const isTVChart = url?.includes('tradingview.com/chart') ?? false;

  await chrome.sidePanel.setOptions({
    tabId,
    path: SIDE_PANEL_PATH,
    enabled: true,
  });

  return isTVChart;
}

async function initializeTradingViewTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['*://*.tradingview.com/chart/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        await configureSidePanelForTab(tab.id, tab.url);
      }
    }
  } catch (error) {
    console.error('Failed to initialize TradingView tabs:', error);
  }
}

let mainWorldScriptTask: Promise<void> | null = null;

function isDuplicateScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Duplicate script ID');
}

async function registerMainWorldScript(): Promise<void> {
  if (mainWorldScriptTask) {
    return mainWorldScriptTask;
  }

  mainWorldScriptTask = (async () => {
    const script = {
      id: MAIN_WORLD_SCRIPT_ID,
      js: [INJECT_FILE],
      matches: ['*://*.tradingview.com/chart/*'],
      runAt: 'document_start' as const,
      world: 'MAIN' as const,
      allFrames: true,
      persistAcrossSessions: true,
    };

    try {
      const existing = await chrome.scripting.getRegisteredContentScripts({
        ids: [MAIN_WORLD_SCRIPT_ID],
      });

      if (existing.length > 0) {
        await chrome.scripting.updateContentScripts([script]);
        return;
      }

      try {
        await chrome.scripting.registerContentScripts([script]);
      } catch (error) {
        if (isDuplicateScriptError(error)) {
          await chrome.scripting.updateContentScripts([script]);
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to register main world script:', error);
    }
  })().finally(() => {
    mainWorldScriptTask = null;
  });

  return mainWorldScriptTask;
}

async function injectMainWorld(tabId: number): Promise<void> {
  if (injectedTabs.has(tabId)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: [INJECT_FILE],
      world: 'MAIN',
    });
    injectedTabs.add(tabId);
  } catch (error) {
    console.error('Main world inject failed:', error);
  }
}

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
  if (!bars?.symbol) {
    return tabState.connectionStatus === 'connecting' ? 'connecting' : 'symbol_unknown';
  }
  if (!bars.bars.length) {
    return tabState.connectionStatus === 'connecting' ? 'connecting' : 'no_data';
  }
  const elapsed = Date.now() - bars.lastUpdatedAt;
  if (elapsed > STALE_THRESHOLD_MS) return 'stale';
  return 'connected';
}

function buildState(tabId: number): StateSyncPayload {
  const tabState = getTabState(tabId);
  const rawBars = tabState.symbolBars?.bars ?? [];
  const bars = sanitizeBars(rawBars);
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
    chrome.runtime
      .sendMessage({ type: MESSAGE_TYPES.STATE_SYNC, tabId, payload })
      .catch(() => {
        // panel may be closed
      });
  }
}

function resetTabStateForNavigation(tabId: number) {
  const tabState = getTabState(tabId);
  tabState.symbolBars = null;
  tabState.connectionStatus = 'connecting';
  tabState.dateRange = null;
  tabState.alertDismissed = false;
}

function isTradingViewChartUrl(url?: string): boolean {
  return url?.includes('tradingview.com/chart') ?? false;
}

async function ensureInjected(tabId: number): Promise<void> {
  injectedTabs.delete(tabId);
  await injectMainWorld(tabId);
}

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  if (message.type === MESSAGE_TYPES.REQUEST_INJECT) {
    const injectTabId = sender.tab?.id;
    if (injectTabId !== undefined) {
      await injectMainWorld(injectTabId);
    }
    return { ok: true };
  }

  if (message.type === MESSAGE_TYPES.GET_TV_SESSION) {
    const pageUrl = message.pageUrl ?? sender.tab?.url;
    const session = await readTvSessionForUrl(pageUrl);
    const payload: TvSessionPayload = {
      loggedIn: Boolean(session?.sessionid),
      sessionid: session?.sessionid ?? '',
      sessionid_sign: session?.sessionid_sign,
    };
    return payload;
  }

  if (message.type === MESSAGE_TYPES.GET_PIPELINE_DIAGNOSTIC) {
    const diagTabId = sender.tab?.id;
    if (diagTabId === undefined) return null;

    const tabState = getTabState(diagTabId);
    const state = buildState(diagTabId);
    const payload: PipelineDiagnosticState = {
      ...state,
      symbolBarsLastUpdatedAt: tabState.symbolBars?.lastUpdatedAt,
      tabConnectionStatus: tabState.connectionStatus,
    };
    return payload;
  }

  const tabId = sender.tab?.id ?? (message as { tabId?: number }).tabId;
  if (tabId === undefined) return { ok: true };

  switch (message.type) {
    case MESSAGE_TYPES.BARS_UPDATE: {
      const tabState = getTabState(tabId);
      const existing = tabState.symbolBars;
      const symbolChanged = existing?.symbol !== message.symbol;
      const incomingBars = sanitizeBars(message.bars);
      const mergedBars = symbolChanged
        ? incomingBars
        : mergeBars(existing?.bars ?? [], incomingBars);

      if (
        !shouldAcceptBarReplace(existing?.bars ?? [], mergedBars, Boolean(symbolChanged))
      ) {
        break;
      }

      tabState.symbolBars = {
        symbol: message.symbol,
        bars: mergedBars,
        lastUpdatedAt: message.lastUpdatedAt,
      };
      tabState.connectionStatus = mergedBars.length > 0 ? 'connected' : 'no_data';
      if (!tabState.dateRange && mergedBars.length > 0) {
        tabState.dateRange = defaultDateRange(mergedBars, settings.defaultWindowDays);
      }
      await updateWatchlistCache(message.symbol, mergedBars);
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.SYMBOL_CHANGED: {
      const tabState = getTabState(tabId);
      const sameSymbol = tabState.symbolBars?.symbol === message.symbol;

      tabState.symbolBars = {
        symbol: message.symbol,
        bars: sameSymbol ? tabState.symbolBars?.bars ?? [] : [],
        lastUpdatedAt: Date.now(),
      };
      if (!sameSymbol) {
        tabState.dateRange = null;
        tabState.alertDismissed = false;
      }
      tabState.connectionStatus = message.symbol
        ? sameSymbol && tabState.symbolBars.bars.length > 0
          ? 'connected'
          : 'connecting'
        : 'symbol_unknown';
      await broadcastState(tabId);
      break;
    }
    case MESSAGE_TYPES.CONNECTION_STATUS: {
      const tabState = getTabState(tabId);
      if (
        message.status === 'symbol_unknown' &&
        tabState.symbolBars?.symbol &&
        tabState.connectionStatus !== 'connecting'
      ) {
        break;
      }
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

  return { ok: true };
}

async function initSidePanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error('Failed to configure side panel behavior:', error);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await configureSidePanelForTab(tabId, tab.url);

  if (!isTradingViewChartUrl(tab.url)) return;

  if (changeInfo.status === 'loading') {
    resetTabStateForNavigation(tabId);
    await ensureInjected(tabId);
    if (panelTabs.has(tabId)) {
      await broadcastState(tabId);
    }
    return;
  }

  if (changeInfo.status === 'complete') {
    await ensureInjected(tabId);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  if (!isTradingViewChartUrl(details.url)) return;
  void ensureInjected(details.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
  tabStates.delete(tabId);
  panelTabs.delete(tabId);
});

async function bootstrap() {
  await initStorage();
  await Promise.all([
    initSidePanelBehavior(),
    registerMainWorldScript(),
    initializeTradingViewTabs(),
  ]);
}

chrome.runtime.onInstalled.addListener(() => {
  void bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  void bootstrap();
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void handleMessage(message, sender).then((result) => sendResponse(result ?? { ok: true }));
  return true;
});

void bootstrap();
