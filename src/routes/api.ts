import { Router } from 'express';
import { z } from 'zod';
import { YouTubeService } from '../services/youtube.js';
import { TranscriptionService } from '../services/transcription.js';
import { ElevenLabsService } from '../services/elevenlabs.js';
import { memoryService } from '../services/memory.js';
import { config } from '../config/index.js';
import {
  PrepareContextRequest,
  PrepareContextResponse,
  CloneVoiceRequest,
  CloneVoiceResponse,
  GetContextWindowRequest,
  GetContextWindowResponse,
  BuildConversationRequest,
  BuildConversationResponse,
  SpeakRequest,
  ApiError
} from '../types/index.js';

const router = Router();
const youtubeService = new YouTubeService();
const transcriptionService = new TranscriptionService();
const elevenLabsService = new ElevenLabsService();

// Validation schemas
const prepareContextSchema = z.object({
  videoUrl: z.string().url('Invalid video URL')
});

const cloneVoiceSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  speakerName: z.string().min(1, 'Speaker name is required'),
  sampleUrl: z.string().url('Invalid sample URL')
});

const getContextWindowSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  pausedTime: z.number().min(0, 'Paused time must be non-negative')
});

const buildConversationSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  voiceId: z.string().min(1, 'Voice ID is required'),
  speakerName: z.string().min(1, 'Speaker name is required'),
  contextWindow: z.string().min(1, 'Context window is required'),
  userQuestionText: z.string().min(1, 'User question is required')
});

const speakSchema = z.object({
  voiceId: z.string().min(1, 'Voice ID is required'),
  text: z.string().min(1, 'Text is required')
});

const streamConversationSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  text: z.string().min(1, 'Text is required')
});

// Helper function for error responses
const sendError = (res: any, status: number, message: string, details?: any): void => {
  const error: ApiError = { error: message, details };
  res.status(status).json(error);
};

// POST /prepare-context
router.post('/prepare-context', async (req, res) => {
  try {
    const validation = prepareContextSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid request data', validation.error.errors);
    }

    const { videoUrl }: PrepareContextRequest = validation.data;
    
    // Extract video ID
    const videoId = youtubeService.extractVideoId(videoUrl);
    if (!videoId) {
      return sendError(res, 400, 'Invalid YouTube URL');
    }

    // Check if already processed
    const existingData = memoryService.getVideoData(videoId);
    if (existingData?.transcript && existingData?.voiceSampleUrl) {
      let finalVoiceSampleUrl = existingData.voiceSampleUrl;
      // If the cached URL is relative (starts with '/'), convert it to a full URL
      if (finalVoiceSampleUrl.startsWith('/')) {
        finalVoiceSampleUrl = `${req.protocol}://${req.get('host')}${finalVoiceSampleUrl}`;
        console.info(`Converted cached relative voiceSampleUrl to full URL: ${finalVoiceSampleUrl} for videoId: ${videoId}`); // Use console.info
      }
      const response: PrepareContextResponse = {
        videoId,
        transcriptReady: true,
        voiceSampleUrl: finalVoiceSampleUrl
      };
      return res.json(response);
    }

    // Download audio
    const { audioPath } = await youtubeService.downloadAudio(videoUrl);
    
    // Extract voice sample
    const voiceSamplePath = await youtubeService.extractVoiceSample(audioPath);
    const voiceSampleRelativePath = `/audio/${voiceSamplePath.split('/').pop()}`;
    const voiceSampleFullUrl = `${req.protocol}://${req.get('host')}${voiceSampleRelativePath}`;
    
    // Transcribe audio
    const transcript = await transcriptionService.transcribeAudio(audioPath);
    
    // Store in memory
    const videoData = {
      transcript, 
      voiceSampleUrl: voiceSampleFullUrl, // Full URL for client and external access
      voiceSamplePath: voiceSamplePath    // Local path for internal file operations
    };
    console.info(`Data being saved to memory in prepare-context for videoId ${videoId}:`, JSON.stringify(videoData, null, 2));
    memoryService.setVideoData(videoId, videoData);
    console.info(`Context prepared for videoId: ${videoId}`);
    
    // Cleanup original audio file (keep sample)
    await youtubeService.cleanup(audioPath);

    const response: PrepareContextResponse = {
      videoId,
      transcriptReady: true,
      voiceSampleUrl: voiceSampleFullUrl
    };

    res.json(response);
  } catch (error) {
    console.error('Prepare context error:', error);
    sendError(res, 500, 'Failed to prepare video context', error instanceof Error ? error.message : 'Unknown error');
  }
});

