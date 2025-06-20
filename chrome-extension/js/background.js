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
    // Call the backend API to prepare the video
    // Orchestrate the full preparation sequence: prepare -> clone -> create agent
    prepareVideo(request.videoId, request.videoUrl)
      .then(prepareData => {
        console.log('Background: Step 1 (prepareVideo) successful. Data:', JSON.stringify(prepareData, null, 2));
        if (!prepareData.voiceSampleUrl) {
          console.error('Background: voiceSampleUrl is missing from prepare-context response.');
          throw new Error('Failed to get voice sample URL from prepare step.');
        }
        const speakerName = `Speaker for ${prepareData.videoId}`; // Default speaker name

        // Step 2: Clone Voice, passing the voiceSampleUrl
        return cloneVoice(prepareData.videoId, speakerName, prepareData.voiceSampleUrl)
          .then(cloneData => {
            console.log('Background: Step 2 (cloneVoice) successful. Data:', JSON.stringify(cloneData, null, 2));
            if (!cloneData || !cloneData.voiceId) { // Assuming cloneData contains voiceId upon success
              console.error('Background: voiceId is missing from clone-voice response.');
              throw new Error('Failed to get voice ID from clone step.');
            }
            
            // Step 3: Create Agent
            // Note: createAgent in background.js currently only takes videoId and speakerName.
            // The backend /api/create-agent uses memoryService to get voiceId and contextWindow.
            // This should be fine if cloneData.voiceId was successfully stored by the backend.
            return createAgent(prepareData.videoId, speakerName)
              .then(agentData => {
                console.log('Background: Step 3 (createAgent) successful. Data:', JSON.stringify(agentData, null, 2));
                
                // Step 4: Get Streaming URL
                return getStreamingUrl(prepareData.videoId)
                  .then(streamingData => {
                    console.log('Background: Step 4 (getStreamingUrl) successful. Data:', JSON.stringify(streamingData, null, 2));
                    
                    // Send a consolidated success response with all data
                    sendResponse({ 
                      success: true, 
                      data: { 
                        message: 'Video preparation, voice cloning, agent creation, and streaming URL retrieval successful.',
                        prepareData,
                        cloneData, 
                        agentData,
                        streamingData // Contains websocket_url
                      }
                    });
                  });
              });
          });
      })
      .catch(error => {
        console.error('Background: Error in PREPARE_VIDEO sequence:', error.message, error.stack);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
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
    getStreamingUrl(request.videoId)
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
async function prepareVideo(videoId, videoUrl) {
  const response = await fetch(`${apiBaseUrl}/api/prepare-context`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, videoUrl })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to prepare video: ${error}`);
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

async function createAgent(videoId, speakerName) {
  const response = await fetch(`${apiBaseUrl}/api/create-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, speakerName })
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
