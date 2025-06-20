import { VideoData, TranscriptSegment } from '../types/index.js';

class MemoryService {
  private videoData = new Map<string, VideoData>();
  private contextCache = new Map<string, Map<number, string>>();
  private questionCounts = new Map<string, number>();

  setVideoData(videoId: string, data: Partial<VideoData>): void {
    const existing = this.videoData.get(videoId) || {
      videoId,
      createdAt: new Date()
    };
    
    this.videoData.set(videoId, { ...existing, ...data });
  }

  getVideoData(videoId: string): VideoData | undefined {
    return this.videoData.get(videoId);
  }

  getTranscript(videoId: string): TranscriptSegment[] | undefined {
    return this.videoData.get(videoId)?.transcript;
  }

  setVoiceId(videoId: string, voiceId: string): void {
    this.setVideoData(videoId, { voiceId });
  }

  getVoiceId(videoId: string): string | undefined {
    return this.videoData.get(videoId)?.voiceId;
  }

  setAgentId(videoId: string, agentId: string): void {
    this.setVideoData(videoId, { agentId });
  }

  getAgentId(videoId: string): string | undefined {
    return this.videoData.get(videoId)?.agentId;
  }

  cacheContextWindow(videoId: string, timestamp: number, context: string): void {
    if (!this.contextCache.has(videoId)) {
      this.contextCache.set(videoId, new Map());
    }
    this.contextCache.get(videoId)!.set(timestamp, context);
  }

  getCachedContextWindow(videoId: string, timestamp: number): string | undefined {
    return this.contextCache.get(videoId)?.get(timestamp);
  }

  incrementQuestionCount(videoId: string): number {
    const current = this.questionCounts.get(videoId) || 0;
    const newCount = current + 1;
    this.questionCounts.set(videoId, newCount);
    return newCount;
  }

  getQuestionCount(videoId: string): number {
    return this.questionCounts.get(videoId) || 0;
  }

  cleanup(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [videoId, data] of this.videoData.entries()) {
      if (now.getTime() - data.createdAt.getTime() > maxAge) {
        this.videoData.delete(videoId);
        this.contextCache.delete(videoId);
        this.questionCounts.delete(videoId);
      }
    }
  }

  clear(): void {
    this.videoData.clear();
    this.contextCache.clear();
    this.questionCounts.clear();
  }
}

export const memoryService = new MemoryService();

// Auto-cleanup every hour
setInterval(() => {
  memoryService.cleanup();
}, 60 * 60 * 1000);