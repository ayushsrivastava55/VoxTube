// Content script for YouTube AI Speaker extension
// Runs on YouTube video pages and adds conversation UI

// Global variables
let apiBaseUrl = 'http://localhost:3001';
let videoId = null;
let videoTitle = null;
let channelName = null;
let conversationOverlay = null;
let websocket = null;
let prepared = false;
let voiceCloned = false;
let agentCreated = false;

// Initialize when the page loads
function initialize() {
  // Extract video ID from URL
  const url = window.location.href;
  const urlParams = new URLSearchParams(window.location.search);
  videoId = urlParams.get('v');
  
  if (!videoId) {
    console.log('Not a YouTube video page');
    return;
  }
  
  console.log('YouTube AI Speaker initialized for video:', videoId);
  
  // Get video details
  videoTitle = document.title.replace(' - YouTube', '');
  const channelElement = document.querySelector('ytd-video-owner-renderer #channel-name a');
  channelName = channelElement ? channelElement.textContent.trim() : 'Unknown Speaker';
  
  // Add conversation button to YouTube player
  addConversationButton();
  
  // Get API URL from background script
  chrome.runtime.sendMessage({ type: 'GET_API_URL' }, (response) => {
    if (response && response.apiBaseUrl) {
      apiBaseUrl = response.apiBaseUrl;
    }
  });
}

// Add conversation button to YouTube player
function addConversationButton() {
  // Wait for YouTube player controls to load
  const checkForControls = setInterval(() => {
    const rightControls = document.querySelector('.ytp-right-controls');
    if (rightControls) {
      clearInterval(checkForControls);
      
      // Create button
      const button = document.createElement('button');
      button.className = 'ytp-button ai-speaker-button';
      button.title = 'Talk to Speaker';
      button.innerHTML = `
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <path d="M18,10 C21.866,10 25,13.134 25,17 C25,20.866 21.866,24 18,24 C14.134,24 11,20.866 11,17 C11,13.134 14.134,10 18,10 Z M18,13 C15.791,13 14,14.791 14,17 C14,19.209 15.791,21 18,21 C20.209,21 22,19.209 22,17 C22,14.791 20.209,13 18,13 Z" fill="#fff"></path>
        </svg>
      `;
      
      // Add click event
      button.addEventListener('click', toggleConversationOverlay);
      
      // Add to player
      rightControls.prepend(button);
    }
  }, 1000);
}

// Toggle conversation overlay
function toggleConversationOverlay() {
  if (conversationOverlay) {
    // Remove existing overlay
    conversationOverlay.remove();
    conversationOverlay = null;
    
    // Close WebSocket if open
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    }
  } else {
    // Pause the video
    const video = document.querySelector('video');
    if (video) {
      video.pause();
    }
    
    // Create new overlay
    createConversationOverlay();
    
    // Start preparation if not already done
    if (!prepared) {
      prepareVideo();
    }
  }
}

