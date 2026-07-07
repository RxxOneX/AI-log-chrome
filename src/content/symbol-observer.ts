type SymbolChangeHandler = (symbol: string | null) => void;

const SYMBOL_SELECTORS = [
  '[data-symbol-short]',
  '[data-symbol-full]',
  '[class*="symbolTitle"]',
  '[class*="chart-markup-table"] [class*="symbol"]',
];

function parseTitleSymbol(): string | null {
  const match = document.title.match(/^(.+?)\s+[·•\-–—|]/);
  if (match?.[1]) {
    return match[1].trim();
  }
  const simple = document.title.split(' ')[0];
  return simple?.length ? simple.trim() : null;
}

export function getCurrentSymbol(): string | null {
  for (const selector of SYMBOL_SELECTORS) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const value =
      el.getAttribute('data-symbol-short') ||
      el.getAttribute('data-symbol-full') ||
      el.textContent?.trim();
    if (value) return value;
  }
  return parseTitleSymbol();
}

export class SymbolObserver {
  private observer: MutationObserver | null = null;
  private current: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unknownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private onChange: SymbolChangeHandler) {}

  start() {
    this.checkSymbol();
    this.observer = new MutationObserver(() => this.scheduleCheck());
    const root = document.documentElement;
    this.observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    this.unknownTimer = setTimeout(() => {
      if (!this.current) {
        this.onChange(null);
      }
    }, 5000);
  }

  stop() {
    this.observer?.disconnect();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.unknownTimer) clearTimeout(this.unknownTimer);
  }

  private scheduleCheck() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.checkSymbol(), 300);
  }

  private checkSymbol() {
    const next = getCurrentSymbol();
    if (next === this.current) return;
    this.current = next;
    this.onChange(next);
  }
}
