import {
  countMessageTypes,
  extractBarPayloadsFromFrames,
} from '../shared/bar-messages';
import { MIN_USABLE_BARS } from '../shared/bar-merge';
import {
  mergeSessions,
  readPageChartSession,
  sessionFromDocumentCookie,
  type TvSession,
} from '../shared/tv-auth';
import { fetchHistoryBars } from '../shared/tv-history-fetch';
import {
  isChartUnavailablePage,
  probeChartSnapshot,
  probeLiveSymbol,
  safeActiveChart,
  whenChartReady,
} from '../shared/tv-chart-probe';
import {
  extractSymbolFromFrames,
  extractSymbolFromTitle,
  extractSymbolFromUrl,
} from '../shared/tv-protocol';
import type { ChartProbeWindow } from '../shared/tv-chart-probe';
import {
  DIAG_PING_TYPE,
  DIAG_PONG_TYPE,
  maskSessionId,
} from '../shared/pipeline-diagnostic';

const INJECT_SESSION_MESSAGE_TYPE = 'TV_QUANTS_SESSION';

(function () {
  const globalWindow = window as Window & {
    __TV_QUANT_INJECTED__?: boolean;
    __TV_QUANT_STATS__?: Record<string, unknown>;
  };

  if (globalWindow.__TV_QUANT_INJECTED__) return;
  globalWindow.__TV_QUANT_INJECTED__ = true;

  const view = globalWindow as ChartProbeWindow;

  const stats = {
    wsSendFrames: 0,
    wsRecvFrames: 0,
    barPayloads: 0,
    symbolPosts: 0,
    chartProbes: 0,
    chartSnapshots: 0,
    messageTypes: {} as Record<string, number>,
    lastActivityAt: 0,
  };
  globalWindow.__TV_QUANT_STATS__ = stats;

  const OrigWebSocket = window.WebSocket;
  const DATA_MESSAGE_TYPE = 'TV_QUANTS_DATA';
  const SYMBOL_MESSAGE_TYPE = 'TV_QUANTS_SYMBOL';
  const BARS_SNAPSHOT_TYPE = 'TV_QUANTS_BARS_SNAPSHOT';
  const PING_MESSAGE_TYPE = 'TV_QUANTS_PING';
  const PONG_MESSAGE_TYPE = 'TV_QUANTS_PONG';

  let lastPostedSymbol: string | null = null;
  let lastSnapshotSignature = '';
  let lastSnapshotBarCount = 0;
  let symbolChangeTimer: ReturnType<typeof setTimeout> | null = null;
  let chartReadyHooked = false;
  let historyFetchInFlight = false;
  let injectedSession: TvSession | null = null;

  function resetSymbolState() {
    lastPostedSymbol = null;
    lastSnapshotSignature = '';
    lastSnapshotBarCount = 0;
  }

  function touchActivity() {
    stats.lastActivityAt = Date.now();
  }

  function mergeMessageTypes(data: string) {
    const counts = countMessageTypes(data);
    for (const [key, value] of Object.entries(counts)) {
      stats.messageTypes[key] = (stats.messageTypes[key] ?? 0) + value;
    }
  }

  function postSymbol(symbol: string, source: 'chart' | 'ws' | 'dom' | 'url' = 'chart') {
    if (!symbol || symbol === lastPostedSymbol) return;
    lastPostedSymbol = symbol;
    stats.symbolPosts += 1;
    touchActivity();
    window.postMessage({ type: SYMBOL_MESSAGE_TYPE, symbol, source }, '*');
  }

  function postBarsSnapshot(symbol: string, bars: Array<Record<string, number>>) {
    if (bars.length < 2) return;

    const symbolChanged = lastPostedSymbol !== null && lastPostedSymbol !== symbol;
    if (
      !symbolChanged &&
      lastSnapshotBarCount >= 20 &&
      bars.length < lastSnapshotBarCount * 0.5
    ) {
      return;
    }

    const signature = `${symbol}:${bars.length}:${bars[bars.length - 1]?.time ?? 0}`;
    if (signature === lastSnapshotSignature && !symbolChanged) return;

    lastSnapshotSignature = signature;
    lastSnapshotBarCount = bars.length;
    stats.chartSnapshots += 1;
    touchActivity();
    window.postMessage({ type: BARS_SNAPSHOT_TYPE, symbol, bars }, '*');
  }

  function processFrames(data: string, direction: 'send' | 'recv') {
    if (direction === 'send') {
      stats.wsSendFrames += 1;
    } else {
      stats.wsRecvFrames += 1;
    }
    touchActivity();
    mergeMessageTypes(data);

    const symbol = extractSymbolFromFrames(data);
    if (symbol) {
      postSymbol(symbol, 'ws');
    }

    for (const payload of extractBarPayloadsFromFrames(data)) {
      stats.barPayloads += 1;
      window.postMessage({ type: DATA_MESSAGE_TYPE, payload }, '*');
    }
  }

  async function normalizeWsData(
    data: string | ArrayBufferLike | Blob | ArrayBufferView
  ): Promise<string | null> {
    if (typeof data === 'string') return data;
    if (data instanceof Blob) return data.text();
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data)) {
      const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      return new TextDecoder().decode(view);
    }
    return null;
  }

  function handleRawWsData(
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
    direction: 'send' | 'recv'
  ) {
    void normalizeWsData(data)
      .then((text) => {
        if (text) processFrames(text, direction);
      })
      .catch(() => {
        // ignore websocket decode errors
      });
  }

  function hookWebSocket(ws: WebSocket) {
    const tagged = ws as WebSocket & { __TV_QUANT_HOOKED__?: boolean };
    if (tagged.__TV_QUANT_HOOKED__) return;
    tagged.__TV_QUANT_HOOKED__ = true;

    const origSend = ws.send.bind(ws);
    ws.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      handleRawWsData(data, 'send');
      return origSend(data);
    };

    ws.addEventListener('message', (event) => {
      handleRawWsData(event.data as string | Blob, 'recv');
    });
  }

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[]
  ) {
    const ws = new OrigWebSocket(url, protocols);
    hookWebSocket(ws);
    return ws;
  } as unknown as typeof WebSocket;

  PatchedWebSocket.prototype = OrigWebSocket.prototype;
  Object.defineProperty(PatchedWebSocket, 'CONNECTING', { value: OrigWebSocket.CONNECTING });
  Object.defineProperty(PatchedWebSocket, 'OPEN', { value: OrigWebSocket.OPEN });
  Object.defineProperty(PatchedWebSocket, 'CLOSING', { value: OrigWebSocket.CLOSING });
  Object.defineProperty(PatchedWebSocket, 'CLOSED', { value: OrigWebSocket.CLOSED });
  window.WebSocket = PatchedWebSocket;

  const origProtoSend = OrigWebSocket.prototype.send;
  OrigWebSocket.prototype.send = function (
    data: string | ArrayBufferLike | Blob | ArrayBufferView
  ) {
    handleRawWsData(data, 'send');
    return origProtoSend.call(this, data);
  };

  const origProtoAddEventListener = OrigWebSocket.prototype.addEventListener;
  OrigWebSocket.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    if (type !== 'message' || listener == null) {
      return origProtoAddEventListener.call(
        this,
        type,
        listener as EventListener,
        options
      );
    }

    const wrapped: EventListener = (event) => {
      handleRawWsData((event as MessageEvent).data as string | Blob, 'recv');
      if (typeof listener === 'function') {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
    };

    return origProtoAddEventListener.call(this, type, wrapped, options);
  };

  const wsProto = OrigWebSocket.prototype;
  const onmessageDesc = Object.getOwnPropertyDescriptor(wsProto, 'onmessage');
  if (onmessageDesc?.configurable) {
    Object.defineProperty(wsProto, 'onmessage', {
      configurable: true,
      enumerable: true,
      get() {
        return onmessageDesc.get?.call(this);
      },
      set(handler: ((this: WebSocket, ev: MessageEvent) => unknown) | null) {
        if (!handler) {
          onmessageDesc.set?.call(this, handler);
          return;
        }

        const wrapped = function (this: WebSocket, event: MessageEvent) {
          handleRawWsData(event.data as string | Blob, 'recv');
          return handler.call(this, event);
        };

        onmessageDesc.set?.call(this, wrapped);
      },
    });
  }

  function resolveSession(): TvSession | null {
    return mergeSessions(
      injectedSession,
      readPageChartSession(view),
      sessionFromDocumentCookie()
    );
  }

  function pollSymbolHints() {
    if (isChartUnavailablePage(view)) {
      const fromUrl = extractSymbolFromUrl(window.location.href);
      if (fromUrl) postSymbol(fromUrl, 'url');
      return;
    }

    const live = probeLiveSymbol(window.location.href, view);
    if (live) {
      postSymbol(live, 'chart');
      return;
    }

    const fromTitle = extractSymbolFromTitle(document.title);
    if (fromTitle) {
      postSymbol(fromTitle, 'dom');
    }
  }

  async function fetchHistorySnapshot(symbol: string) {
    if (historyFetchInFlight) return null;
    historyFetchInFlight = true;

    try {
      return await fetchHistoryBars(symbol, resolveSession(), `${window.location.origin}/`);
    } finally {
      historyFetchInFlight = false;
    }
  }

  async function probeChartData() {
    stats.chartProbes += 1;

    const snapshot = isChartUnavailablePage(view)
      ? null
      : probeChartSnapshot(window.location.href, view);

    if (snapshot && snapshot.bars.length >= MIN_USABLE_BARS) {
      postSymbol(snapshot.symbol, 'chart');
      postBarsSnapshot(snapshot.symbol, snapshot.bars);
      return;
    }

    let symbol =
      snapshot?.symbol ??
      probeLiveSymbol(window.location.href, view) ??
      lastPostedSymbol;

    if (!symbol) {
      pollSymbolHints();
      return;
    }

    if (snapshot && snapshot.bars.length >= 2) {
      postSymbol(snapshot.symbol, 'chart');
      postBarsSnapshot(snapshot.symbol, snapshot.bars);
      symbol = snapshot.symbol;
    }

    const historyBars = await fetchHistorySnapshot(symbol);
    if (historyBars) {
      postSymbol(symbol, 'chart');
      postBarsSnapshot(symbol, historyBars);
      return;
    }

    if (!snapshot) {
      pollSymbolHints();
    }
  }

  function onLiveSymbolChanged() {
    if (symbolChangeTimer) clearTimeout(symbolChangeTimer);
    symbolChangeTimer = setTimeout(() => {
      symbolChangeTimer = null;
      resetSymbolState();
      pollSymbolHints();
      void probeChartData();
    }, 400);
  }

  function subscribeLiveSymbolEvents() {
    if (isChartUnavailablePage(view)) return false;

    try {
      const api = view.TradingViewApi;
      if (!api) return false;

      const symbolWv = api.linking?.symbol;
      if (symbolWv?.subscribe && !(symbolWv as { __tvQuantSubscribed?: boolean }).__tvQuantSubscribed) {
        (symbolWv as { __tvQuantSubscribed?: boolean }).__tvQuantSubscribed = true;
        symbolWv.subscribe(() => onLiveSymbolChanged());
      }

      const activeChart = safeActiveChart(view);
      if (activeChart?.onSymbolChanged && !(activeChart as { __tvQuantSubscribed?: boolean }).__tvQuantSubscribed) {
        (activeChart as { __tvQuantSubscribed?: boolean }).__tvQuantSubscribed = true;
        activeChart.onSymbolChanged(() => onLiveSymbolChanged());
      }

      if (api.onActiveChartChanged && !(api as { __tvQuantChartChanged?: boolean }).__tvQuantChartChanged) {
        (api as { __tvQuantChartChanged?: boolean }).__tvQuantChartChanged = true;
        api.onActiveChartChanged(() => onLiveSymbolChanged());
      }

      return true;
    } catch {
      return false;
    }
  }

  function ensureChartReadyHook() {
    if (chartReadyHooked) return;
    if (
      !whenChartReady(view, () => {
        pollSymbolHints();
        void probeChartData();
      })
    ) {
      return;
    }
    chartReadyHooked = true;
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === INJECT_SESSION_MESSAGE_TYPE) {
      injectedSession = event.data.session ?? null;
      void probeChartData();
      return;
    }

    if (event.data.type === DIAG_PING_TYPE) {
      void (async () => {
        try {
          const session = resolveSession();
          const snapshot = isChartUnavailablePage(view)
            ? null
            : probeChartSnapshot(window.location.href, view);
          const liveSymbol = probeLiveSymbol(window.location.href, view);
          const symbol = snapshot?.symbol ?? liveSymbol ?? lastPostedSymbol;

          let historyBars = 0;
          if (symbol) {
            const bars = await fetchHistorySnapshot(symbol);
            historyBars = bars?.length ?? 0;
          }

          window.postMessage(
            {
              type: DIAG_PONG_TYPE,
              payload: {
                injected: true,
                stats: { ...stats, messageTypes: { ...stats.messageTypes } },
                liveSymbol,
                chartBars: snapshot?.bars.length ?? 0,
                chartSymbol: snapshot?.symbol ?? null,
                historyBars,
                hasSession: Boolean(session?.sessionid),
                sessionMask: maskSessionId(session?.sessionid),
                chartApi: Boolean(view.TradingViewApi),
              },
            },
            '*'
          );
        } catch (error) {
          window.postMessage(
            {
              type: DIAG_PONG_TYPE,
              payload: {
                injected: true,
                error: error instanceof Error ? error.message : String(error),
                stats: { ...stats, messageTypes: { ...stats.messageTypes } },
              },
            },
            '*'
          );
        }
      })();
      return;
    }

    if (event.data.type !== PING_MESSAGE_TYPE) return;
    window.postMessage(
      {
        type: PONG_MESSAGE_TYPE,
        injected: true,
        stats: { ...stats, messageTypes: { ...stats.messageTypes } },
      },
      '*'
    );
  });

  setInterval(() => {
    subscribeLiveSymbolEvents();
    ensureChartReadyHook();
    pollSymbolHints();
  }, 2000);

  setInterval(() => {
    void probeChartData();
  }, 3000);

  subscribeLiveSymbolEvents();
  ensureChartReadyHook();
  pollSymbolHints();
  void probeChartData();

  window.addEventListener('popstate', () => {
    chartReadyHooked = false;
    resetSymbolState();
    pollSymbolHints();
    ensureChartReadyHook();
    void probeChartData();
  });
})();
