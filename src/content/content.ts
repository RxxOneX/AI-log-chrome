import injectUrl from '../inject/inject?script&module';
import { MESSAGE_TYPES, INJECT_MESSAGE_TYPE } from '../shared/messages';
import { BarStore } from './bar-store';
import { SymbolObserver } from './symbol-observer';

const barStore = new BarStore();
let lastSentAt = 0;

function injectScript() {
  const script = document.createElement('script');
  script.src = injectUrl;
  script.type = 'module';
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function sendBarsUpdate() {
  const symbol = barStore.getSymbol();
  const bars = barStore.getBars();
  const now = Date.now();
  lastSentAt = now;

  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.BARS_UPDATE,
    symbol: symbol ?? '',
    bars,
    lastUpdatedAt: now,
  });
}

function sendSymbolChanged(symbol: string | null) {
  barStore.setSymbol(symbol);
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.SYMBOL_CHANGED,
    symbol: symbol ?? '',
  });
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.CONNECTION_STATUS,
    status: symbol ? 'connecting' : 'symbol_unknown',
  });
}

function handleTvData(payload: { p?: unknown[] }) {
  try {
    const p = payload.p;
    if (!Array.isArray(p) || !p[1] || typeof p[1] !== 'object') return;
    const seriesContainer = p[1] as { s?: Array<{ v?: number[] }> };
    if (!seriesContainer.s) return;

    barStore.ingestSeries(seriesContainer.s);
    if (barStore.getBars().length > 0) {
      sendBarsUpdate();
    }
  } catch (error) {
    console.error('Error parsing TV data for quants:', error);
  }
}

injectScript();

const symbolObserver = new SymbolObserver((symbol) => {
  sendSymbolChanged(symbol);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => symbolObserver.start());
} else {
  symbolObserver.start();
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== INJECT_MESSAGE_TYPE) {
    return;
  }
  handleTvData(event.data.payload);
});

setInterval(() => {
  if (lastSentAt === 0) return;
  const elapsed = Date.now() - lastSentAt;
  if (elapsed > 30_000) {
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.CONNECTION_STATUS,
      status: 'stale',
    });
  }
}, 10_000);
