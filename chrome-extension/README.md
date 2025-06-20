# YouTube AI Speaker Chrome Extension

This Chrome extension allows you to have real-time conversations with YouTube video speakers using AI voice cloning technology powered by ElevenLabs.

## Features

- Automatically extracts audio from YouTube videos
- Transcribes speech using ElevenLabs speech-to-text
- Clones the speaker's voice for realistic responses
- Creates an AI agent that can answer questions about the video content
- Provides a clean overlay UI for conversations directly on YouTube

## Installation Instructions

Since this is a development version, you'll need to load the extension in Chrome's developer mode:

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the `chrome-extension` folder from this project
4. The extension should now appear in your extensions list and in the toolbar

## Usage

1. Make sure the backend server is running on http://localhost:3001
2. Navigate to any YouTube video
3. Click the extension icon in the toolbar to open the popup
4. Click "Prepare Video" to start processing (transcription, voice cloning, agent creation)
5. Once processing is complete, click the speaker icon in the YouTube player controls
6. Start asking questions in the conversation overlay!

## Configuration

You can change the backend API URL in the extension popup settings if your server is running on a different port or host.

## Troubleshooting

- If the extension doesn't appear on YouTube, try refreshing the page
- If preparation fails, check that the backend server is running and accessible
- For voice cloning issues, ensure the video has clear speech audio
- WebSocket connection issues may require restarting the backend server

## Development

To modify the extension:

1. Edit the files in the `chrome-extension` folder
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Reload any YouTube pages where you want to test the extension

## Backend Requirements

This extension requires the YouTube AI Speaker backend server to be running. The backend handles:

- Audio extraction from YouTube videos
- Transcription via ElevenLabs API
- Voice cloning via ElevenLabs API
- Agent creation for conversational AI
- WebSocket streaming for real-time conversations
