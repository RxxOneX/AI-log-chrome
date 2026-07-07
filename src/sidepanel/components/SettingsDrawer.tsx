import type { AppSettings } from '../../shared/types';
import { t, type Language } from '../../shared/i18n';
import { X } from 'lucide-react';

interface SettingsDrawerProps {
  open: boolean;
  settings: AppSettings;
  language: Language;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

export function SettingsDrawer({ open, settings, language, onClose, onChange }: SettingsDrawerProps) {
  if (!open) return null;

  const update = (partial: Partial<AppSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const updateAlert = (partial: Partial<AppSettings['alert']>) => {
    onChange({ ...settings, alert: { ...settings.alert, ...partial } });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[320px] h-full bg-[#131722] border-l border-[#2a2e39] p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-white">{t('settingsTitle', language)}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-gray-400 block mb-2">{t('language', language)}</label>
            <select
              value={settings.language}
              onChange={(e) => update({ language: e.target.value as Language })}
              className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-lg text-sm text-gray-200 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">{t('defaultWindowDays', language)}</label>
            <input
              type="number"
              min={7}
              max={3650}
              value={settings.defaultWindowDays}
              onChange={(e) => update({ defaultWindowDays: Number(e.target.value) })}
              className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-lg text-sm text-gray-200 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">{t('compositeThreshold', language)}</label>
            <input
              type="number"
              min={0}
              max={100}
              value={settings.alert.compositeThreshold}
              onChange={(e) => updateAlert({ compositeThreshold: Number(e.target.value) })}
              className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-lg text-sm text-gray-200 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.alert.ttrNewExtremeEnabled}
              onChange={(e) => updateAlert({ ttrNewExtremeEnabled: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-300">{t('ttrNewExtreme', language)}</span>
          </label>

          <div>
            <label className="text-xs text-gray-400 block mb-2">{t('alertScope', language)}</label>
            <select
              value={settings.alert.alertScope}
              onChange={(e) =>
                updateAlert({
                  alertScope: e.target.value as AppSettings['alert']['alertScope'],
                })
              }
              className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-lg text-sm text-gray-200 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="current_symbol">{t('alertScopeCurrent', language)}</option>
              <option value="monitored_only">{t('alertScopeMonitored', language)}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
