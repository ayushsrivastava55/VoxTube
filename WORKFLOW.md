# VoxTube Workflow Documentation

## 🔄 Complete User Journey

### Phase 1: Video Preparation
```
┌─────────────────────────────────────────────────────────────────┐
│                        VIDEO PREPARATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User opens YouTube video                                    │
│     ↓                                                           │
│  2. User clicks Chrome extension icon                          │
│     ↓                                                           │
│  3. Extension shows "Prepare Video" button                     │
│     ↓                                                           │
│  4. User clicks "Prepare Video"                                │
│     ↓                                                           │
│  5. Extension sends POST /api/prepare-context                  │
│     ↓                                                           │
│  6. Backend processes video:                                   │
│     • Extract video ID from URL                                │
│     • Check if already processed (cache)                       │
│     • Download audio with yt-dlp                               │
│     • Convert to WAV with ffmpeg                               │
│     • Extract 2-minute voice sample                            │
│     • Transcribe with ElevenLabs STT                          │
│     • Store results in memory                                  │
│     ↓                                                           │
│  7. Return success response with voice sample URL              │
│     ↓                                                           │
│  8. Extension shows "Ready for conversation"                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Voice Cloning
```
┌─────────────────────────────────────────────────────────────────┐
│                         VOICE CLONING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User clicks "Clone Voice" button                           │
│     ↓                                                           │
│  2. Extension sends POST /api/clone-voice                      │
│     ↓                                                           │
│  3. Backend processes voice cloning:                           │
│     • Check if voice already cloned (cache)                    │
│     • Retrieve voice sample from memory                        │
│     • Upload to ElevenLabs Instant Voice Cloning               │
│     • Process voice cloning (30-60 seconds)                    │
│     • Store voice ID in memory                                 │
│     ↓                                                           │
│  4. Return voice ID to extension                               │
│     ↓                                                           │
│  5. Extension shows "Voice cloned successfully"                │
│     ↓                                                           │
│  6. Speaker icon appears in YouTube player                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Conversation
```
┌─────────────────────────────────────────────────────────────────┐
│                        CONVERSATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User pauses video at specific timestamp                    │
│     ↓                                                           │
│  2. User clicks speaker icon in player                         │
│     ↓                                                           │
│  3. Extension opens conversation overlay                       │
│     ↓                                                           │
│  4. User asks question about video content                     │
│     ↓                                                           │
│  5. Extension processes question:                              │
│     • Get context window for paused timestamp                  │
│     • Create ElevenLabs agent with cloned voice                │
│     • Stream conversation with AI                              │
│     • Generate response in speaker's voice                     │
│     ↓                                                           │
│  6. Play AI response in browser                                │
│     ↓                                                           │
│  7. Continue conversation or close overlay                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Technical Implementation Details

### API Request/Response Flow

#### 1. Prepare Context Endpoint
```typescript
// Request
POST /api/prepare-context
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID"
}

// Response
{
  "videoId": "VIDEO_ID",
  "transcriptReady": true,
  "voiceSampleUrl": "http://localhost:3001/audio/sample.wav"
}
```

**Processing Steps:**
1. **Validation**: Check video URL format
2. **Cache Check**: Look for existing processed data
3. **Audio Download**: Use yt-dlp to download audio
4. **Voice Sample**: Extract 2-minute sample with ffmpeg
5. **Transcription**: Convert to text with ElevenLabs STT
6. **Storage**: Cache results in memory
7. **Response**: Return ready status and sample URL

#### 2. Clone Voice Endpoint
```typescript
// Request
POST /api/clone-voice
{
  "videoId": "VIDEO_ID",
  "speakerName": "Speaker Name",
  "sampleUrl": "http://localhost:3001/audio/sample.wav"
}

// Response
{
  "videoId": "VIDEO_ID",
  "voiceId": "elevenlabs_voice_id",
  "message": "Voice cloned successfully."
}
```

**Processing Steps:**
1. **Validation**: Check required fields
2. **Cache Check**: Look for existing voice ID
3. **File Access**: Get local voice sample path
4. **Voice Cloning**: Upload to ElevenLabs IVC
5. **Storage**: Store voice ID in memory
6. **Response**: Return voice ID

#### 3. Get Context Window Endpoint
```typescript
// Request
POST /api/get-context-window
{
  "videoId": "VIDEO_ID",
  "pausedTime": 622
}

