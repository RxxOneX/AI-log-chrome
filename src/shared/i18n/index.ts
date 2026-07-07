import { en } from './locales/en';
import { zh, type TranslationKey } from './locales/zh';

const locales = { zh, en } as const;

export type Language = keyof typeof locales;

export function t(key: TranslationKey, language: Language, params?: Record<string, string | number>): string {
  const dict = locales[language] ?? locales.zh;
  let text = dict[key] ?? locales.zh[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

export { type TranslationKey };
