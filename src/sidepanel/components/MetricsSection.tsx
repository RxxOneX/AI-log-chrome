import type { Metrics } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';
import { Box, Info } from 'lucide-react';

interface MetricsSectionProps {
  metrics: Metrics | null;
  language: Language;
}

export function MetricsSection({ metrics, language }: MetricsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {t('metricsTitle', language)}
        </h3>
        {metrics && (
          <div className="flex items-center gap-2 bg-[#131722] border border-[#2a2e39] px-2 py-1 rounded-md">
            <span className="text-[10px] text-gray-400">{t('compositeScore', language)}</span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {metrics.compositeScore.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden">
          <div className="text-xs text-gray-400 flex items-center justify-between">
            {t('sharpe', language)}
            <Info className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <div
            className={`text-2xl font-semibold font-mono ${metrics && metrics.sharpe > 1 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {metrics ? metrics.sharpe.toFixed(2) : t('waiting', language)}
          </div>
        </div>

        <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden">
          <div className="text-xs text-gray-400 flex items-center justify-between">
            {t('sortino', language)}
            <Info className="w-3.5 h-3.5 text-gray-600" />
          </div>
          <div
            className={`text-2xl font-semibold font-mono ${metrics && metrics.sortino > 1 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {metrics ? metrics.sortino.toFixed(2) : t('waiting', language)}
          </div>
        </div>
      </div>

      <div className="bg-[#131722] border border-[#2a2e39] rounded-xl overflow-hidden mt-3">
        <div className="p-3 border-b border-[#2a2e39] bg-[#1e222d] flex items-center gap-2">
          <Box className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-gray-300">{t('regressionTitle', language)}</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">
              {t('rSquared', language)}
            </div>
            <div className="text-lg font-mono text-white">
              {metrics ? (metrics.rSquared * 100).toFixed(2) : t('waiting', language)}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">
              {t('dailyGrowth', language)}
            </div>
            <div className="text-lg font-mono text-amber-400">
              {metrics ? (metrics.k * 100).toFixed(2) : t('waiting', language)}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">{t('maxTTR', language)}</div>
            <div className="text-sm text-gray-400">{t('maxTTRDesc', language)}</div>
          </div>
          <div className="text-xl font-mono text-white mt-2">
            {metrics ? metrics.maxTTR : t('waiting', language)}{' '}
            <span className="text-sm text-gray-500">{t('days', language)}</span>
          </div>
        </div>

        <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">
              {t('maxDrawdown', language)}
            </div>
            <div className="text-sm text-gray-400">{t('maxDrawdownDesc', language)}</div>
          </div>
          <div className="text-xl font-mono text-rose-400 mt-2">
            {metrics ? (metrics.maxDrawdown * 100).toFixed(2) : t('waiting', language)}%
          </div>
        </div>
      </div>
    </div>
  );
}
