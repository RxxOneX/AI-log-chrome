type RuntimeMessage = Record<string, unknown>;

let contextInvalidated = false;
const trackedTimers = new Set<ReturnType<typeof setInterval | typeof setTimeout>>();
const shutdownHooks = new Set<() => void>();

function isInvalidationError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes('Extension context invalidated');
}

export function isExtensionContextValid(): boolean {
  if (contextInvalidated) return false;

  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    contextInvalidated = true;
    return false;
  }
}

function markContextInvalidated() {
  if (contextInvalidated) return;
  contextInvalidated = true;

  for (const timer of trackedTimers) {
    clearInterval(timer);
    clearTimeout(timer);
  }
  trackedTimers.clear();

  for (const hook of shutdownHooks) {
    hook();
  }
  shutdownHooks.clear();
}

export function installContextGuard() {
  window.addEventListener('error', (event) => {
    if (!isInvalidationError(event.message)) return;
    event.preventDefault();
    markContextInvalidated();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string } | string | undefined;
    const message = typeof reason === 'string' ? reason : reason?.message;
    if (!isInvalidationError(message)) return;
    event.preventDefault();
    markContextInvalidated();
  });
}

export function onContextShutdown(hook: () => void) {
  if (contextInvalidated) {
    hook();
    return;
  }
  shutdownHooks.add(hook);
}

export function trackTimer(timer: ReturnType<typeof setInterval | typeof setTimeout>) {
  trackedTimers.add(timer);
  return timer;
}

export function sendToBackground(message: RuntimeMessage): boolean {
  if (!isExtensionContextValid()) {
    return false;
  }

  try {
    chrome.runtime.sendMessage(message, () => {
      if (isInvalidationError(chrome.runtime.lastError?.message)) {
        markContextInvalidated();
      }
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isInvalidationError(message)) {
      markContextInvalidated();
    }
    return false;
  }
}

export async function requestFromBackground<T>(message: RuntimeMessage): Promise<T | null> {
  if (!isExtensionContextValid()) return null;

  try {
    return await new Promise<T | null>((resolve) => {
      chrome.runtime.sendMessage(message, (response: T) => {
        if (isInvalidationError(chrome.runtime.lastError?.message)) {
          markContextInvalidated();
          resolve(null);
          return;
        }
        resolve(response ?? null);
      });
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (isInvalidationError(text)) {
      markContextInvalidated();
    }
    return null;
  }
}
