 // Import from CDN - using type="module" to allow imports
// ✅ URL-style import (works in browser)
// ✅ Use CDN-hosted ESM version of voice-stream
import { VoiceStream } from '/modules/voice-stream/dist/index.js';
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

        voiceStream = new VoiceStream({
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