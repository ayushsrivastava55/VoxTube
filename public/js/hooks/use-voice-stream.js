// Usage: const voiceStream = useVoiceStream(wsUrl);
// voiceStream.connect();
// voiceStream.sendText('hello');
// voiceStream.on('agent-audio', (audioBlob) => { ... });

export function useVoiceStream(wsUrl) {
  let ws = null;
  const listeners = {};

  function connect() {
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      // Example: handle binary audio or JSON messages
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          emit('message', msg);
        } catch {
          emit('message', event.data);
        }
      } else {
        // Assume audio
        emit('agent-audio', event.data);
      }
    };

    ws.onopen = () => emit('open');
    ws.onclose = () => emit('close');
    ws.onerror = (e) => emit('error', e);
  }

  function sendText(text) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(cb => cb(data));
  }

  function isConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
  }

  return { connect, sendText, on, isConnected };
}