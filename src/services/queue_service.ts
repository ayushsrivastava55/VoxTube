import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null // ✅ Required by BullMQ
});

export const videoQueue = new Queue('video-processing', { connection });
