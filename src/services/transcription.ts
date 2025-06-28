import fetch from 'node-fetch';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { config } from '../config/index.js';
import { TranscriptSegment } from '../types/index.js';

export class TranscriptionService {
  private apiKey = config.ELEVENLABS_API_KEY;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  async transcribeAudio(audioPath: string): Promise<TranscriptSegment[]> {
    try {
      console.log(`Starting transcription for: ${audioPath}`);
      
      // Send audio directly to ElevenLabs for transcription
      const transcript = await this.requestTranscription(audioPath);
      
      console.log('Transcription completed, formatting results...');
      return this.formatTranscript(transcript);
    } catch (error) {
      console.error('Transcription failed:', error);
      throw new Error(`Transcription service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async requestTranscription(audioPath: string): Promise<any> {
    const form = new FormData();
    
    // Check if file exists before creating read stream
    try {
      const stats = await import('fs').then(fs => fs.promises.stat(audioPath));
      if (!stats.isFile()) {
        throw new Error(`Audio file not found at path: ${audioPath}`);
      }
      
      console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Create file read stream and append to form with proper filename
      const fileStream = createReadStream(audioPath);
      const filename = audioPath.split('/').pop() || 'audio.wav';
      
      // Add file with proper filename to help ElevenLabs identify it
      form.append('file', fileStream, { filename });
      form.append('model_id', 'scribe_v1'); // Using valid model ID as per API error message
      form.append('timestamp_granularities', 'segment');
      form.append('language', 'en');
      
      console.log(`Sending transcription request for file: ${filename}`);
      console.log('Request started at:', new Date().toISOString());
      
      const response = await fetch(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          // Don't manually add form headers, let form-data handle it
        },
        body: form,
        // sizeLimit is not a valid fetch option either, but if you want to limit upload size, handle it before sending
      });

      console.log('Response received at:', new Date().toISOString());
      console.log(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const jsonResponse = await response.json();
      console.log('Transcription API response received successfully');
      return jsonResponse;
    } catch (error) {
      console.error('Error in transcription request:', error);
      throw error;
    }
  }

  private formatTranscript(apiResponse: any): TranscriptSegment[] {
    console.log("formatTranscript: Entered function.");
    let segmentsArray: any[];

    if (Array.isArray(apiResponse)) {
      // API response is an array of segments
      segmentsArray = apiResponse;
    } else if (apiResponse && Array.isArray(apiResponse.segments)) {
      // API response is an object with a 'segments' array
      segmentsArray = apiResponse.segments;
    } else if (apiResponse && typeof apiResponse.text === 'string' && !apiResponse.segments) {
      // API response is an object with a 'text' property and no 'segments' array
      console.log('formatTranscript: API response is an object with full text. Creating single segment.');
      if (apiResponse.text.trim() === '') {
        console.log('formatTranscript: Full text is empty or whitespace. Returning empty transcript.');
        return [];
      }
      const singleSegment: TranscriptSegment = {
        text: apiResponse.text.trim(),
        start: 0, // Placeholder, as no specific timestamps are available
        end: 0,   // Placeholder
        speaker: 'speaker_1' // Default speaker
      };
      console.log('formatTranscript: Created single segment:', JSON.stringify(singleSegment, null, 2));
      return [singleSegment];
    } else {
      // Unrecognized format or missing necessary data
      console.warn('formatTranscript: Segments data or full text not found in expected format. API Response (snippet):', JSON.stringify(apiResponse, null, 2).substring(0, 500));
      return [];
    }

    console.log("formatTranscript: segmentsArray determined for multi-segment response. Length:", segmentsArray ? segmentsArray.length : 'undefined or null');

    if (!segmentsArray || segmentsArray.length === 0) {
      console.log('formatTranscript: Segments array (for multi-segment) is null, undefined, or empty after initial check.');
      return [];
    }
    console.log(`formatTranscript: Initial segmentsArray (for multi-segment) has ${segmentsArray.length} segments. First few:`, JSON.stringify(segmentsArray.slice(0,3), null, 2));

    const validSegments = segmentsArray.filter((segment, index) => {
      if (!segment) {
        console.log(`formatTranscript: Segment ${index + 1} is null or undefined. Discarding.`);
        return false;
      }
      if (typeof segment.text !== 'string') {
        console.log(`formatTranscript: Segment ${index + 1} text is not a string ('${typeof segment.text}'). Discarding. Segment text: ${segment.text}`);
        return false;
      }
      if (segment.text.trim() === '') {
        return false;
      }
      if (segment.type === 'spacing') {
        return false;
      }
      return true;
    });

    if (validSegments.length === 0) {
      console.log('formatTranscript: No valid text segments found after filtering.');
      return [];
    }
    console.log(`formatTranscript: Found ${validSegments.length} valid segments after filtering. First few:`, JSON.stringify(validSegments.slice(0,3), null, 2));

    const formattedTranscript = validSegments.map((segment: any, index: number) => {
      const mappedSegment = {
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
        speaker: segment.speaker_id || 'speaker_1'
      };
      return mappedSegment;
    });
    
    console.log('formatTranscript: Final formatted transcript (first few):', JSON.stringify(formattedTranscript.slice(0,3), null, 2));
    console.log(`formatTranscript: Total formatted segments: ${formattedTranscript.length}`);
    return formattedTranscript;
  }

  getContextWindow(transcript: TranscriptSegment[], pausedTime: number, windowSeconds: number = 60): string {
    const startTime = Math.max(0, pausedTime - windowSeconds);
    
    const relevantSegments = transcript.filter(segment => 
      segment.start >= startTime && segment.start <= pausedTime
    );

    return relevantSegments
      .map(segment => segment.text)
      .join(' ')
      .trim();
  }
}