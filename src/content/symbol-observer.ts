import { extractSymbolFromTitle } from '../shared/tv-protocol';

type SymbolChangeHandler = (symbol: string | null) => void;

const SYMBOL_SELECTORS = [
  '[data-symbol-short]',
  '[data-symbol-full]',
  '[data-name="legend-source-title"]',
  '[class*="symbolTitle"]',
  '#header-toolbar-symbol-search',
  '#header-toolbar-symbol-search [class*="text"]',
  'button[data-tooltip*="Symbol"]',
  'button[data-tooltip*="Symbol"] [class*="text"]',
  '[data-role="button"][class*="title"]',
];

export function getDomSymbol(): string | null {
  for (const selector of SYMBOL_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;

    const value =
      el.getAttribute('data-symbol-short') ||
      el.getAttribute('data-symbol-full') ||
      el.textContent?.trim();

    if (value) return value;
  }

  return extractSymbolFromTitle(document.title);
}

function patchHistory(listener: () => void) {
  const { pushState, replaceState } = history;

  history.pushState = function (...args) {
    const result = pushState.apply(this, args);
    listener();
    return result;
  };

  history.replaceState = function (...args) {
    const result = replaceState.apply(this, args);
    listener();
    return result;
  };

  window.addEventListener('popstate', listener);
}

export class SymbolObserver {
  private observer: MutationObserver | null = null;
  private current: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private disabled = false;
  private historyPatched = false;

  constructor(private onChange: SymbolChangeHandler) {}

  setDisabled(disabled: boolean) {
    this.disabled = disabled;
  }

  start() {
    this.checkSymbol();
    this.observer = new MutationObserver(() => this.scheduleCheck());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    if (!this.historyPatched) {
      this.historyPatched = true;
      patchHistory(() => this.scheduleCheck());
    }
  }

  stop() {
    this.observer?.disconnect();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  forceCheck() {
    this.checkSymbol();
  }

  private scheduleCheck() {
    if (this.disabled) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.checkSymbol(), 300);
  }

  private checkSymbol() {
    if (this.disabled) return;

    const next = getDomSymbol();
    if (!next || next === this.current) return;
    this.current = next;
    this.onChange(next);
  }
}
