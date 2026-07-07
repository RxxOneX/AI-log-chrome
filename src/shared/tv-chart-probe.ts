import type { Bar } from './types';
import { isValidBar } from './bar-sanitize';
import { extractSymbolFromTitle, extractSymbolFromUrl } from './tv-protocol';

export function normalizeTvSymbol(symbol: string): string {
  return symbol.replace(/_NAUTH/g, '').trim();
}

export function pickDisplaySymbol(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizeTvSymbol(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export type SymbolSource = 'chart' | 'ws' | 'dom' | 'url';

type SeriesDataLike = {
  size: () => number;
  valueAt: (index: number) => number[] | null | undefined;
  isEmpty?: () => boolean;
};

type WatchedValueLike = {
  value?: () => string;
  subscribe?: (listener: () => void) => void;
};

type ActiveChartLike = {
  symbol?: () => string;
  dataReady?: () => boolean;
  whenChartReady?: (callback: () => void) => void;
  onSymbolChanged?: (listener: () => void) => void;
  _chartWidget?: {
    model?: () => {
      mainSeries?: () => {
        data?: () => SeriesDataLike;
      };
    };
  };
};

export type ChartProbeWindow = Window & {
  document: Document;
  _exposed_chartWidgetCollection?: {
    _chartWidgetsDefs?: Array<{
      chartWidget?: {
        model?: () => {
          mainSeries?: () => {
            data?: () => SeriesDataLike;
          };
        };
      };
    }>;
  };
  TradingViewApi?: {
    activeChart?: () => ActiveChartLike | null;
    onActiveChartChanged?: (listener: () => void) => void;
    linking?: {
      symbol?: WatchedValueLike;
    };
  };
};

export function isChartUnavailablePage(view: ChartProbeWindow): boolean {
  const title = view.document?.title ?? '';
  if (/chart not found|找不到图表|未找到图表/i.test(title)) {
    return true;
  }
  return false;
}

export function safeActiveChart(view: ChartProbeWindow): ActiveChartLike | null {
  try {
    const api = view.TradingViewApi;
    if (!api?.activeChart) return null;
    return api.activeChart() ?? null;
  } catch {
    return null;
  }
}

export function barsFromSeriesData(data: SeriesDataLike): Bar[] {
  if (data.isEmpty?.()) return [];

  const bars: Bar[] = [];
  const size = data.size();

  for (let i = 0; i < size; i++) {
    const values = data.valueAt(i);
    if (!values || values.length < 5) continue;

    const [time, open, high, low, close] = values;
    if (
      typeof time !== 'number' ||
      typeof open !== 'number' ||
      typeof high !== 'number' ||
      typeof low !== 'number' ||
      typeof close !== 'number'
    ) {
      continue;
    }

    const bar = { time, open, high, low, close };
    if (!isValidBar(bar)) continue;

    bars.push(bar);
  }

  return bars;
}

function readChartWidget(view: ChartProbeWindow) {
  const activeChart = safeActiveChart(view);
  if (activeChart?._chartWidget) {
    return activeChart._chartWidget;
  }

  return view._exposed_chartWidgetCollection?._chartWidgetsDefs?.[0]?.chartWidget ?? null;
}

export function probeLiveSymbol(href: string, view: ChartProbeWindow): string | null {
  if (isChartUnavailablePage(view)) {
    return extractSymbolFromUrl(href);
  }

  try {
    const api = view.TradingViewApi;
    const chartSymbol = safeActiveChart(view)?.symbol?.();
    const linkSymbol = api?.linking?.symbol?.value?.();
    const titleSymbol = extractSymbolFromTitle(view.document?.title ?? '');
    const urlSymbol = extractSymbolFromUrl(href);

    return pickDisplaySymbol(chartSymbol, linkSymbol, titleSymbol, urlSymbol);
  } catch {
    return extractSymbolFromUrl(href);
  }
}

export function probeChartSnapshot(href: string, view: ChartProbeWindow): {
  symbol: string;
  bars: Bar[];
} | null {
  if (isChartUnavailablePage(view)) {
    return null;
  }

  try {
    const widget = readChartWidget(view);
    const mainSeries = widget?.model?.()?.mainSeries?.();
    const seriesData = mainSeries?.data?.();

    if (!seriesData) return null;

    const bars = barsFromSeriesData(seriesData);
    if (bars.length < 2) return null;

    const symbol = probeLiveSymbol(href, view);
    if (!symbol) return null;

    return { symbol, bars };
  } catch {
    return null;
  }
}

export function whenChartReady(view: ChartProbeWindow, callback: () => void): boolean {
  try {
    const chart = safeActiveChart(view);
    if (!chart?.whenChartReady) return false;

    chart.whenChartReady(() => {
      try {
        callback();
      } catch {
        // ignore callback errors
      }
    });
    return true;
  } catch {
    return false;
  }
}