// POST /clone-voice
router.post('/clone-voice', async (req, res) => {
  try {
    const validation = cloneVoiceSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid request data', validation.error.errors);
    }

    const { videoId, speakerName, sampleUrl }: CloneVoiceRequest = validation.data;
    // sampleUrl (the full HTTP URL) is validated by Zod but not directly used for file operations.

    // Check if voice already cloned
    const existingVoiceId = memoryService.getVoiceId(videoId);
    if (existingVoiceId) {
      const response: CloneVoiceResponse = {
        videoId,
        voiceId: existingVoiceId,
        message: 'Voice already cloned for this video.'
      };
      return res.json(response);
    }

    // Retrieve the local file path for the voice sample from memory
    const videoData = memoryService.getVideoData(videoId);
    const localVoiceSamplePath = videoData?.voiceSamplePath;

    if (!localVoiceSamplePath) {
      return sendError(res, 404, `Local voice sample path not found for video ${videoId}. Please prepare context again.`);
    }

    console.log(`Clone Voice: Using local sample path: ${localVoiceSamplePath} for videoId: ${videoId} (validated sampleUrl was: ${sampleUrl})`);

    // Call ElevenLabs service to clone voice using the local file path
    const voiceId = await elevenLabsService.cloneVoice(speakerName, localVoiceSamplePath);
    
    // Store in memory
    memoryService.setVoiceId(videoId, voiceId);
    memoryService.setVideoData(videoId, { voiceId, speakerName }); // Also update speakerName if provided

    const response: CloneVoiceResponse = { videoId, voiceId, message: 'Voice cloned successfully.' };
    res.json(response);
  } catch (error) {
    console.error('Clone voice error:', error);
    sendError(res, 500, 'Failed to clone voice', error instanceof Error ? error.message : 'Unknown error');
  }
});

// POST /get-context-window
router.post('/get-context-window', async (req, res) => {
  try {
    const validation = getContextWindowSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid request data', validation.error.errors);
    }

    const { videoId, pausedTime }: GetContextWindowRequest = validation.data;
    
    // Check cache first
    const cached = memoryService.getCachedContextWindow(videoId, pausedTime);
    if (cached) {
      const response: GetContextWindowResponse = { contextWindow: cached };
      return res.json(response);
    }

    // Get transcript
    const transcript = memoryService.getTranscript(videoId);
    if (!transcript) {
      return sendError(res, 404, 'Video transcript not found');
    }

    // Extract context window
    const contextWindow = transcriptionService.getContextWindow(
      transcript, 
      pausedTime, 
      config.MAX_CONTEXT_WINDOW_SECONDS
    );

    // Cache for future use
    memoryService.cacheContextWindow(videoId, pausedTime, contextWindow);

    const response: GetContextWindowResponse = { contextWindow };
    res.json(response);
  } catch (error) {
    console.error('Get context window error:', error);
    sendError(res, 500, 'Failed to get context window', error instanceof Error ? error.message : 'Unknown error');
  }
});

// POST /build-conversation
router.post('/build-conversation', async (req, res) => {
  try {
    const validation = buildConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid request data', validation.error.errors);
    }

    const { videoId, voiceId, speakerName, contextWindow, userQuestionText }: BuildConversationRequest = validation.data;
    
    // Check question limit
    const questionCount = memoryService.getQuestionCount(videoId);
    if (questionCount >= config.MAX_QUESTIONS_PER_VIDEO) {
      return sendError(res, 429, `Maximum questions per video exceeded (${config.MAX_QUESTIONS_PER_VIDEO})`);
    }

    // Increment question count
    memoryService.incrementQuestionCount(videoId);

    // Build conversation config
    const conversation = elevenLabsService.buildConversationConfig(
      voiceId,
      speakerName,
      contextWindow,
      userQuestionText
    );

    const response: BuildConversationResponse = { conversation };
    res.json(response);
  } catch (error) {
    console.error('Build conversation error:', error);
    sendError(res, 500, 'Failed to build conversation', error instanceof Error ? error.message : 'Unknown error');
  }
});

