import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { memoryService } from './memory'; // adjust path as needed

const connection = new Redis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null // ✅ Required by BullMQ
});

export const videoQueue = new Queue('video-processing', { connection });

// Worker to process jobs and set returnValue
const videoWorker = new Worker('video-processing', async (job) => {
  const { videoId, videoUrl, speakerName } = job.data;

  // ... your processing logic here ...
  // For example, after processing:
  const videoData = await memoryService.getVideoData(videoId);
  const voiceSampleUrl = videoData?.voiceSampleUrl || '';
  const agentId = await memoryService.getAgentId(videoId) || null;

  // Return all needed fields for frontend
  return {
    videoId,
    transcriptReady: true,
    voiceSampleUrl,
    agentId
  };
}, { connection });
