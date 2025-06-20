# YouTube AI Speaker Conversation Backend

A comprehensive backend API that enables real-time voice conversations with YouTube video speakers using AI voice cloning and conversational AI.

## 🎯 Overview

This backend powers a Chrome extension that allows users to pause any YouTube video and have a voice conversation with the speaker using their cloned voice via ElevenLabs AI.

## ✨ Features

- **YouTube Audio Processing**: Extract and process audio from any YouTube video
- **Voice Cloning**: Clone speaker voices using ElevenLabs API
- **Smart Transcription**: Generate timestamped transcripts with speaker diarization
- **Context Management**: Intelligent context windowing for relevant conversations
- **Conversation AI**: Build and manage conversational AI interactions
- **Memory Management**: Efficient caching and state management
- **Rate Limiting**: Built-in protection against abuse
- **Production Ready**: Comprehensive error handling and logging

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- yt-dlp (for YouTube audio extraction)
- ffmpeg (for audio processing)
- ElevenLabs API key
- AssemblyAI API key

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Install system dependencies:**

**macOS:**
```bash
brew install yt-dlp ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install yt-dlp ffmpeg
```

**Windows:**
- Download yt-dlp from: https://github.com/yt-dlp/yt-dlp/releases
- Download ffmpeg from: https://ffmpeg.org/download.html
- Add both to your PATH

4. **Start the development server:**
```bash
npm run dev
```

The server will be running at `http://localhost:3001`

## 📋 API Endpoints

### `POST /api/prepare-context`
Extracts audio and transcript from a YouTube video.

**Request:**
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "videoId": "VIDEO_ID",
  "transcriptReady": true,
  "voiceSampleUrl": "http://localhost:3001/audio/sample.wav"
}
```

### `POST /api/clone-voice`
Clones the speaker's voice using ElevenLabs.

**Request:**
```json
{
  "videoId": "VIDEO_ID",
  "speakerName": "Speaker Name",
  "sampleUrl": "http://localhost:3001/audio/sample.wav"
}
```

**Response:**
```json
{
  "voiceId": "elevenlabs_voice_id"
}
```

### `POST /api/get-context-window`
Gets relevant transcript context for a specific timestamp.

**Request:**
```json
{
  "videoId": "VIDEO_ID",
  "pausedTime": 622
}
```

**Response:**
```json
{
  "contextWindow": "Relevant transcript text from the last 60 seconds..."
}
```

### `POST /api/build-conversation`
Builds a conversation configuration for ElevenLabs Conversational AI.

**Request:**
```json
{
  "videoId": "VIDEO_ID",
  "voiceId": "elevenlabs_voice_id",
  "speakerName": "Speaker Name",
  "contextWindow": "Recent transcript context...",
  "userQuestionText": "What did you mean by that?"
}
```

**Response:**
```json
{
  "conversation": {
    "voice_id": "elevenlabs_voice_id",
    "model_id": "eleven_conversational_v1",
    "messages": [...],
    "audio_config": {...}
  }
}
```

### `POST /api/speak`
Fallback text-to-speech using cloned voice.

**Request:**
```json
{
  "voiceId": "elevenlabs_voice_id",
  "text": "Response text to speak"
}
```

**Response:** Audio file (audio/mpeg)

## 🏗️ Architecture

```
src/
├── config/          # Environment configuration
├── services/        # Core business logic
│   ├── youtube.ts   # YouTube audio extraction
│   ├── transcription.ts # Speech-to-text processing
│   ├── elevenlabs.ts    # Voice cloning & TTS
│   └── memory.ts        # State management
├── routes/          # API route handlers
├── middleware/      # Express middleware
├── types/           # TypeScript definitions
└── server.ts        # Application entry point
```

## 🔧 Configuration

Key environment variables:

- `ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key  
- `MAX_QUESTIONS_PER_VIDEO`: Limit questions per video (default: 25)
- `CACHE_DURATION_HOURS`: How long to cache data (default: 24)
- `MAX_CONTEXT_WINDOW_SECONDS`: Context window size (default: 60)

## 🛡️ Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive request validation with Zod
- **Error Handling**: Secure error responses without sensitive data exposure
- **CORS Protection**: Configured for Chrome extension origins
- **Helmet Security**: Standard web security headers

## 📊 Memory Management

The service uses intelligent in-memory caching:

- **Video Data**: Stores transcripts, voice IDs, and metadata
- **Context Cache**: Pre-computed context windows for timestamps
- **Question Tracking**: Enforces per-video question limits
- **Auto Cleanup**: Removes stale data after 24 hours

## 🚀 Production Deployment

1. **Build the application:**
```bash
npm run build
```

2. **Set production environment:**
```bash
export NODE_ENV=production
```

3. **Start the server:**
```bash
npm start
```

## 🧪 Development

**Watch mode with auto-reload:**
```bash
npm run dev
```

**Linting:**
```bash
npm run lint
```

## 🤝 Integration

This backend is designed to work with a Chrome extension that:

1. Detects YouTube video pauses
2. Captures user voice input
3. Sends requests to this API
4. Plays AI responses in the browser

## 📄 License

Private - All rights reserved

## 🔗 Related Services

- [ElevenLabs API](https://elevenlabs.io/docs)
- [AssemblyAI API](https://www.assemblyai.com/docs)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)