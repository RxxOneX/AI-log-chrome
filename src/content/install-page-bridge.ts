const BRIDGE_SCRIPT_ID = 'tv-quant-page-bridge-script';
const BRIDGE_PATH = 'inject/page-bridge.js';

export function installPageConsoleBridge() {
  if (!chrome.runtime?.id) return;

  const inject = () => {
    const root = document.documentElement ?? document.head;
    if (!root) return;

    const existing = document.getElementById(BRIDGE_SCRIPT_ID);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = BRIDGE_SCRIPT_ID;
    script.src = chrome.runtime.getURL(BRIDGE_PATH);
    script.async = false;
    root.appendChild(script);
  };

  if (document.documentElement) {
    inject();
    return;
  }

  document.addEventListener('DOMContentLoaded', inject, { once: true });
}
