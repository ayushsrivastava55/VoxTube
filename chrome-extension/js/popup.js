// Popup script for YouTube AI Speaker extension
// Handles the extension popup UI and settings

// Define base URL for API calls
const apiBaseUrl = 'http://localhost:3001';

document.addEventListener('DOMContentLoaded', () => {
  // Get elements
  const statusElement = document.getElementById('status');
  const controlsElement = document.getElementById('controls');
  const prepareButton = document.getElementById('prepare-btn');
  const apiUrlInput = document.getElementById('api-url');
  const saveSettingsButton = document.getElementById('save-settings');
  const conversationContainer = document.getElementById('conversation-container');
  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-btn');
  const micButton = document.getElementById('mic-btn');
  const micStatus = document.getElementById('mic-status');

  // Load settings
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (result.apiBaseUrl) {
      apiUrlInput.value = result.apiBaseUrl;
    }
  });

  // Save settings
  saveSettingsButton.addEventListener('click', () => {
    const apiBaseUrl = apiUrlInput.value.trim();

    if (!apiBaseUrl) {
      alert('Please enter a valid API URL');
      return;
    }

    chrome.storage.local.set({ apiBaseUrl });
    chrome.runtime.sendMessage({ type: 'SET_API_URL', apiBaseUrl });

    // Show success message
    saveSettingsButton.textContent = 'Saved!';
    setTimeout(() => {
      saveSettingsButton.textContent = 'Save Settings';
    }, 2000);
  });

  // Check if we're on a YouTube video page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const url = new URL(currentTab.url);

    if (url.hostname.includes('youtube.com') && url.pathname === '/watch') {
      // Extract video ID
      const videoId = url.searchParams.get('v');

      if (videoId) {
        // Update status
        statusElement.textContent = `Connected to YouTube video: ${videoId}`;
        controlsElement.classList.remove('hidden');

        // Check preparation status
        checkPreparationStatus(videoId);

        // Prepare button
        prepareButton.addEventListener('click', () => {
          prepareVideo(videoId, currentTab.url);
        });
      }
    }
  });

  // Check preparation status
  function checkPreparationStatus(videoId) {
    // Get status elements
    const transcriptionStatus = document.getElementById('transcription-status');
    const voiceStatus = document.getElementById('voice-status');
    const agentStatus = document.getElementById('agent-status');

    // Check if video is already prepared
    chrome.storage.local.get([`video_${videoId}`], (result) => {
      const videoData = result[`video_${videoId}`];

      if (videoData) {
        if (videoData.prepared) {
          transcriptionStatus.textContent = 'Complete';
          transcriptionStatus.className = 'status-value success';
          prepareButton.textContent = 'Re-Prepare Video';
        }

        if (videoData.voiceCloned) {
          voiceStatus.textContent = 'Complete';
          voiceStatus.className = 'status-value success';
        }

        if (videoData.agentCreated) {
          agentStatus.textContent = 'Complete';
          agentStatus.className = 'status-value success';
        }
      }
    });
  }

  // Prepare video and orchestrate the entire backend process
 function prepareVideo(videoId, videoUrl) {
  const transcriptionStatus = document.getElementById('transcription-status');
  const voiceStatus = document.getElementById('voice-status');
  const agentStatus = document.getElementById('agent-status');

  // Show progress
  transcriptionStatus.textContent = 'Fetching context...';
  transcriptionStatus.className = 'status-value in-progress';
  voiceStatus.textContent = 'Cloning voice...';
  voiceStatus.className = 'status-value in-progress';
  agentStatus.textContent = 'Pending';
  agentStatus.className = 'status-value';

  prepareButton.disabled = true;
  prepareButton.textContent = 'Preparing...';

  chrome.runtime.sendMessage(
    { type: 'PREPARE_VIDEO', videoId, videoUrl },
    (response) => {
      if (response && response.success) {
        console.log('Instant context preparation successful:', response.data);

        // Update UI
        transcriptionStatus.textContent = 'Complete';
        transcriptionStatus.className = 'status-value success';
        voiceStatus.textContent = 'Complete';
        voiceStatus.className = 'status-value success';
        agentStatus.textContent = 'Ready';
        agentStatus.className = 'status-value success';

        prepareButton.disabled = false;
        prepareButton.textContent = 'Talk to Your AI';

        // Save only available details
        chrome.storage.local.set({
          [`video_${videoId}`]: {
            voiceId: response.data.voiceId,
            prepared: true
          }
        });

        // FIX: Extract voiceId and agentId from response.data before using them
        const voiceId = response.data.voiceId;
        const agentId = response.data.agentId;
        if (!agentId) {
  alert('Agent creation failed. Please try again.');
  return;
}
        const url = `http://localhost:3001/conversation.html?videoId=${videoId}&voiceId=${voiceId}&agentId=${agentId}`;
        window.open(url, '_blank');

        prepareButton.onclick = () => {
          chrome.tabs.create({ url });
        };

      } else {
        console.error('Failed to prepare video (instant context):', response?.error);

        transcriptionStatus.textContent = 'Failed';
        transcriptionStatus.className = 'status-value error';
        voiceStatus.textContent = 'Not started';
        voiceStatus.className = 'status-value';
        agentStatus.textContent = 'Not started';
        agentStatus.className = 'status-value';

        prepareButton.disabled = false;
        prepareButton.textContent = 'Retry Preparation';
      }
    }
  );
}

  // WebSocket conversation logic
  function startConversation(websocketUrl, voiceId) {
    conversationContainer.classList.remove('hidden');
    prepareButton.style.display = 'none'; // Hide the prepare button

    const socket = new WebSocket(websocketUrl);
    let audioQueue = [];
    let isPlaying = false;
    let isRecording = false;
    let mediaRecorder = null;
    let recordedChunks = [];

    // Audio context for processing microphone input
    let audioContext = null;
    let micStream = null;

    socket.onopen = () => {
      console.log('WebSocket connection opened with URL:', websocketUrl);
      // Send initial message to configure the conversation
      const initMessage = {
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          tts: { voice_id: voiceId },
          agent_settings: {
            enable_realtime_media_processing: true
          }
        }
      };
      console.log('Sending initialization message:', initMessage);
      socket.send(JSON.stringify(initMessage));
      addMessage('Connected. You can now start the conversation.', 'system');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'audio_chunk_user_media') {
        // User audio chunk reflected back, can ignore
      } else if (data.type === 'audio_chunk_agent_media') {
        // Agent audio chunk, queue it for playback
        audioQueue.push(new Audio("data:audio/mpeg;base64," + data.chunk));
        if (!isPlaying) {
          playNextInQueue();
        }
      } else if (data.type === 'transcript_chunk_agent_media') {
        // Agent transcript chunk, display it
        addMessage(data.chunk, 'agent');
      } else if (data.type === 'user_transcript') {
        // Server's transcription of user speech
        if (data.user_transcription_event && data.user_transcription_event.user_transcript) {
          const transcript = data.user_transcription_event.user_transcript;
          addMessage(`You said: ${transcript}`, 'user');
        }
      } else if (data.type === 'agent_response') {
        // Full agent response text if available
        if (data.agent_response_event && data.agent_response_event.agent_response) {
          // Handle if needed, but we already display transcript chunks
        }
      } else if (data.type === 'interruption') {
        // Handle conversation interruptions
        if (data.interruption_event && data.interruption_event.reason) {
          addMessage(`Conversation interrupted: ${data.interruption_event.reason}`, 'system');
        }
      } else if (data.type === 'ping') {
        // Keep connection alive by responding to pings
        if (data.ping_event) {
          setTimeout(() => {
            socket.send(JSON.stringify({
              type: 'pong',
              event_id: data.ping_event.event_id
            }));
          }, data.ping_event.ping_ms || 0);
        }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error occurred:', error);
      // More detailed diagnostics
      if (websocketUrl.indexOf('xi-api-key') === -1) {
        console.error('API key missing from WebSocket URL');
      }
      if (!websocketUrl.startsWith('wss://')) {
        console.error('WebSocket URL must use secure connection (wss://)');
      }
      addMessage('Connection error. Check console for details.', 'system');
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      addMessage('Conversation ended.', 'system');
      stopMicrophone();
    };

    function playNextInQueue() {
      if (audioQueue.length > 0) {
        isPlaying = true;
        const audio = audioQueue.shift();
        audio.play();
        audio.onended = () => {
          isPlaying = false;
          playNextInQueue();
        };
      } else {
        isPlaying = false;
      }
    }

    function sendMessage() {
      const text = messageInput.value;
      if (text.trim() === '') return;

      addMessage(text, 'user');
      socket.send(JSON.stringify({
        type: 'user_media_chunk',
        chunk: text
      }));
      messageInput.value = '';
    }

    // Initialize microphone and audio recording
    async function initMicrophone() {
      try {
        // Request microphone access directly through the browser's native permission system
        console.log('Requesting microphone access...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted!'); 
        micStream = stream;
        audioContext = new AudioContext();
        const audioSource = audioContext.createMediaStreamSource(stream);

        // Set up media recorder with a supported MIME type
        let mimeType = 'audio/webm';
        const supportedTypes = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/ogg;codecs=opus'
        ];
        
        // Find first supported MIME type
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            console.log('Using supported MIME type:', mimeType);
            break;
          }
        }
        
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.push(event.data);
            
            // Convert audio chunk to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result.split(',')[1];
              // Send audio chunk to server
              if (socket.readyState === WebSocket.OPEN && base64data) {
                socket.send(JSON.stringify({
                  user_audio_chunk: base64data
                }));
                console.log('Sent audio chunk, length:', base64data.length);
              }
            };
            reader.readAsDataURL(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          // Reset for next recording
          recordedChunks = [];
        };
        
        return true;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        addMessage('Could not access microphone. Please check permissions.', 'system');
        return false;
      }
    }

    function startRecording() {
      if (!mediaRecorder) return;
      
      recordedChunks = [];
      mediaRecorder.start(250); // Capture in 250ms chunks for streaming
      isRecording = true;
      micButton.classList.add('active');
      micStatus.textContent = 'Listening...';
    }

    function stopRecording() {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
      
      mediaRecorder.stop();
      isRecording = false;
      micButton.classList.remove('active');
      micStatus.textContent = 'Click microphone to speak';
    }

    function stopMicrophone() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
      }
      
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
      }
      
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      
      mediaRecorder = null;
    }

    function toggleMicrophone() {
      if (isRecording) {
        stopRecording();
      } else {
        if (!mediaRecorder) {
          initMicrophone().then(success => {
            if (success) startRecording();
          });
        } else {
          startRecording();
        }
      }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    micButton.addEventListener('click', toggleMicrophone);

    // Initialize microphone on page load
    initMicrophone();

    function addMessage(text, sender) {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message', `${sender}-message`);
      messageElement.textContent = text;
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Clean up on popup close
    window.addEventListener('beforeunload', () => {
      stopMicrophone();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });
  }
});
