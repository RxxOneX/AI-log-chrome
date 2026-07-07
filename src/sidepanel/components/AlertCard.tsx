import type { AlertResult } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';
import { AlertTriangle, X } from 'lucide-react';

interface AlertCardProps {
  alert: AlertResult;
  language: Language;
  threshold: number;
  onDismiss: () => void;
}

export function AlertCard({ alert, language, threshold, onDismiss }: AlertCardProps) {
  return (
    <div className="bg-[#1e1515]/90 border border-rose-500/30 rounded-lg p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-rose-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-rose-400 mb-1 flex items-center justify-between">
          <span>
            {t('alertTitle', language)} ({alert.symbol})
          </span>
          <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs text-gray-300 leading-relaxed">
          {t('alertBody', language, { threshold: String(threshold) })}
        </div>
      </div>
    </div>
  );
}
