import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class YouTubeService {
  private audioDir = 'audio';

  constructor() {
    this.ensureAudioDir();
  }

  private async ensureAudioDir(): Promise<void> {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audio directory:', error);
    }
  }

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  async downloadAudio(videoUrl: string): Promise<{ audioPath: string; videoId: string }> {
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const audioFilename = `${videoId}_${uuidv4()}.wav`;
    const audioPath = path.join(this.audioDir, audioFilename);

    return new Promise((resolve, reject) => {
      // Using yt-dlp to extract audio
      const ytDlp = spawn('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'wav',
        '--audio-quality', '0',
        '--output', audioPath.replace('.wav', '.%(ext)s'),
        videoUrl
      ]);

      let stderr = '';

      ytDlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytDlp.on('close', (code) => {
        if (code === 0) {
          resolve({ audioPath, videoId });
        } else {
          reject(new Error(`yt-dlp failed: ${stderr}`));
        }
      });

      ytDlp.on('error', (error) => {
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      });
    });
  }

  async extractVoiceSample(audioPath: string, duration: number = 120): Promise<string> {
    const samplePath = audioPath.replace('.wav', '_sample.wav');

    return new Promise((resolve, reject) => {
      // Using ffmpeg to extract first 2 minutes
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioPath,
        '-t', duration.toString(),
        '-acodec', 'pcm_s16le',
        '-ar', '22050',
        '-ac', '1',
        '-y',
        samplePath
      ]);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(samplePath);
        } else {
          reject(new Error(`ffmpeg failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
      });
    });
  }

  async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}