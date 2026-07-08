import { MESSAGE_TYPES, type PipelineDiagnosticState, type TvSessionPayload } from '../shared/messages';
import { MIN_USABLE_BARS } from '../shared/bar-merge';
import {
  probeChartSnapshot,
  probeLiveSymbol,
  type ChartProbeWindow,
} from '../shared/tv-chart-probe';
import { extractSymbolFromUrl } from '../shared/tv-protocol';
import {
  DIAG_PING_TYPE,
  DIAG_PONG_TYPE,
  DIAG_RESULT_TYPE,
  DIAG_RUN_TYPE,
  DIAG_WATCH_TYPE,
  formatPipelineReport,
  maskSessionId,
  summarizeSteps,
  type DiagStep,
  type PipelineDiagnosticReport,
} from '../shared/pipeline-diagnostic';
import type { BarStore } from './bar-store';
import type { SymbolTracker } from './symbol-tracker';
import { getDomSymbol } from './symbol-observer';
import { isExtensionContextValid, requestFromBackground } from './extension-bridge';

type InjectDiagPong = {
  injected: boolean;
  stats?: Record<string, unknown>;
  liveSymbol?: string | null;
  chartBars?: number;
  chartSymbol?: string | null;
  historyBars?: number;
  hasSession?: boolean;
  sessionMask?: string;
  chartApi?: boolean;
  error?: string;
};

type ContentDiagDeps = {
  getBarStore: () => BarStore;
  getSymbolTracker: () => SymbolTracker;
  getActiveSymbol: () => string | null;
  getLastSentAt: () => number;
  requestInject: () => void;
  syncTvSession: () => Promise<void>;
  resyncToBackground: () => void;
};

let deps: ContentDiagDeps | null = null;

export function initPipelineDiagnostic(context: ContentDiagDeps) {
  deps = context;

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data?.requestId) return;

    if (event.data.type === DIAG_RUN_TYPE) {
      void runPipelineDiagnostic().then((report) => {
        window.postMessage(
          {
            type: DIAG_RESULT_TYPE,
            requestId: event.data.requestId,
            payload: report,
          },
          '*'
        );
      });
      return;
    }

    if (event.data.type === DIAG_WATCH_TYPE) {
      const seconds = typeof event.data.seconds === 'number' ? event.data.seconds : 30;
      void watchPipeline(seconds).then(() => {
        window.postMessage(
          {
            type: DIAG_RESULT_TYPE,
            requestId: event.data.requestId,
            payload: { ok: true },
          },
          '*'
        );
      });
    }
  });
}

function step(
  id: string,
  layer: DiagStep['layer'],
  status: DiagStep['status'],
  message: string,
  detail?: Record<string, unknown>
): DiagStep {
  return { id, layer, status, message, detail };
}

async function pingInject(timeoutMs = 4000): Promise<InjectDiagPong | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.data?.type !== DIAG_PONG_TYPE) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(event.data.payload as InjectDiagPong);
    };

    window.addEventListener('message', onMessage);
    window.postMessage({ type: DIAG_PING_TYPE }, '*');
  });
}

async function fetchBackgroundState(): Promise<{
  state: PipelineDiagnosticState | null;
  session: TvSessionPayload | null;
}> {
  const session = await requestFromBackground<TvSessionPayload>({
    type: MESSAGE_TYPES.GET_TV_SESSION,
    pageUrl: window.location.href,
  });

  const state = await requestFromBackground<PipelineDiagnosticState>({
    type: MESSAGE_TYPES.GET_PIPELINE_DIAGNOSTIC,
    pageUrl: window.location.href,
  });

  return { state, session };
}

