// src/services/cache.service.ts

import Redis from 'ioredis';

// This connects to the Redis server we started with Docker.
const redis = new Redis();

// A prefix helps keep keys organized in Redis.
const VIDEO_KEY_PREFIX = 'video:';
const CACHE_EXPIRATION_SECONDS = 24 * 60 * 60; // Cache data for 24 hours

export const cacheService = {

  /**
   * Gets all cached data for a video.
   */
  async getVideoData(videoId: string): Promise<any | null> {
    const key = `${VIDEO_KEY_PREFIX}${videoId}`;
    const dataString = await redis.get(key);
    return dataString ? JSON.parse(dataString) : null;
  },

  /**
   * Caches all data for a video.
   */
  async setVideoData(videoId: string, data: object): Promise<void> {
    const key = `${VIDEO_KEY_PREFIX}${videoId}`;
    // We store the data as a single JSON string.
    await redis.set(key, JSON.stringify(data), 'EX', CACHE_EXPIRATION_SECONDS);
  },

  /**
   * A helper to specifically get just the voiceId.
   */
  async getVoiceId(videoId: string): Promise<string | null> {
    const data = await this.getVideoData(videoId);
    return data?.voiceId || null;
  }
};