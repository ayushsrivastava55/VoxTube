import fetch from 'node-fetch';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { config } from '../config/index.js';
import { ConversationConfig, AgentConfig, CreateAgentResponse, StreamConversationRequest, StreamConversationResponse } from '../types/index.js';

export class ElevenLabsService {
  private apiKey = config.ELEVENLABS_API_KEY;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  voice_id: string = '';
  conversation_id: string = '';
  agent_id: string = '';

  async cloneVoice(name: string, audioPath: string): Promise<string> {
    try {
      const form = new FormData();
      form.append('name', name);
      const fileStream = createReadStream(audioPath);
      const filename = audioPath.split('/').pop() || 'audio.mp3'; // Extract filename or use default
      form.append('files', fileStream, { filename }); // Try singular 'files' as field name
      form.append('description', `Cloned voice for ${name}`);

      // Using the Instant Voice Cloning (IVC) endpoint
      // Targeting /voices/add as per official IVC documentation screenshot and successful cURL to this endpoint
    const response = await fetch(`${this.baseUrl}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': form.getHeaders()['content-type'],
          // 'Content-Length': form.getHeaders()['content-length'], // Potentially add this if Content-Type alone doesn't resolve
        },
        body: form
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Voice cloning failed: ${error}`);
      }

      const data = await response.json() as { voice_id: string };
      this.voice_id = data.voice_id; // Store for later use
      return data.voice_id;
    } catch (error) {
      console.error('Voice cloning error:', error);
      throw new Error(`ElevenLabs voice cloning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSpeech(voiceId: string, text: string): Promise<Buffer> {
    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          // Update to the latest multilingual model
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.9,
            style: 0.0, // New parameter for expressiveness
            use_speaker_boost: true // Enhance voice quality
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Speech generation failed: ${error}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      console.error('Speech generation error:', error);
      throw new Error(`ElevenLabs TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  buildConversationConfig(
    voiceId: string,
    speakerName: string,
    contextWindow: string,
    userQuestion: string
  ): ConversationConfig {
    const systemPrompt = this.buildSystemPrompt(speakerName, contextWindow);

    return {
      voice_id: voiceId,
      // Update to latest conversational model
      model_id: 'eleven_conversational_v2',
      messages: [
        {
          role: 'system',
          text: systemPrompt
        },
        {
          role: 'user',
          text: userQuestion
        }
      ],
      audio_config: {
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.9,
          style: 0.0, // New parameter for expressiveness
          use_speaker_boost: true // Enhance voice quality
        }
      },
      // Add support for dynamic variables
      dynamic_variables: {
        speaker_name: speakerName,
        context: contextWindow.substring(0, 500) // Truncate if too long
      }
    };
  }

  private buildSystemPrompt(_speakerName: string, contextWindow: string): string {
    return `You are {{speaker_name}}. You are having a conversation with a viewer who paused your video to ask you a question.

CONTEXT FROM THE VIDEO (what you just said):
${contextWindow}

IMPORTANT INSTRUCTIONS:
- Respond as {{speaker_name}} in your authentic voice and style
- Only reference information from the provided context
- If the question isn't related to what you just discussed, politely redirect to the video content
- Keep responses conversational and under 30 seconds when spoken
- Don't invent facts or information not present in the context
- Maintain your personality and speaking patterns
- If you need to clarify something, ask the user to specify which part of the video they're referring to

Remember: You are continuing a natural conversation as if the video is paused and you're directly responding to the viewer.`;
  }

  async startConversation(config: ConversationConfig): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/convai/conversations`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Conversation start failed: ${error}`);
      }

      const data = await response.json() as { conversation_id: string };
      this.conversation_id = data.conversation_id; // Store for later use
      return data.conversation_id;
    } catch (error) {
      console.error('Conversation start error:', error);
      throw new Error(`ElevenLabs conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Creates an ElevenLabs Agent for real-time streaming conversations
   * @param speakerName Name of the speaker from the YouTube video
   * @param voiceId Voice ID of the cloned voice
   * @param contextWindow Context from the YouTube video transcript
   * @returns Agent ID for the created agent
   */
  async createAgent(speakerName: string, voiceId: string, contextWindow: string): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(speakerName, contextWindow);
      
      const agentConfig: AgentConfig = {
        conversation_config: {
          voice_id: voiceId,
          model_id: 'eleven_conversational_v2',
          system_prompt: systemPrompt
        },
        platform_settings: {
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.9,
            style: 0.0,
            use_speaker_boost: true
          }
        },
        name: `${speakerName} from YouTube`
      };
      
      const response = await fetch(`${this.baseUrl}/convai/agents/create`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(agentConfig)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Agent creation failed: ${error}`);
      }

      const data = await response.json() as CreateAgentResponse;
      this.agent_id = data.agent_id; // Store for later use
      return data.agent_id;
    } catch (error) {
      console.error('Agent creation error:', error);
      throw new Error(`ElevenLabs agent creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Starts a streaming conversation with an ElevenLabs Agent
   * @param agentId ID of the agent to converse with
   * @param userQuestion Question from the user
   * @returns Response with conversation ID and initial text
   */
  async streamConversation(agentId: string, userQuestion: string): Promise<StreamConversationResponse> {
    try {
      const request: StreamConversationRequest = {
        text: userQuestion,
        conversation_id: this.conversation_id || undefined
      };
      
      const response = await fetch(`${this.baseUrl}/convai/agents/${agentId}/simulate-conversation`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Streaming conversation failed: ${error}`);
      }

      const data = await response.json() as StreamConversationResponse;
      this.conversation_id = data.conversation_id; // Store for later use
      return data;
    } catch (error) {
      console.error('Streaming conversation error:', error);
      throw new Error(`ElevenLabs streaming conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Gets a WebSocket URL for real-time streaming conversation
   * @param agentId ID of the agent to stream conversation with
   * @returns WebSocket URL for streaming
   */
  getStreamingWebSocketUrl(agentId: string): string {
    return `wss://api.elevenlabs.io/v1/convai/agents/${agentId}/simulate-conversation/stream?xi-api-key=${this.apiKey}`;
  }

  // New method to handle silent periods for cost optimization
  async handleSilentPeriod(): Promise<void> {
    if (!this.conversation_id) {
      console.warn('No active conversation to handle silent period');
      return;
    }

    try {
      await fetch(`${this.baseUrl}/convai/conversations/${this.conversation_id}/silence`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          silence_detected: true
        })
      });
      console.log('Silent period handling activated');
    } catch (error) {
      console.error('Silent period handling error:', error);
    }
  }
}