import type { DrawdownGaugeState, Metrics } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';
import { formatNumber } from '../../shared/format-number';

interface DrawdownGaugeProps {
  metrics: Metrics | null;
  language: Language;
}

const CX = 150;
const CY = 138;
const ARC_PATH = 'M 42 138 A 108 108 0 0 1 258 138';
const ARC_LENGTH = 339;

function polarToXY(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(rad),
    y: CY + radius * Math.sin(rad),
  };
}

function progressColor(ratio: number, exceeded: boolean): string {
  if (exceeded) return '#ef4444';
  if (ratio >= 0.85) return '#f97316';
  if (ratio >= 0.55) return '#fbbf24';
  return '#38bdf8';
}

function gaugeRatio(state: DrawdownGaugeState, maxTTR: number): number {
  if (!state.inDrawdown) return 1;
  if (maxTTR <= 0) return 0;
  return state.currentDrawdownDays / maxTTR;
}

export function DrawdownGauge({ metrics, language }: DrawdownGaugeProps) {
  const waiting = t('waiting', language);

  if (!metrics) {
    return (
      <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4 flex items-center justify-center h-[200px] text-xs text-gray-500">
        {waiting}
      </div>
    );
  }

  const state = metrics.drawdown;
  const maxTTR = metrics.maxTTR;
  const inDrawdown = state.inDrawdown;
  const ratio = gaugeRatio(state, maxTTR);
  const fillRatio = inDrawdown ? Math.min(1, ratio) : 1;
  const fillLength = ARC_LENGTH * fillRatio;
  const fillColor = inDrawdown
    ? progressColor(ratio, state.exceededMaxTTRDays > 0)
    : '#22c55e';

  const title = inDrawdown
    ? t('gaugeStatusDrawdown', language, {
        percent: formatNumber(Math.min(100, ratio * 100), 0),
      })
    : t('gaugeStatusNoDrawdown', language);

  const detail = inDrawdown
    ? state.exceededMaxTTRDays > 0
      ? t('gaugeProgressExceeded', language, {
          days: formatNumber(state.exceededMaxTTRDays, 0),
        })
      : t('gaugeProgressRemaining', language, {
          days: formatNumber(state.daysToMaxTTR, 0),
        })
    : t('gaugeProgressFull', language);

  const leftLabel = polarToXY(-68, 118);
  const rightLabel = polarToXY(68, 118);

  return (
    <div className="bg-[#131722] border border-[#2a2e39] rounded-xl p-4">
      <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-2 px-1">
        {t('drawdownGaugeTitle', language)}
      </div>

      <div className="relative w-full max-w-[300px] mx-auto">
        <svg viewBox="0 0 300 160" className="w-full h-auto" aria-hidden>
          <path
            d={ARC_PATH}
            stroke="#2a2e39"
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={ARC_PATH}
            stroke={fillColor}
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${fillLength} ${ARC_LENGTH}`}
          />
        </svg>

        <span
          className="absolute text-[10px] text-gray-500 -translate-x-1/2"
          style={{ left: `${(leftLabel.x / 300) * 100}%`, top: `${(leftLabel.y / 160) * 100}%` }}
        >
          0
        </span>
        <span
          className="absolute text-[10px] text-gray-500 -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(rightLabel.x / 300) * 100}%`, top: `${(rightLabel.y / 160) * 100}%` }}
        >
          {formatNumber(maxTTR, 0)}
          {t('days', language)}
        </span>
      </div>

      <div className="text-center -mt-1">
        <div className={`text-xl font-semibold ${inDrawdown ? 'text-amber-400' : 'text-emerald-400'}`}>
          {title}
        </div>
        <div className="text-xs text-gray-400 mt-1">{detail}</div>
        {inDrawdown && (
          <div className="text-[11px] text-gray-500 mt-1 font-mono">
            {t('gaugeProgressElapsed', language, {
              current: formatNumber(state.currentDrawdownDays, 0),
              max: formatNumber(maxTTR, 0),
            })}
          </div>
        )}
      </div>
    </div>
  );
}
