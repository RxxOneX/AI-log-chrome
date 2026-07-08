import {
  MESSAGE_TYPES,
  INJECT_MESSAGE_TYPE,
  INJECT_SYMBOL_MESSAGE_TYPE,
  INJECT_BARS_SNAPSHOT_TYPE,
  INJECT_SESSION_MESSAGE_TYPE,
  type TvSessionPayload,
} from '../shared/messages';
import type { Bar } from '../shared/types';
import { shouldSendIncrementalUpdate } from '../shared/bar-merge';
import { areBarsCoherent } from '../shared/bar-coherence';
import { extractSeriesFromTvPayload } from '../shared/bar-parser';
import type { SymbolSource } from '../shared/tv-chart-probe';
import { normalizeTvSymbol, symbolsEquivalent } from '../shared/tv-chart-probe';
import { extractSymbolFromUrl, isValidTvSymbolFormat } from '../shared/tv-protocol';
import {
  isExtensionContextValid,
  installContextGuard,
  onContextShutdown,
  sendToBackground,
  requestFromBackground,
  trackTimer,
} from './extension-bridge';
import { BarStore } from './bar-store';
import { getDomSymbol, SymbolObserver } from './symbol-observer';
import { SymbolTracker } from './symbol-tracker';
import { initPipelineDiagnostic } from './pipeline-diagnostic';
import { installPageConsoleBridge } from './install-page-bridge';

const barStore = new BarStore();
const symbolTracker = new SymbolTracker(extractSymbolFromUrl(window.location.href));

let lastSentAt = 0;
let activeSymbol: string | null = null;
let symbolUnknownReported = false;

function requestMainWorldInject() {
  sendToBackground({ type: MESSAGE_TYPES.REQUEST_INJECT });
}

function sendBarsUpdate() {
  if (!isExtensionContextValid()) return;

  const symbol = symbolTracker.get();
  const bars = barStore.getBars();
  if (bars.length < 2) return;
  if (symbol && activeSymbol && !symbolsEquivalent(symbol, activeSymbol)) return;
  if (!areBarsCoherent(bars)) return;

  const now = Date.now();
  lastSentAt = now;

  sendToBackground({
    type: MESSAGE_TYPES.BARS_UPDATE,
    symbol: symbol ?? '',
    bars,
    lastUpdatedAt: now,
  });
}

function sendSymbolChanged(symbol: string | null) {
  if (!isExtensionContextValid()) return;

  sendToBackground({
    type: MESSAGE_TYPES.SYMBOL_CHANGED,
    symbol: symbol ?? '',
  });

  if (symbol) {
    symbolUnknownReported = false;
    sendToBackground({
      type: MESSAGE_TYPES.CONNECTION_STATUS,
      status: 'connecting',
    });
    return;
  }

  if (!symbolUnknownReported) {
    symbolUnknownReported = true;
    sendToBackground({
      type: MESSAGE_TYPES.CONNECTION_STATUS,
      status: 'symbol_unknown',
    });
  }
}

function commitActiveSymbol(next: string) {
  if (symbolsEquivalent(next, activeSymbol)) {
    activeSymbol = next;
    return false;
  }

  activeSymbol = next;
  barStore.setSymbol(next);
  sendSymbolChanged(next);
  return true;
}

function updateSymbol(source: SymbolSource, symbol: string | null) {
  if (!isExtensionContextValid()) return false;

  const prevEffective = symbolTracker.get();

  if (symbol && prevEffective && !symbolsEquivalent(symbol, prevEffective)) {
    if (source === 'chart') {
      symbolTracker.invalidateStaleSources(symbol, source);
    }
  }

  symbolTracker.commit(source, symbol);
  const nextEffective = symbolTracker.get();

  if (!nextEffective || symbolsEquivalent(nextEffective, prevEffective)) return false;
  return commitActiveSymbol(nextEffective);
}

function resyncToBackground() {
  if (!isExtensionContextValid()) return;

  const symbol = symbolTracker.get();
  if (!symbol) {
    sendToBackground({
      type: MESSAGE_TYPES.CONNECTION_STATUS,
      status: 'connecting',
    });
    return;
  }

  if (symbol !== activeSymbol && !symbolsEquivalent(symbol, activeSymbol)) {
    commitActiveSymbol(symbol);
  }

  if (barStore.getBars().length > 0) {
    sendBarsUpdate();
  }
}

function handleInjectSymbol(symbol: string, source: SymbolSource = 'ws') {
  if (!symbol || source === 'ws') return;
  updateSymbol(source, symbol);
}

function handleDomSymbol(symbol: string | null) {
  if (!symbol) return;
  if (symbolTracker.getSource() === 'chart') return;
  updateSymbol('dom', symbol);
}

function handleBarsSnapshot(symbol: string, bars: Bar[]) {
  if (!isExtensionContextValid() || bars.length < 2) return;
  if (!areBarsCoherent(bars)) return;
  if (barStore.isStaleSeries(bars)) return;

  const normalized = normalizeTvSymbol(symbol);
  if (!normalized || !isValidTvSymbolFormat(normalized)) return;

  symbolTracker.commit('chart', normalized);
  const effective = symbolTracker.get() ?? normalized;
  if (!effective || !symbolsEquivalent(effective, normalized)) return;

  const symbolChanged =
    activeSymbol !== null && !symbolsEquivalent(activeSymbol, effective);

  if (symbolChanged || !activeSymbol) {
    commitActiveSymbol(effective);
  } else if (!symbolsEquivalent(barStore.getSymbol(), effective)) {
    barStore.setSymbol(effective);
  }

  const replaced = barStore.replaceBars(bars, symbolChanged);
  if (!replaced) return;

  sendBarsUpdate();
}

