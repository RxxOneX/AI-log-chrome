import type { ConnectionStatus } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';

interface ConnectionBannerProps {
  status: ConnectionStatus;
  language: Language;
}

const statusConfig: Record<
  ConnectionStatus,
  { titleKey: 'statusConnecting' | 'statusConnected' | 'statusStale' | 'statusNoData' | 'statusSymbolUnknown'; descKey: 'statusConnectingDesc' | 'statusConnectedDesc' | 'statusStaleDesc' | 'statusNoDataDesc' | 'statusSymbolUnknownDesc'; color: string }
> = {
  connecting: {
    titleKey: 'statusConnecting',
    descKey: 'statusConnectingDesc',
    color: 'emerald',
  },
  connected: {
    titleKey: 'statusConnected',
    descKey: 'statusConnectedDesc',
    color: 'emerald',
  },
  stale: {
    titleKey: 'statusStale',
    descKey: 'statusStaleDesc',
    color: 'amber',
  },
  no_data: {
    titleKey: 'statusNoData',
    descKey: 'statusNoDataDesc',
    color: 'gray',
  },
  symbol_unknown: {
    titleKey: 'statusSymbolUnknown',
    descKey: 'statusSymbolUnknownDesc',
    color: 'rose',
  },
};

export function ConnectionBanner({ status, language }: ConnectionBannerProps) {
  const config = statusConfig[status];
  const borderColor =
    config.color === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/10'
      : config.color === 'amber'
        ? 'border-amber-500/20 bg-amber-500/10'
        : config.color === 'rose'
          ? 'border-rose-500/20 bg-rose-500/10'
          : 'border-gray-500/20 bg-gray-500/10';
  const textColor =
    config.color === 'emerald'
      ? 'text-emerald-400'
      : config.color === 'amber'
        ? 'text-amber-400'
        : config.color === 'rose'
          ? 'text-rose-400'
          : 'text-gray-400';
  const dotColor =
    config.color === 'emerald'
      ? 'bg-emerald-500'
      : config.color === 'amber'
        ? 'bg-amber-500'
        : config.color === 'rose'
          ? 'bg-rose-500'
          : 'bg-gray-500';

  return (
    <div className={`border rounded-lg p-3 flex items-start gap-3 ${borderColor}`}>
      <div className={`mt-0.5 w-2 h-2 rounded-full ${dotColor} ${status === 'connected' ? 'animate-pulse' : ''}`} />
      <div>
        <div className={`text-xs font-semibold mb-1 ${textColor}`}>{t(config.titleKey, language)}</div>
        <div className="text-[11px] text-gray-400">{t(config.descKey, language)}</div>
      </div>
    </div>
  );
}
