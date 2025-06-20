export interface Video {
  videoId: string;
  title?: string;
  duration?: number;
  // transcript?: TranscriptSegment[]; // This seems to be part of VideoData now
  voiceId?: string; // This is also part of VideoData
  agentId?: string; // This is also part of VideoData
  speakerName?: string;
  // voiceSampleUrl?: string; // This is part of VideoData
  createdAt: Date;
}

// This interface is specifically for the data managed by MemoryService for a videoId
// Represents the core data associated with a video's processing state in MemoryService
export interface VideoData {
  transcript?: TranscriptSegment[]; // Made optional to allow partial updates
  voiceSampleUrl?: string;   // Full URL to the voice sample (for client/external use) - also optional for partial updates
  voiceSamplePath?: string;  // Local file system path to the voice sample (for internal server use)
  voiceId?: string;          // Cloned voice ID from ElevenLabs
  agentId?: string;          // ElevenLabs agent ID
  speakerName?: string;      // Speaker name used for cloning/agent creation
  questionCount?: number;    // Number of questions asked for this video
  createdAt: Date;           // Added back for cache cleanup logic
  // videoId itself is the key in MemoryService, not part of the value object typically
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface PrepareContextRequest {
  videoUrl: string;
}

export interface PrepareContextResponse {
  videoId: string;
  transcriptReady: boolean;
  voiceSampleUrl: string; // Full URL to the voice sample
}

export interface CloneVoiceRequest {
  videoId: string;
  speakerName: string;
  sampleUrl: string; // Full URL to the voice sample, validated by Zod
}

export interface CloneVoiceResponse {
  videoId: string; // Ensure videoId is part of the response
  voiceId: string;
  message?: string;
}

export interface GetContextWindowRequest {
  videoId: string;
  pausedTime: number;
}

export interface GetContextWindowResponse {
  contextWindow: string;
}

export interface BuildConversationRequest {
  videoId: string;
  voiceId: string;
  speakerName: string;
  contextWindow: string;
  userQuestionText: string;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  text: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface AgentConfig {
  conversation_config: {
    voice_id: string;
    model_id: string;
    system_prompt: string;
    initial_message?: string;
    llm_config?: {
      provider: string;
      model_id: string;
    };
  };
  platform_settings?: {
    voice_settings?: VoiceSettings;
    requires_auth?: boolean;
    auth_config?: {
      type: string;
      allowed_users?: string[];
    };
  };
  name?: string;
  tags?: string[];
}

export interface ConversationConfig {
  voice_id: string;
  model_id: string;
  messages: ConversationMessage[];
  audio_config: {
    voice_settings: VoiceSettings;
  };
  dynamic_variables?: Record<string, string | number | boolean>;
}

export interface BuildConversationResponse {
  conversation: ConversationConfig;
}

export interface CreateAgentResponse {
  agent_id: string;
}

export interface StreamConversationRequest {
  text: string;
  conversation_id?: string;
  dynamic_variables?: Record<string, string | number | boolean>;
}

export interface StreamConversationResponse {
  conversation_id: string;
  text: string;
  audio_url?: string;
}

export interface SpeakRequest {
  voiceId: string;
  text: string;
}

export interface SpeakResponse {
  audioUrl: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}