function handleTvData(payload: { p?: unknown[] }) {
  if (!isExtensionContextValid() || barStore.hasSnapshot()) return;

  try {
    const beforeCount = barStore.count();
    const series = extractSeriesFromTvPayload(payload.p);
    if (!series.length) return;

    const ingested = barStore.ingestSeries(series);
    if (!ingested) return;

    const afterCount = barStore.count();
    if (afterCount <= beforeCount) return;

    if (!shouldSendIncrementalUpdate(afterCount)) return;

    sendBarsUpdate();
  } catch (error) {
    console.error('Error parsing TV data for quants:', error);
  }
}

function syncUrlSymbol() {
  if (symbolTracker.getSource() === 'chart') return;
  updateSymbol('url', extractSymbolFromUrl(window.location.href));
}

function publishTvSession(payload: TvSessionPayload | null) {
  if (!payload?.loggedIn || !payload.sessionid) return;
  window.postMessage(
    {
      type: INJECT_SESSION_MESSAGE_TYPE,
      session: {
        sessionid: payload.sessionid,
        sessionid_sign: payload.sessionid_sign,
      },
    },
    '*'
  );
}

async function syncTvSession() {
  if (!isExtensionContextValid()) return;

  const payload = await requestFromBackground<TvSessionPayload>({
    type: MESSAGE_TYPES.GET_TV_SESSION,
    pageUrl: window.location.href,
  });

  publishTvSession(payload);
}

function bootstrap() {
  if (!isExtensionContextValid()) return;

  requestMainWorldInject();
  void syncTvSession();
  sendToBackground({
    type: MESSAGE_TYPES.CONNECTION_STATUS,
    status: 'connecting',
  });

  syncUrlSymbol();

  const dom = getDomSymbol();
  if (dom) {
    handleDomSymbol(dom);
  }
}

function resetLocalState() {
  activeSymbol = null;
  symbolUnknownReported = false;
  lastSentAt = 0;
  symbolTracker.commit('chart', null);
  symbolTracker.commit('ws', null);
  symbolTracker.commit('dom', null);
  symbolTracker.commit('url', extractSymbolFromUrl(window.location.href));
  barStore.setSymbol(null);
  barStore.clear();
  symbolObserver.setDisabled(false);
}

const symbolObserver = new SymbolObserver((symbol) => {
  handleDomSymbol(symbol);
});

installContextGuard();

onContextShutdown(() => {
  symbolObserver.stop();
});

if (isExtensionContextValid()) {
  installPageConsoleBridge();
  bootstrap();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => symbolObserver.start());
  } else {
    symbolObserver.start();
  }
}

window.addEventListener('message', (event) => {
  if (!isExtensionContextValid()) return;
  if (event.source !== window || !event.data) return;

  if (event.data.type === INJECT_SYMBOL_MESSAGE_TYPE) {
    handleInjectSymbol(event.data.symbol, event.data.source ?? 'ws');
    return;
  }

  if (event.data.type === INJECT_BARS_SNAPSHOT_TYPE) {
    handleBarsSnapshot(event.data.symbol, event.data.bars as Bar[]);
    return;
  }

  if (event.data.type !== INJECT_MESSAGE_TYPE) return;
  handleTvData(event.data.payload);
});

window.addEventListener('pageshow', (event) => {
  if (!isExtensionContextValid()) return;

  if (event.persisted) {
    syncUrlSymbol();
    resyncToBackground();
    return;
  }
  resetLocalState();
  installPageConsoleBridge();
  bootstrap();
  symbolObserver.forceCheck();
});

document.addEventListener('visibilitychange', () => {
  if (!isExtensionContextValid()) return;
  if (document.visibilityState !== 'visible') return;

  requestMainWorldInject();
  installPageConsoleBridge();
  syncUrlSymbol();
  symbolObserver.forceCheck();
  resyncToBackground();
});

trackTimer(
  setInterval(() => {
    if (!isExtensionContextValid()) return;

    void syncTvSession();
    syncUrlSymbol();
    requestMainWorldInject();

    const dom = getDomSymbol();
    if (dom) {
      handleDomSymbol(dom);
    }
  }, 2000)
);

trackTimer(
  setInterval(() => {
    if (!isExtensionContextValid()) return;
    if (barStore.getBars().length < 2) return;
    sendBarsUpdate();
  }, 15_000)
);

trackTimer(
  setTimeout(() => {
    if (!isExtensionContextValid()) return;
    if (!symbolTracker.get()) {
      sendSymbolChanged(null);
    }
  }, 30_000)
);

trackTimer(
  setInterval(() => {
    if (!isExtensionContextValid() || lastSentAt === 0) return;

    const elapsed = Date.now() - lastSentAt;
    if (elapsed > 30_000) {
      sendToBackground({
        type: MESSAGE_TYPES.CONNECTION_STATUS,
        status: 'stale',
      });
    }
  }, 10_000)
);

initPipelineDiagnostic({
  getBarStore: () => barStore,
  getSymbolTracker: () => symbolTracker,
  getActiveSymbol: () => activeSymbol,
  getLastSentAt: () => lastSentAt,
  requestInject: requestMainWorldInject,
  syncTvSession,
  resyncToBackground,
});

console.log(
  '[TV Quant] page console ready: __TV_QUANT_STATUS__(), __TV_QUANT_RUN_DIAG__(), __TV_QUANT_WATCH__(30)'
);