export async function runPipelineDiagnostic(): Promise<PipelineDiagnosticReport> {
  const started = Date.now();
  const steps: DiagStep[] = [];

  if (!deps) {
    const report: PipelineDiagnosticReport = {
      ranAt: started,
      pageUrl: window.location.href,
      durationMs: 0,
      steps: [step('init', 'content', 'fail', 'diagnostic not initialized')],
      summary: { pass: 0, warn: 0, fail: 1 },
    };
    console.error(formatPipelineReport(report));
    return report;
  }

  const contextValid = isExtensionContextValid();
  steps.push(
    step('extension_context', 'content', contextValid ? 'pass' : 'fail', contextValid
      ? 'content script context valid'
      : 'extension context invalidated, refresh page')
  );

  deps.requestInject();
  await deps.syncTvSession();

  const inject = await pingInject();
  if (!inject) {
    steps.push(step('inject_ping', 'inject', 'fail', 'inject script no response', {
      hint: 'reload extension and refresh page',
    }));
  } else if (!inject.injected) {
    steps.push(step('inject_ping', 'inject', 'fail', 'inject flag missing'));
  } else {
    steps.push(
      step('inject_ping', 'inject', 'pass', 'inject script alive', {
        stats: inject.stats,
      })
    );

    const chartBars = inject.chartBars ?? 0;
    steps.push(
      step('inject_chart_probe', 'inject', chartBars >= MIN_USABLE_BARS ? 'pass' : chartBars > 1 ? 'warn' : 'fail',
        `chart snapshot bars=${chartBars}`,
        { symbol: inject.chartSymbol, liveSymbol: inject.liveSymbol })
    );

    steps.push(
      step('inject_history_probe', 'inject', 'skip', 'history api not used (chart snapshot is primary)')
    );

    steps.push(
      step('inject_ws', 'inject', (inject.stats?.wsRecvFrames as number) > 0 ? 'pass' : 'warn',
        `ws recv=${inject.stats?.wsRecvFrames ?? 0} barPayloads=${inject.stats?.barPayloads ?? 0}`)
    );
  }

  const tracker = deps.getSymbolTracker();
  const store = deps.getBarStore();
  const urlSymbol = extractSymbolFromUrl(window.location.href);
  const domSymbol = getDomSymbol();
  const contentSymbol = tracker.get();

  steps.push(
    step('content_symbol_sources', 'content', contentSymbol ? 'pass' : 'warn', `effective=${contentSymbol ?? '(none)'}`,
      {
        active: deps.getActiveSymbol(),
        source: tracker.getSource(),
        url: urlSymbol,
        dom: domSymbol,
        sources: tracker.getSources(),
      })
  );

  const localBars = store.getBars().length;
  steps.push(
    step('content_bar_store', 'content', localBars >= MIN_USABLE_BARS ? 'pass' : localBars > 1 ? 'warn' : 'fail',
      `local bars=${localBars} snapshot=${store.hasSnapshot()}`,
      { symbol: store.getSymbol() })
  );

  const lastSent = deps.getLastSentAt();
  const sentAge = lastSent ? Date.now() - lastSent : null;
  steps.push(
    step('content_last_send', 'content', sentAge !== null && sentAge < 30_000 ? 'pass' : 'warn',
      sentAge === null ? 'never sent bars to background' : `last send ${Math.round(sentAge / 1000)}s ago`)
  );

  const view = window as ChartProbeWindow;
  const liveProbe = probeLiveSymbol(window.location.href, view);
  const chartProbe = probeChartSnapshot(window.location.href, view);
  steps.push(
    step('content_live_probe', 'content', chartProbe ? 'pass' : 'warn', 'content-side chart probe',
      { liveProbe, chartBars: chartProbe?.bars.length ?? 0, chartSymbol: chartProbe?.symbol ?? null })
  );

  const { state, session } = await fetchBackgroundState();
  steps.push(
    step('background_session', 'background', session?.loggedIn ? 'pass' : 'fail',
      session?.loggedIn ? `logged in (${maskSessionId(session.sessionid)})` : 'no sessionid cookie',
      { hasSign: Boolean(session?.sessionid_sign) })
  );

  if (!state) {
    steps.push(step('background_state', 'background', 'fail', 'no background diagnostic response'));
  } else {
    const bgBars = state.bars.length;
    steps.push(
      step('background_state', 'background', bgBars >= MIN_USABLE_BARS ? 'pass' : bgBars > 1 ? 'warn' : 'fail',
        `symbol=${state.symbol ?? '(none)'} status=${state.connectionStatus} bars=${bgBars}`,
        {
          metrics: state.metrics ? 'yes' : 'no',
          lastUpdatedAt: state.symbolBarsLastUpdatedAt,
        })
    );

    if (contentSymbol && state.symbol && contentSymbol !== state.symbol) {
      steps.push(
        step('symbol_mismatch', 'lifecycle', 'fail', 'content vs background symbol mismatch', {
          content: contentSymbol,
          background: state.symbol,
        })
      );
    }

    if (localBars >= MIN_USABLE_BARS && bgBars < MIN_USABLE_BARS) {
      steps.push(
        step('bars_mismatch', 'lifecycle', 'fail', 'content has bars but background does not', {
          contentBars: localBars,
          backgroundBars: bgBars,
        })
      );
    }
  }

  const report: PipelineDiagnosticReport = {
    ranAt: started,
    pageUrl: window.location.href,
    durationMs: Date.now() - started,
    steps,
    summary: summarizeSteps(steps),
  };

  console.log(formatPipelineReport(report));
  if (report.summary.fail > 0) {
    console.warn('[TV Quant] pipeline has failures');
  }
  return report;
}

export async function watchPipeline(seconds = 30): Promise<void> {
  if (!deps) {
    console.error('diagnostic not initialized');
    return;
  }

  console.log(`[TV Quant] watching pipeline for ${seconds}s — switch symbol now`);
  const started = Date.now();
  let lastKey = '';

  while (Date.now() - started < seconds * 1000) {
    const tracker = deps.getSymbolTracker();
    const store = deps.getBarStore();
    const key = [
      tracker.get(),
      tracker.getSource(),
      store.getBars().length,
      deps.getActiveSymbol(),
      deps.getLastSentAt(),
    ].join('|');

    if (key !== lastKey) {
      lastKey = key;
      console.log('[TV Quant watch]', {
        t: `${Math.round((Date.now() - started) / 1000)}s`,
        symbol: tracker.get(),
        source: tracker.getSource(),
        active: deps.getActiveSymbol(),
        localBars: store.getBars().length,
        snapshot: store.hasSnapshot(),
        lastSentAge: deps.getLastSentAt() ? `${Math.round((Date.now() - deps.getLastSentAt()) / 1000)}s` : 'never',
        sources: tracker.getSources(),
      });
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('[TV Quant] watch ended, running full diagnostic...');
  await runPipelineDiagnostic();
}
