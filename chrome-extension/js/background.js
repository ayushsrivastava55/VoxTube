// Background script for YouTube AI Speaker extension
// Handles communication between content script and backend API

// Store API settings
let apiBaseUrl = 'http://localhost:3001';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  if (request.type === 'GET_API_URL') {
    // Return the current API URL
    sendResponse({ apiBaseUrl });
    return true;
  }
  
  if (request.type === 'SET_API_URL') {
    // Update the API URL
    apiBaseUrl = request.apiBaseUrl;
    chrome.storage.local.set({ apiBaseUrl });
    sendResponse({ success: true });
    return true;
  }
  
  if (request.type === 'PREPARE_VIDEO') {
  console.log('Background: Received PREPARE_VIDEO, initiating new async flow.');

  // Fire both requests in parallel
  const preparePromise = prepareFullVideo(request.videoId, request.videoUrl);
  const instantContextPromise = getInstantContext(request.videoId, request.videoUrl);

  // Fast response path
  instantContextPromise
    .then(instantData => {
      console.log('Background: "Fast Lane" (/instant-context) successful. Data:', instantData);
      sendResponse({ success: true, data: instantData });
    })
    .catch(error => {
      console.error('Background: Error in "Fast Lane" (/instant-context):', error.message);
      sendResponse({ success: false, error: error.message });
    });

  // Fire and forget the slow job
  preparePromise
    .then(jobData => {
      console.log('Background: "Slow Lane" (/prepare-context) job dispatched successfully. Job ID:', jobData.jobId);
    })
    .catch(error => {
      console.error('Background: Failed to dispatch "Slow Lane" job:', error.message);
    });

  return true; // keep the message channel open
}

  
  if (request.type === 'CLONE_VOICE') {
    // Call the backend API to clone the voice
    cloneVoice(request.videoId, request.speakerName)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'CREATE_AGENT') {
    // Call the backend API to create an agent
    createAgent(request.videoId, request.speakerName)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.type === 'GET_STREAMING_URL') {
    // Call the backend API to get the streaming URL
    getStreamingUrl(request.agentId)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Load stored API URL on startup
chrome.storage.local.get(['apiBaseUrl'], (result) => {
  if (result.apiBaseUrl) {
    apiBaseUrl = result.apiBaseUrl;
  }
});

// API functions
async function prepareFullVideo(videoId, videoUrl) {
  const response = await fetch(`${apiBaseUrl}/api/prepare-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, videoUrl })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to start background job: ${error.details || error.error}`);
  }
  return await response.json();
}

async function getInstantContext(videoId, videoUrl) {
  const speakerName = `Speaker for ${videoId}`;
  const pausedTime = 150; // or get from content script later

  const response = await fetch(`${apiBaseUrl}/api/instant-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, videoUrl, pausedTime, speakerName })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to get instant context: ${error.details || error.error}`);
  }
  return await response.json();
}


async function cloneVoice(videoId, speakerName, sampleUrl) { // Added sampleUrl parameter
  console.log(`Background: cloneVoice function called with videoId: ${videoId}, speakerName: ${speakerName}, sampleUrl: ${sampleUrl}`);
  if (!sampleUrl) {
    console.error('Background: cloneVoice called without a sampleUrl! This is a critical issue.');
    throw new Error('sampleUrl is required for cloning voice and was not provided to the cloneVoice function.');
  }
  const response = await fetch(`${apiBaseUrl}/api/clone-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, speakerName, sampleUrl }) // Added sampleUrl to request body
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to clone voice: ${error}`);
  }
  
  return await response.json();
}

// Add this helper function
async function getContextWindow(videoId, pausedTime) {
  const response = await fetch(`${apiBaseUrl}/api/get-context-window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, pausedTime })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get context window: ${error}`);
  }
  return await response.json();
}

// Update createAgent to accept all required fields
async function createAgent(videoId, speakerName, voiceId, contextWindow) {
  const response = await fetch(`${apiBaseUrl}/api/create-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, speakerName, voiceId, contextWindow })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create agent: ${error}`);
  }
  return await response.json();
}

async function getStreamingUrl(videoId) {
  const response = await fetch(`${apiBaseUrl}/api/streaming-url/${videoId}`);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get streaming URL: ${error}`);
  }
  
  return await response.json();
}
