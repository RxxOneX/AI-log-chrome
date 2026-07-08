import {
  DIAG_RESULT_TYPE,
  DIAG_RUN_TYPE,
  DIAG_WATCH_TYPE,
} from '../shared/pipeline-diagnostic';

(function () {
  const globalWindow = window as Window & {
    __TV_QUANT_RUN_DIAG__?: () => Promise<unknown>;
    __TV_QUANT_WATCH__?: (seconds?: number) => Promise<unknown>;
    __TV_QUANT_STATUS__?: () => Record<string, unknown>;
    __TV_QUANT_PAGE_BRIDGE__?: string;
    __TV_QUANT_INJECTED__?: boolean;
    __TV_QUANT_STATS__?: Record<string, unknown>;
  };

  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
  >();

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== DIAG_RESULT_TYPE) return;
    const requestId = event.data.requestId as string | undefined;
    if (!requestId) return;

    const handler = pending.get(requestId);
    if (!handler) return;
    pending.delete(requestId);
    handler.resolve(event.data.payload);
  });

  function callContentDiagnostic(
    type: string,
    payload: Record<string, unknown>,
    timeoutMs = 90_000
  ) {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('diagnostic timeout - content script may not be running'));
      }, timeoutMs);

      pending.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timer);
          reject(reason);
        },
      });

      window.postMessage({ type, requestId, ...payload }, '*');
    });
  }

  globalWindow.__TV_QUANT_RUN_DIAG__ = () => callContentDiagnostic(DIAG_RUN_TYPE, {});
  globalWindow.__TV_QUANT_WATCH__ = (seconds = 30) =>
    callContentDiagnostic(DIAG_WATCH_TYPE, { seconds }, (seconds + 15) * 1000);

  globalWindow.__TV_QUANT_STATUS__ = () => ({
    pageBridge: true,
    bridgeVersion: '1',
    inject: Boolean(globalWindow.__TV_QUANT_INJECTED__),
    injectStats: globalWindow.__TV_QUANT_STATS__ ?? null,
    href: window.location.href,
    isTopFrame: window.top === window.self,
  });

  globalWindow.__TV_QUANT_PAGE_BRIDGE__ = '1';
})();