// Response
{
  "contextWindow": "Relevant transcript text from the last 60 seconds..."
}
```

**Processing Steps:**
1. **Validation**: Check video ID and timestamp
2. **Cache Check**: Look for pre-computed context
3. **Transcript Retrieval**: Get full transcript from memory
4. **Context Extraction**: Filter relevant segments
5. **Cache Storage**: Store for future use
6. **Response**: Return context window

#### 4. Build Conversation Endpoint
```typescript
// Request
POST /api/build-conversation
{
  "videoId": "VIDEO_ID",
  "voiceId": "elevenlabs_voice_id",
  "speakerName": "Speaker Name",
  "contextWindow": "Recent transcript context...",
  "userQuestionText": "What did you mean by that?"
}

// Response
{
  "conversation": {
    "voice_id": "elevenlabs_voice_id",
    "model_id": "eleven_conversational_v2",
    "messages": [...],
    "audio_config": {...}
  }
}
```

**Processing Steps:**
1. **Validation**: Check all required fields
2. **Rate Limiting**: Check question count per video
3. **Agent Creation**: Create ElevenLabs agent
4. **Conversation Setup**: Build conversation config
5. **Response**: Return conversation configuration

## 📊 Data Flow Diagrams

### Video Processing Data Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ YouTube URL │───►│ Video ID    │───►│ Audio       │───►│ Voice       │
│             │    │ Extraction  │    │ Download    │    │ Sample      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                              │
                                                              ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Memory      │◄───│ Transcript  │◄───│ ElevenLabs  │◄───│ Audio       │
│ Cache       │    │ Storage     │    │ STT API     │    │ File        │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Voice Cloning Data Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Voice       │───►│ ElevenLabs  │───►│ Voice       │───►│ Memory      │
│ Sample      │    │ IVC API     │    │ ID          │    │ Storage     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Conversation Data Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ User        │───►│ Context     │───►│ ElevenLabs  │───►│ AI          │
│ Question    │    │ Window      │    │ Agent       │    │ Response    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                              │
                                                              ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Memory      │◄───│ Voice       │◄───│ ElevenLabs  │◄───│ Audio       │
│ Update      │    │ Generation  │    │ TTS API     │    │ Output      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## ⏱️ Timeline Estimates

### Processing Times
- **Small Video** (< 5 minutes): 30-60 seconds
- **Medium Video** (5-15 minutes): 1-3 minutes
- **Large Video** (> 15 minutes): 3-5 minutes

### API Response Times
- **Prepare Context**: 1-5 minutes (depends on video length)
- **Clone Voice**: 30-60 seconds
- **Get Context Window**: < 1 second (cached)
- **Build Conversation**: 2-5 seconds
- **Speak**: 1-3 seconds

### Memory Usage
- **Video Data**: ~10-50MB per video
- **Voice Samples**: ~2-5MB per video
- **Transcripts**: ~1-10KB per video
- **Context Cache**: ~1-5KB per timestamp

## 🔄 Error Handling

### Common Error Scenarios
1. **Video Download Failure**: Network issues, invalid URL
2. **Transcription Timeout**: Large files, API limits
3. **Voice Cloning Failure**: Poor audio quality, API limits
4. **Memory Exhaustion**: Too many videos cached
5. **Rate Limiting**: Too many requests

### Recovery Strategies
- **Retry Logic**: Automatic retries for transient failures
- **Fallback Options**: Use cached data when available
- **Graceful Degradation**: Continue with partial data
- **User Feedback**: Clear error messages and suggestions
- **Cleanup**: Automatic cleanup of failed operations

## 🎯 Success Metrics

### Performance Metrics
- **Processing Success Rate**: > 95%
- **Average Response Time**: < 2 minutes
- **Cache Hit Rate**: > 80%
- **Error Rate**: < 5%

### User Experience Metrics
- **Voice Cloning Success**: > 90%
- **Conversation Quality**: User satisfaction
- **Response Accuracy**: Context relevance
- **System Reliability**: Uptime > 99%

This workflow documentation provides a comprehensive understanding of how VoxTube processes videos, clones voices, and enables real-time conversations with YouTube speakers. 