// POST /create-agent
router.post('/create-agent', async (req, res) => {
  try {
    // Use the same validation schema as build-conversation but without userQuestionText
    const { videoId, speakerName } = req.body;

    if (!videoId || !speakerName) {
      return sendError(res, 400, 'Missing required parameters');
    }

    const videoData = memoryService.getVideoData(videoId);
    console.info(`Data retrieved from memory in create-agent for videoId ${videoId}:`, JSON.stringify(videoData, null, 2));

    if (!videoData) {
      console.error(`No videoData found in memory for videoId: ${videoId}. Prepare context first.`);
      return res.status(400).json({ error: 'Video data not found. Please prepare context first.' });
    }
    if (!videoData.transcript || videoData.transcript.length === 0) {
      const transcriptPreview = videoData.transcript && videoData.transcript.length > 0 ? videoData.transcript.slice(0, 2).map(seg => seg.text).join(' ') : 'N/A';
      console.error(`Transcript is missing or empty for videoId: ${videoId}. Transcript content (first few segments): '${transcriptPreview.substring(0,100)}...'`);
      return res.status(400).json({ error: 'Transcript is missing or empty. Please prepare context first.' });
    }

    // Check if we already have an agent for this video
    const existingAgentId = memoryService.getAgentId(videoId);
    if (existingAgentId) {
      return res.json({ agent_id: existingAgentId });
    }

    // Create a new agent
    const voiceId = memoryService.getVoiceId(videoId);
    if (!voiceId) {
      return sendError(res, 404, 'Voice not found. Please clone voice first.');
    }

    const contextWindow = await getContextWindowForVideo(videoId);
    if (!contextWindow) {
      return sendError(res, 404, 'Context window not found. Please prepare context first.');
    }

    // Create a new agent
    const agentId = await elevenLabsService.createAgent(speakerName, voiceId, contextWindow);
    memoryService.setAgentId(videoId, agentId);
    
    return res.json({ agent_id: agentId });
  } catch (error) {
    console.error('Create agent error:', error);
    sendError(res, 500, 'Failed to create agent', error instanceof Error ? error.message : 'Unknown error');
  }
});

// POST /stream-conversation
router.post('/stream-conversation', async (req, res) => {
  try {
    const validation = streamConversationSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid request data', validation.error.errors);
    }

    const { videoId, text } = validation.data;

    // Check question limit
    const questionCount = memoryService.getQuestionCount(videoId);
    if (questionCount >= config.MAX_QUESTIONS_PER_VIDEO) {
      return sendError(res, 429, `Maximum questions per video exceeded (${config.MAX_QUESTIONS_PER_VIDEO})`);
    }

    // Increment question count
    memoryService.incrementQuestionCount(videoId);

    const agentId = memoryService.getAgentId(videoId);
    if (!agentId) {
      return sendError(res, 404, 'Agent not found. Please create agent first.');
    }

    const response = await elevenLabsService.streamConversation(agentId, text);
    
    return res.json(response);
  } catch (error) {
    console.error('Stream conversation error:', error);
    sendError(res, 500, 'Failed to stream conversation', error instanceof Error ? error.message : 'Unknown error');
  }
});

// GET /streaming-url/:agentId
router.get('/streaming-url/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;

    if (!agentId) {
      return sendError(res, 400, 'Missing agent ID');
    }

    const wsUrl = elevenLabsService.getStreamingWebSocketUrl(agentId);
    
    return res.json({ url: wsUrl });
  } catch (error) {
    console.error('Get streaming URL error:', error);
    sendError(res, 500, 'Failed to get streaming URL', error instanceof Error ? error.message : 'Unknown error');
  }
});

// POST /speak (fallback TTS)
router.post('/speak', async (req, res) => {
  try {
    const validation = speakSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 400, 'Invalid request data', validation.error.errors);
    }

    const { voiceId, text }: SpeakRequest = validation.data;
    
    // Generate speech
    const audioBuffer = await elevenLabsService.generateSpeech(voiceId, text);
    
    // For now, return the audio data directly
    // In production, you might want to save to file and return URL
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString()
    });
    
    res.send(audioBuffer);
  } catch (error) {
    console.error('Speak error:', error);
    sendError(res, 500, 'Failed to generate speech', error instanceof Error ? error.message : 'Unknown error');
  }
});

// GET /health
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// Helper function to get context window for a video
async function getContextWindowForVideo(videoId: string): Promise<string | undefined> {
  // Check if we already have a context window cached
  const transcript = memoryService.getTranscript(videoId);
  if (!transcript) {
    return undefined;
  }
  
  // Use the middle of the video as a default timestamp
  const segments = transcript;
  if (segments.length === 0) {
    return '';
  }
  
  const middleTimestamp = segments[Math.floor(segments.length / 2)].start;
  
  // Extract context window
  return transcriptionService.getContextWindow(
    segments,
    middleTimestamp,
    config.MAX_CONTEXT_WINDOW_SECONDS
  );
}

export default router;