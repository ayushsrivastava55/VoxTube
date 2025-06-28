// Import from CDN - using type="module" to allow imports
// ✅ URL-style import (works in browser)
// ✅ Use CDN-hosted ESM version of voice-stream
import { useVoiceStream } from './hooks/use-voice-stream.js';

// const voiceStream = useVoiceStream('ws://localhost:3001/ws');
// voiceStream.connect();
// voiceStream.on('agent-audio', (audio) => {
//   // handle audio blob
// });

    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-btn');
    const micButton = document.getElementById('mic-btn');
    const messagesContainer = document.getElementById('messages');
    const micStatus = document.getElementById('mic-status');
    const videoIdDisplay = document.getElementById('video-id-display');

    const urlParams = new URLSearchParams(window.location.search);
    const agentId = urlParams.get('agentId');
    const voiceId = urlParams.get('voiceId');
    const videoId = urlParams.get('videoId');
    const apiBaseUrl = 'http://localhost:3001';

    let voiceStream;
    
    function addMessage(text, sender) {
      if (!text || text.trim() === '') return; // Don't add empty messages
      const messageElement = document.createElement('div');
      messageElement.classList.add('message', `${sender}-message`);
      messageElement.textContent = text;
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  
    function sendMessage() {
      const text = messageInput.value.trim();
      if (text === '' || !voiceStream) return;
      voiceStream.sendText(text);
      // The user transcript will come back from the server, so we don't need to add it here manually.
      messageInput.value = '';
    }

    function toggleMicrophone() {
      if (!voiceStream) return;
      if (voiceStream.isMuted()) {
        voiceStream.unmute();
        micButton.classList.add('active'); // Use 'active' class from CSS
        micStatus.textContent = 'Microphone is ON';
      } else {
        voiceStream.mute();
        micButton.classList.remove('active');
        micStatus.textContent = 'Microphone is OFF';
      }
    }

    async function initializeVoiceStream() {
      if (!agentId || !voiceId || !videoId) {
        addMessage('Missing required information to start the conversation.', 'system');
        return;
      }
      
      if (videoId) {
        videoIdDisplay.textContent = `Video ID: ${videoId}`;
      } else {
        videoIdDisplay.textContent = 'Error: No video ID provided';
      }

      addMessage('Connecting to AI speaker...', 'system');
      try {
        const response = await fetch(`${apiBaseUrl}/api/streaming-url/${agentId}`);
        if (!response.ok) {
          throw new Error(`Failed to get streaming URL: ${response.statusText}`);
        }
        const data = await response.json();
        const websocketUrl = data.url;

        voiceStream = new useVoiceStream ({
          websocketUrl,
          voiceId,
          elevenLabsApiKey: null, // API key is in the URL, so not needed here
          bufferSize: 4096,
          chromeExtensionId: null // Not running inside an extension context
        });

        // Set up event listeners
        voiceStream.on('open', () => {
            addMessage('Connection opened. You can now speak.', 'system');
            micButton.disabled = false;
            sendButton.disabled = false;
            messageInput.disabled = false;
            voiceStream.unmute(); // Start with mic on
            micButton.classList.add('active');
            micStatus.textContent = 'Microphone is ON';
        });
        voiceStream.on('close', () => {
            addMessage('Connection closed.', 'system');
            micButton.disabled = true;
            sendButton.disabled = true;
            messageInput.disabled = true;
            micButton.classList.remove('active');
            micStatus.textContent = 'Click microphone to speak';
        });
        voiceStream.on('error', (error) => addMessage(`Error: ${error.message}`, 'system'));
        voiceStream.on('user-transcript', (transcript) => addMessage(transcript, 'user'));
        voiceStream.on('agent-transcript', (transcript) => addMessage(transcript, 'agent'));
        voiceStream.on('agent-audio', (audio) => {
          const audioBlob = new Blob([audio], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);
          new Audio(audioUrl).play();
        });

        // Connect
        await voiceStream.connect();

      } catch (error) {
        console.error('Initialization Error:', error);
        addMessage(`Failed to initialize: ${error.message}`, 'system');
      }
    }

    // Add event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
    micButton.addEventListener('click', toggleMicrophone);

    // Disable controls initially
    micButton.disabled = true;
    sendButton.disabled = true;
    messageInput.disabled = true;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', initializeVoiceStream);
    
    // Clean up on page close
    window.addEventListener('beforeunload', () => {
      if (voiceStream) {
        voiceStream.disconnect();
      }
    });

/* === [VOICE LOOP FEATURE: Begin review block] === */

// Feature flag for voice-driven loop
const ENABLE_VOICE_LOOP = true;

// Globals for recognition and state
let recognition;
let isRecognizing = false;

// Start listening with Web Speech API
function startListening() {
  if (!ENABLE_VOICE_LOOP) return;
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    addMessage('SpeechRecognition not supported in this browser.', 'system');
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    isRecognizing = true;
    micButton.classList.add('active');
    micStatus.textContent = 'Listening...';
  };
  recognition.onerror = (event) => {
    isRecognizing = false;
    micButton.classList.remove('active');
    micStatus.textContent = 'Mic error: ' + event.error;
    addMessage(`STT error: ${event.error}`, 'system');
    // Optionally auto-restart after a short delay
    setTimeout(() => { if (ENABLE_VOICE_LOOP) startListening(); }, 1500);
  };
  recognition.onend = () => {
    isRecognizing = false;
    micButton.classList.remove('active');
    micStatus.textContent = 'Click microphone to speak';
    // Optionally auto-restart if not stopped by user
    // setTimeout(() => { if (ENABLE_VOICE_LOOP) startListening(); }, 1000);
  };
  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    handleUserQuery(text);
  };
  recognition.start();
}

// Handle recognized user query
async function handleUserQuery(text) {
  addMessage(text, 'user');
  micStatus.textContent = 'Processing...';

  try {
    let audioBlob;
    // Prefer WebSocket if available and open
    if (typeof voiceStream !== 'undefined' && voiceStream.isConnected && voiceStream.isConnected()) {
      voiceStream.sendText(text);
      // Audio will be handled by 'agent-audio' event
      return;
    } else {
      // REST fallback: POST to ElevenLabs conversational endpoint
      // TODO: Replace convId with actual conversation/agent id as needed
      const convId = window.currentConversationId || 'YOUR_CONVERSATION_ID';
      const res = await fetch(`https://api.elevenlabs.io/v1/conversation/${convId}/say`, {
        method: 'POST',
        headers: {
          'xi-api-key': 'YOUR_API_KEY', // Replace with actual key or backend proxy
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('TTS failed');
      audioBlob = await res.blob();
      await playAudioBlob(audioBlob);
    }
  } catch (err) {
    addMessage(`TTS error: ${err.message}`, 'system');
    micStatus.textContent = 'Error. Click mic to retry.';
    isRecognizing = false;
    micButton.classList.remove('active');
    return;
  }
  // After playback, restart listening
  if (ENABLE_VOICE_LOOP) startListening();
}

// Play audio Blob and return a promise that resolves after playback
function playAudioBlob(blob) {
  return new Promise((resolve) => {
    // Stop any previous playback
    if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
    }
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    window.currentAudio = audio;
    audio.onended = () => {
      micStatus.textContent = 'Click microphone to speak';
      resolve();
    };
    audio.play();
  });
}

// Wire up mic button to start listening
micButton.onclick = () => {
  if (!isRecognizing && ENABLE_VOICE_LOOP) startListening();
};

/* === [VOICE LOOP FEATURE: End review block] === */