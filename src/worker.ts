// src/worker.ts

import { Worker } from 'bullmq';
import Redis from 'ioredis';

// Import our specialists
import { YouTubeService } from './services/youtube.js';
import { TranscriptionService } from './services/transcription.js';
import { ElevenLabsService } from './services/elevenlabs.js';
import { cacheService } from './services/cache_service.js';

const connection = new Redis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null // ✅ Required here too
});
const youtubeService = new YouTubeService();
const transcriptionService = new TranscriptionService();
const elevenLabsService = new ElevenLabsService();

console.log('🚀 Worker is running and waiting for jobs...');

// The worker listens to the 'video-processing' queue.
const worker = new Worker('video-processing', async (job) => {
  const { videoId, videoUrl, speakerName } = job.data;
  console.log(`[WORKER] Starting job ${job.id} for videoId: ${videoId}`);

  try {
    // === THIS IS THE HEAVY LIFTING, MOVED FROM api.ts ===

    // 1. Download full audio
    await job.updateProgress(10);
    console.log(`[WORKER] Downloading audio for ${videoId}...`);
    const { audioPath } = await youtubeService.downloadAudio(videoUrl);

    // 2. Transcribe the full audio
    await job.updateProgress(30);
    console.log(`[WORKER] Transcribing audio for ${videoId}...`);
    const transcript = await transcriptionService.transcribeAudio(audioPath);

    // 3. Extract voice sample
    await job.updateProgress(70);
    const voiceSamplePath = await youtubeService.extractVoiceSample(audioPath);

    // 4. Clone the voice
    // IMPORTANT: First, check if a clone already exists from the "fast lane"
    let voiceId = await cacheService.getVoiceId(videoId);
    if (!voiceId) {
        console.log(`[WORKER] Cloning voice for ${videoId}...`);
        voiceId = await elevenLabsService.cloneVoice(speakerName, voiceSamplePath);
    } else {
        console.log(`[WORKER] Re-using existing voiceId ${voiceId} for ${videoId}.`);
    }

    // 5. Save EVERYTHING to our persistent Redis cache
    await job.updateProgress(90);
    const dataToCache = {
        transcript,
        voiceId,
        speakerName,
        fullProcessingComplete: true // A flag to indicate the slow lane is done
    };
    await cacheService.setVideoData(videoId, dataToCache);
    console.log(`[WORKER] 💾 Cached full transcript and voiceId for ${videoId}.`);

    // 6. Clean up local files
    await youtubeService.cleanup(audioPath);
    await youtubeService.cleanup(voiceSamplePath);

    await job.updateProgress(100);
    console.log(`[WORKER] ✅ Job ${job.id} completed for videoId: ${videoId}`);
    return { status: 'Complete', voiceId, transcriptLength: transcript.length };
    
  } catch (error: any) {
    console.error(`[WORKER] ❌ Job ${job.id} failed for videoId: ${videoId}`, error);
    // Let BullMQ know the job failed, so it can be retried if configured.
    throw error;
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err.message}`);
});