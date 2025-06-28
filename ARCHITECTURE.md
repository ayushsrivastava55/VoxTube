# VoxTube System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VoxTube System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Chrome    │    │   YouTube   │    │   User      │         │
│  │ Extension   │◄──►│   Video     │◄──►│ Interface   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Backend API Server                        │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │ │
│  │  │YouTube  │ │Transcr. │ │ElevenL. │ │ Memory  │           │ │
│  │  │Service  │ │Service  │ │Service  │ │Service  │           │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   yt-dlp    │    │ ElevenLabs  │    │ In-Memory   │         │
│  │ + ffmpeg    │    │    API      │    │   Cache     │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Core Workflow

### 1. Video Processing Pipeline
```
User pauses YouTube video
    ↓
Chrome Extension → Backend API
    ↓
YouTube Service downloads audio (yt-dlp + ffmpeg)
    ↓
Transcription Service converts to text (ElevenLabs STT)
    ↓
Memory Service caches results
    ↓
Return ready status to user
```

### 2. Voice Cloning Pipeline
```
User clicks "Clone Voice"
    ↓
Backend retrieves voice sample
    ↓
ElevenLabs Service clones voice (Instant Voice Cloning)
    ↓
Store voice ID in memory
    ↓
Return voice ID to client
```

### 3. Conversation Pipeline
```
User asks question
    ↓
Get context window from transcript
    ↓
Create ElevenLabs Agent with cloned voice
    ↓
Stream conversation with AI
    ↓
Return AI response in speaker's voice
```

## 🏛️ Component Architecture

### Backend Services

#### 1. YouTube Service
**Purpose**: Handle video downloading and audio processing
**Key Methods**:
- `downloadAudio(videoUrl)` - Download with yt-dlp
- `extractVoiceSample(audioPath)` - Extract 2-min sample with ffmpeg
- `extractVideoId(url)` - Parse YouTube URLs

**Dependencies**: yt-dlp, ffmpeg, file system

#### 2. Transcription Service
**Purpose**: Convert audio to text with timestamps
**Key Methods**:
- `transcribeAudio(audioPath)` - ElevenLabs STT API
- `getContextWindow(transcript, pausedTime)` - Extract relevant context
- `formatTranscript(apiResponse)` - Structure transcript data

**Dependencies**: ElevenLabs API, FormData, node-fetch

#### 3. ElevenLabs Service
**Purpose**: Handle all ElevenLabs AI operations
**Key Methods**:
- `cloneVoice(name, audioPath)` - Instant Voice Cloning
- `createAgent(speakerName, voiceId, context)` - Create AI agent
- `streamConversation(agentId, question)` - Real-time conversation
- `generateSpeech(voiceId, text)` - Text-to-speech

**Dependencies**: ElevenLabs APIs (Voice, TTS, Conversational AI)

#### 4. Memory Service
**Purpose**: Cache and manage application state
**Key Methods**:
- `setVideoData(videoId, data)` - Store video metadata
- `getVoiceId(videoId)` - Retrieve cloned voice ID
- `cacheContextWindow(videoId, pausedTime, context)` - Cache context
- `incrementQuestionCount(videoId)` - Track usage limits

**Dependencies**: In-memory storage (Map/Set), timers

### API Endpoints

```
POST /api/prepare-context     - Extract video transcript and voice sample
POST /api/clone-voice         - Clone speaker voice with ElevenLabs  
POST /api/get-context-window  - Get transcript context for timestamp
POST /api/build-conversation  - Build conversation config for AI
POST /api/speak              - Generate speech with cloned voice
GET  /api/health             - Service health check
```

## 🔧 Data Flow

### Video Processing Data Flow
```
YouTube URL → Video ID → Audio Download → Voice Sample → Transcript → Cache
     ↓           ↓           ↓              ↓            ↓         ↓
   Validation  Extraction  yt-dlp        ffmpeg      ElevenLabs  Memory
```

### Voice Cloning Data Flow
```
Voice Sample → ElevenLabs IVC → Voice ID → Memory Cache → Response
     ↓              ↓              ↓           ↓           ↓
   Audio File    API Upload    Processing   Storage    Client
```

### Conversation Data Flow
```
User Question → Context Window → Agent Creation → AI Response → Voice Generation
     ↓              ↓              ↓              ↓              ↓
   Input        Transcript      ElevenLabs    LLM Processing  TTS Output
```

## 🛡️ Security & Performance

### Security Features
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Zod schemas for all endpoints
- **CORS Protection**: Chrome extension origins only
- **Helmet Security**: Standard web security headers
- **Error Handling**: Secure error responses

### Performance Optimizations
- **In-Memory Caching**: Fast access to processed data
- **Context Window Caching**: Pre-computed context for timestamps
- **Optimized Audio**: 16kHz mono for faster processing
- **Request Timeouts**: 5-minute timeout for transcription
- **File Cleanup**: Automatic temporary file removal

## 📊 Configuration

### Environment Variables
```env
ELEVENLABS_API_KEY=your_api_key_here
PORT=3001
NODE_ENV=development
MAX_QUESTIONS_PER_VIDEO=25
CACHE_DURATION_HOURS=24
MAX_CONTEXT_WINDOW_SECONDS=60
FFMPEG_PATH=D:\Development\ffmpeg-7.1.1-essentials_build\bin\ffmpeg.exe
FFPROBE_PATH=D:\Development\ffmpeg-7.1.1-essentials_build\bin\ffprobe.exe
```

### Data Structures
```typescript
interface VideoData {
  transcript?: TranscriptSegment[];
  voiceSampleUrl?: string;
  voiceSamplePath?: string;
  voiceId?: string;
  agentId?: string;
  speakerName?: string;
  questionCount?: number;
  createdAt: Date;
}

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}
```

## 🚀 Deployment

### Development Environment
```
Chrome Extension (Local) ↔ Backend API (Local:3001) ↔ ElevenLabs API
```

### Production Considerations
- **Load Balancing**: Multiple backend instances
- **Redis Cache**: Replace in-memory with distributed cache
- **Database**: Persistent storage for transcripts
- **CDN**: Serve audio files from CDN
- **Monitoring**: Health checks and metrics

## 🔮 Future Enhancements

### Scalability
- **Microservices**: Split into separate services
- **Queue System**: Async processing for large videos
- **Database**: Persistent storage for metadata
- **CDN**: Optimize file delivery

### Features
- **Multi-speaker Support**: Handle multiple speakers per video
- **Voice Emotion Control**: Dynamic voice characteristics
- **Batch Processing**: Process multiple videos
- **Analytics Dashboard**: Usage insights

### Performance
- **Compression**: Optimize audio file sizes
- **Caching Strategy**: Multi-level caching
- **Load Balancing**: Distribute processing load
- **Monitoring**: Real-time performance metrics

This architecture provides a robust foundation for real-time AI-powered conversations with YouTube video speakers, leveraging ElevenLabs' comprehensive AI voice platform. 