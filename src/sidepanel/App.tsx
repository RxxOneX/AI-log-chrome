import { useCallback, useEffect, useState } from 'react';
import { Activity, SlidersHorizontal } from 'lucide-react';
import { MESSAGE_TYPES, type StateSyncPayload } from '../shared/messages';
import type { AppSettings, DateRange } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { t } from '../shared/i18n';
import { ConnectionBanner } from './components/ConnectionBanner';
import { DateRangeControl } from './components/DateRangeControl';
import { ChartPanel } from './components/ChartPanel';
import { MetricsSection } from './components/MetricsSection';
import { WatchlistSection } from './components/WatchlistSection';
import { AlertCard } from './components/AlertCard';
import { SettingsDrawer } from './components/SettingsDrawer';

const emptyState: StateSyncPayload = {
  symbol: null,
  bars: [],
  metrics: null,
  fullMetrics: null,
  settings: DEFAULT_SETTINGS,
  watchlist: [],
  dateRange: { start: '', end: '' },
  connectionStatus: 'connecting',
  alert: null,
  alertDismissed: false,
};

async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id ?? null;
}

function sendMessage(message: Record<string, unknown>) {
  void chrome.runtime.sendMessage(message);
}

export default function App() {
  const [state, setState] = useState<StateSyncPayload>(emptyState);
  const [tabId, setTabId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const language = state.settings.language;

  const refreshState = useCallback(async () => {
    const id = await getActiveTabId();
    if (!id) return;
    setTabId(id);
    sendMessage({ type: MESSAGE_TYPES.GET_STATE, tabId: id });
  }, []);

  useEffect(() => {
    void refreshState();

    const onTabActivated = () => {
      void refreshState();
    };

    const onTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (changeInfo.url || changeInfo.status === 'complete') {
        void refreshState();
      }
    };

    chrome.tabs.onActivated.addListener(onTabActivated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    const listener = (message: {
      type?: string;
      tabId?: number;
      payload?: StateSyncPayload;
    }) => {
      if (message.type !== MESSAGE_TYPES.STATE_SYNC || !message.payload) return;

      void getActiveTabId().then((activeId) => {
        if (!activeId || message.tabId !== activeId) return;
        setTabId(activeId);
        setState(message.payload as StateSyncPayload);
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.tabs.onActivated.removeListener(onTabActivated);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [refreshState]);

  const updateSettings = (settings: AppSettings) => {
    if (!tabId) return;
    sendMessage({ type: MESSAGE_TYPES.UPDATE_SETTINGS, tabId, settings });
  };

  const updateDateRange = (dateRange: DateRange) => {
    if (!tabId) return;
    sendMessage({ type: MESSAGE_TYPES.UPDATE_DATE_RANGE, tabId, dateRange });
  };

  const toggleExpFit = () => {
    updateSettings({ ...state.settings, showExpFit: !state.settings.showExpFit });
  };

  const addCurrentToWatchlist = () => {
    if (!tabId || !state.symbol) return;
    sendMessage({ type: MESSAGE_TYPES.ADD_CURRENT_TO_WATCHLIST, tabId, symbol: state.symbol });
  };

  const removeFromWatchlist = (symbol: string) => {
    if (!tabId) return;
    sendMessage({ type: MESSAGE_TYPES.REMOVE_FROM_WATCHLIST, tabId, symbol });
  };

  const toggleMonitoring = (symbol: string) => {
    if (!tabId) return;
    sendMessage({ type: MESSAGE_TYPES.TOGGLE_MONITORING, tabId, symbol });
  };

  const dismissAlert = () => {
    if (!tabId) return;
    sendMessage({ type: MESSAGE_TYPES.DISMISS_ALERT, tabId });
  };

  return (
    <div className="w-full h-screen bg-[#1a1e26] text-[#d1d4dc] font-sans flex flex-col">
      <div className="h-[60px] border-b border-[#2a2e39] bg-[#131722] px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">{t('panelTitle', language)}</h2>
            <span className="text-xs text-gray-400">{t('panelSubtitle', language)}</span>
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        <ConnectionBanner status={state.connectionStatus} language={language} />

        {state.alert && !state.alertDismissed && (
          <AlertCard
            alert={state.alert}
            language={language}
            threshold={state.settings.alert.compositeThreshold}
            onDismiss={dismissAlert}
          />
        )}

        <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-3 flex flex-col gap-3">
          <label className="flex items-center justify-between cursor-pointer rounded-lg hover:bg-[#1e222d] transition-colors p-1">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded bg-amber-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-amber-500" />
              </div>
              <span className="text-sm font-medium text-gray-200">{t('showExpFit', language)}</span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={state.settings.showExpFit}
                onChange={toggleExpFit}
              />
              <div
                className={`w-9 h-5 rounded-full transition-colors ${state.settings.showExpFit ? 'bg-amber-500' : 'bg-gray-700'}`}
              >
                <div
                  className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full transition-transform ${state.settings.showExpFit ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </div>
            </div>
          </label>

          <div className="h-[1px] bg-[#2a2e39] w-full" />

          <DateRangeControl
            dateRange={state.dateRange}
            language={language}
            onChange={updateDateRange}
          />
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{t('chartTitle', language)}</div>
          <ChartPanel bars={state.bars} showExpFit={state.settings.showExpFit} />
          {state.symbol && (
            <div className="text-xs text-gray-400 mt-2 font-mono">{state.symbol}</div>
          )}
        </div>

        <MetricsSection metrics={state.metrics} language={language} />

        <WatchlistSection
          watchlist={state.watchlist}
          currentSymbol={state.symbol}
          language={language}
          onToggleMonitoring={toggleMonitoring}
          onRemove={removeFromWatchlist}
          onAddCurrent={addCurrentToWatchlist}
        />

        <div className="mt-auto pt-4 text-center">
          <p className="text-[10px] text-gray-600 font-mono">{t('footer', language)}</p>
        </div>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        settings={state.settings}
        language={language}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
      />
    </div>
  );
}