// Create conversation overlay
function createConversationOverlay() {
  // Create overlay container
  conversationOverlay = document.createElement('div');
  conversationOverlay.className = 'yt-ai-speaker-overlay';
  
  // Create overlay content
  conversationOverlay.innerHTML = `
    <div class="yt-ai-speaker-header">
      <h3 class="yt-ai-speaker-title">Talk to ${channelName}</h3>
      <button class="yt-ai-speaker-close">&times;</button>
    </div>
    <div id="preparation-status" class="status-box">
      <div class="status-item">
        <span class="status-label">Transcription:</span>
        <span id="transcription-status" class="status-value ${prepared ? 'success' : 'in-progress'}">${prepared ? 'Complete' : 'In Progress...'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Voice Cloning:</span>
        <span id="voice-status" class="status-value ${voiceCloned ? 'success' : 'in-progress'}">${voiceCloned ? 'Complete' : 'Waiting...'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Agent Creation:</span>
        <span id="agent-status" class="status-value ${agentCreated ? 'success' : 'in-progress'}">${agentCreated ? 'Complete' : 'Waiting...'}</span>
      </div>
    </div>
    <div class="yt-ai-speaker-conversation" id="conversation"></div>
    <div class="yt-ai-speaker-input">
      <input type="text" id="question-input" placeholder="Ask a question..." ${agentCreated ? '' : 'disabled'}>
      <button id="send-button" ${agentCreated ? '' : 'disabled'}>Send</button>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(conversationOverlay);
  
  // Add event listeners
  document.querySelector('.yt-ai-speaker-close').addEventListener('click', toggleConversationOverlay);
  document.getElementById('send-button').addEventListener('click', sendQuestion);
  document.getElementById('question-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendQuestion();
    }
  });
}

// Prepare video (transcription)
function prepareVideo() {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Update status
  document.getElementById('transcription-status').textContent = 'In Progress...';
  document.getElementById('transcription-status').className = 'status-value in-progress';
  
  // Send message to background script
  chrome.runtime.sendMessage(
    { type: 'PREPARE_VIDEO', videoId, videoUrl },
    (response) => {
      if (response && response.success) {
        console.log('Video prepared successfully');
        prepared = true;
        
        // Update status
        document.getElementById('transcription-status').textContent = 'Complete';
        document.getElementById('transcription-status').className = 'status-value success';
        
        // Start voice cloning
        cloneVoice();
      } else {
        console.error('Failed to prepare video:', response?.error);
        
        // Update status
        document.getElementById('transcription-status').textContent = 'Failed';
        document.getElementById('transcription-status').className = 'status-value error';
      }
    }
  );
}

// Clone voice
function cloneVoice() {
  // Update status
  document.getElementById('voice-status').textContent = 'In Progress...';
  document.getElementById('voice-status').className = 'status-value in-progress';
  
  // Send message to background script
  chrome.runtime.sendMessage(
    { type: 'CLONE_VOICE', videoId, speakerName: channelName },
    (response) => {
      if (response && response.success) {
        console.log('Voice cloned successfully');
        voiceCloned = true;
        
        // Update status
        document.getElementById('voice-status').textContent = 'Complete';
        document.getElementById('voice-status').className = 'status-value success';
        
        // Create agent
        createAgent();
      } else {
        console.error('Failed to clone voice:', response?.error);
        
        // Update status
        document.getElementById('voice-status').textContent = 'Failed';
        document.getElementById('voice-status').className = 'status-value error';
      }
    }
  );
}

// Create agent
function createAgent() {
  // Update status
  document.getElementById('agent-status').textContent = 'In Progress...';
  document.getElementById('agent-status').className = 'status-value in-progress';
  
  // Send message to background script
  chrome.runtime.sendMessage(
    { type: 'CREATE_AGENT', videoId, speakerName: channelName },
    (response) => {
      if (response && response.success) {
        console.log('Agent created successfully');
        agentCreated = true;
        
        // Update status
        document.getElementById('agent-status').textContent = 'Complete';
        document.getElementById('agent-status').className = 'status-value success';
        
        // Enable input
        document.getElementById('question-input').disabled = false;
        document.getElementById('send-button').disabled = false;
        
        // Add initial message
        addMessage('AI', `Hi there! I'm ${channelName}. What would you like to ask me about this video?`);
        
        // Get streaming URL
        getStreamingUrl();
      } else {
        console.error('Failed to create agent:', response?.error);
        
        // Update status
        document.getElementById('agent-status').textContent = 'Failed';
        document.getElementById('agent-status').className = 'status-value error';
      }
    }
  );
}

// Get streaming URL
function getStreamingUrl() {
  chrome.runtime.sendMessage(
    { type: 'GET_STREAMING_URL', videoId },
    (response) => {
      if (response && response.success && response.data.websocket_url) {
        console.log('Got streaming URL:', response.data.websocket_url);
        connectWebSocket(response.data.websocket_url);
      } else {
        console.error('Failed to get streaming URL:', response?.error);
      }
    }
  );
}

// Connect to WebSocket
function connectWebSocket(url) {
  websocket = new WebSocket(url);
  
  websocket.onopen = () => {
    console.log('WebSocket connected');
  };
  
  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Update conversation with streaming text
    if (data.text) {
      updateAIMessage(data.text);
    }
    
    // Play streaming audio
    if (data.audio) {
      playAudioChunk(data.audio);
    }
  };
  
  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  websocket.onclose = () => {
    console.log('WebSocket closed');
  };
}

// Send question to agent
function sendQuestion() {
  const input = document.getElementById('question-input');
  const question = input.value.trim();
  
  if (!question) return;
  
  // Clear input
  input.value = '';
  
  // Add question to conversation
  addMessage('You', question);
  
  // Add empty AI message (will be updated with streaming response)
  addMessage('AI', '...');
  
  // Send to WebSocket if connected
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify({ text: question }));
  } else {
    console.error('WebSocket not connected');
  }
}

// Add message to conversation
function addMessage(sender, text) {
  const conversation = document.getElementById('conversation');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'yt-ai-speaker-message';
  
  if (sender === 'AI') {
    messageDiv.innerHTML = `<strong class="yt-ai-speaker-ai">${channelName}:</strong> <span class="ai-response">${text}</span>`;
  } else {
    messageDiv.innerHTML = `<strong class="yt-ai-speaker-user">${sender}:</strong> ${text}`;
  }
  
  conversation.appendChild(messageDiv);
  conversation.scrollTop = conversation.scrollHeight;
}

// Update the last AI message with streaming text
function updateAIMessage(text) {
  const conversation = document.getElementById('conversation');
  const messages = conversation.querySelectorAll('.yt-ai-speaker-message');
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage && lastMessage.querySelector('.ai-response')) {
    lastMessage.querySelector('.ai-response').textContent = text;
    conversation.scrollTop = conversation.scrollHeight;
  }
}

// Play audio chunk
function playAudioChunk(audioBase64) {
  const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
  audio.play();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initialize);

// Re-initialize when YouTube's SPA navigation occurs
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(initialize, 1500); // Wait for YouTube to load the new page
  }
}).observe(document, { subtree: true, childList: true });

// Initialize immediately for the current page
initialize();
