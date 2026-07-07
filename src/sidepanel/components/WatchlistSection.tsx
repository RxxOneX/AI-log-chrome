import type { WatchlistItem } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';
import { Bell, BellRing } from 'lucide-react';

interface WatchlistSectionProps {
  watchlist: WatchlistItem[];
  currentSymbol: string | null;
  language: Language;
  onToggleMonitoring: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onAddCurrent: () => void;
}

function formatChange(changePct?: number): string {
  if (changePct === undefined) return '--';
  const pct = changePct * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function WatchlistSection({
  watchlist,
  currentSymbol,
  language,
  onToggleMonitoring,
  onRemove,
  onAddCurrent,
}: WatchlistSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {t('watchlistTitle', language)}
        </h3>
        {currentSymbol && !watchlist.some((w) => w.symbol === currentSymbol) && (
          <button
            onClick={onAddCurrent}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('addToWatchlist', language)}
          </button>
        )}
      </div>
      <div className="bg-[#131722] border border-[#2a2e39] rounded-xl overflow-hidden">
        <div className="grid grid-cols-3 text-[10px] text-gray-500 uppercase tracking-wider p-3 border-b border-[#2a2e39]">
          <div>{t('watchlistSymbol', language)}</div>
          <div className="text-right">{t('watchlistScore', language)}</div>
          <div className="text-right">{t('watchlistChange', language)}</div>
        </div>
        {watchlist.length === 0 ? (
          <div className="p-4 text-xs text-gray-500 text-center">--</div>
        ) : (
          <div className="divide-y divide-[#2a2e39]">
            {watchlist.map((item) => {
              const change = formatChange(item.changePct);
              const score = item.cachedMetrics?.compositeScore;
              return (
                <div
                  key={item.symbol}
                  className="grid grid-cols-[1fr_auto_auto_auto] p-3 items-center hover:bg-[#1e222d] transition-colors gap-2"
                >
                  <div className="font-semibold text-gray-200 text-sm">{item.symbol}</div>
                  <div className="text-right font-mono text-emerald-400 text-sm font-semibold pr-2">
                    {score !== undefined ? score.toFixed(1) : '--'}
                  </div>
                  <div
                    className={`text-right font-mono text-sm pr-2 ${change.startsWith('+') ? 'text-emerald-400' : change.startsWith('-') ? 'text-rose-400' : 'text-gray-400'}`}
                  >
                    {change}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleMonitoring(item.symbol)}
                      className={`p-1.5 rounded-md transition-colors ${item.monitoring ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20' : 'text-gray-500 hover:text-gray-300 hover:bg-[#2a2e39]'}`}
                      title={item.monitoring ? t('monitorOn', language) : t('monitorOff', language)}
                    >
                      {item.monitoring ? (
                        <BellRing className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => onRemove(item.symbol)}
                      className="text-[10px] text-gray-500 hover:text-rose-400 px-1"
                      title={t('removeFromWatchlist', language)}
                    >
                      x
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
