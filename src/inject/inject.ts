(function () {
  const OrigWebSocket = window.WebSocket;

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[]
  ) {
    const ws = new OrigWebSocket(url, protocols);

    ws.addEventListener('message', function (event) {
      if (typeof event.data !== 'string') return;

      try {
        const parts = event.data.split('~m~');
        if (parts.length > 2) {
          const payload = JSON.parse(parts[2]);
          if (payload.m === 'timescale_update' || payload.m === 'du') {
            window.postMessage(
              {
                type: 'TV_QUANTS_DATA',
                payload,
              },
              '*'
            );
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    });

    return ws;
  } as unknown as typeof WebSocket;

  PatchedWebSocket.prototype = OrigWebSocket.prototype;
  window.WebSocket = PatchedWebSocket;
})();

export {};
