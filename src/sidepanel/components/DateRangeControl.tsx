import type { DateRange } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';

interface DateRangeControlProps {
  dateRange: DateRange;
  language: Language;
  onChange: (range: DateRange) => void;
}

export function DateRangeControl({ dateRange, language, onChange }: DateRangeControlProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-gray-400 font-medium">{t('dateRangeLabel', language)}</div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateRange.start}
          onChange={(e) => onChange({ ...dateRange, start: e.target.value })}
          className="flex-1 bg-[#1e222d] border border-[#2a2e39] rounded-lg text-xs text-gray-200 px-3 py-2 outline-none focus:border-blue-500 transition-colors"
        />
        <span className="text-gray-500">-</span>
        <input
          type="date"
          value={dateRange.end}
          onChange={(e) => onChange({ ...dateRange, end: e.target.value })}
          className="flex-1 bg-[#1e222d] border border-[#2a2e39] rounded-lg text-xs text-gray-200 px-3 py-2 outline-none focus:border-blue-500 transition-colors"
        />
      </div>
    </div>
  );
}
