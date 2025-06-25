import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class YouTubeService {
  private audioDir = 'audio';
  private ffmpegPath: string;
  private cookieFilePath: string;

  constructor() {
    this.ensureAudioDir();
    // Use the native ffmpeg installed in the environment
    this.ffmpegPath = 'ffmpeg';
    // Use path.resolve to get the absolute path to the cookie file in your project root
    this.cookieFilePath = path.resolve(process.cwd(), 'www.youtube.com_cookies.txt');
  }

  private async ensureAudioDir(): Promise<void> {
    try {
      await fs.mkdir(this.audioDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audio directory:', error);
    }
  }

  extractVideoId(url: string): string | null {
    // Handles various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/e\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

    private runYtDlp(args: string[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        await fs.access(this.cookieFilePath);
      } catch {
        return reject(new Error(`Cookie file not found at ${this.cookieFilePath}.`));
      }
      
      console.log(`Running yt-dlp with args: ${args.join(' ')}`);
      
      const ytDlp = spawn('yt-dlp', args);
      let stderr = '';
      ytDlp.stdout.on('data', (data) => console.log(`yt-dlp stdout: ${data.toString()}`));
      ytDlp.stderr.on('data', (data) => { stderr += data.toString(); console.log(`yt-dlp stderr: ${data.toString()}`); });
      ytDlp.on('close', (code) => code === 0 ? resolve() : reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`)));
      ytDlp.on('error', (error) => reject(new Error(`Failed to spawn yt-dlp: ${error.message}`)));
    });
  }

  // --- THIS FUNCTION IS WORKING PERFECTLY - NO CHANGES NEEDED ---
  async downloadAudio(videoUrl: string): Promise<{ audioPath: string; videoId: string }> {
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const audioFilename = `${videoId}_${uuidv4()}.wav`;
    const audioPath = path.join(this.audioDir, audioFilename);

    const ytDlpArgs = [
      videoUrl,
      '--extract-audio',
      '--audio-format', 'wav',
      '--output', audioPath.replace('.wav', '.%(ext)s'),
      '--cookies', this.cookieFilePath,
    ];

    await this.runYtDlp(ytDlpArgs);
    return { audioPath, videoId };
  }

  // --- REFACTORED AND HARDENED SEGMENT DOWNLOAD FUNCTION ---
  async downloadAudioSegment(videoUrl: string, startTime: number, duration: number = 60): Promise<{ audioPath: string }> {
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const safeStartTime = Math.max(0, startTime);
    const uniqueId = uuidv4();
    const endTime = safeStartTime + duration;
    const timeRange = `${this.formatTime(safeStartTime)}-${this.formatTime(endTime)}`;
    
    // Step 1: Download the segment in its native format (e.g., .webm)
    const tempOutputTemplate = path.join(this.audioDir, `${videoId}_segment_${uniqueId}.%(ext)s`);
    let downloadedFilePath = ''; // We'll find out the actual name after download

    const ytDlpArgs = [
      videoUrl,
      // Just download best audio, don't try to convert yet
      '-f', 'bestaudio',
      '--download-sections', `*${timeRange}`,
      '--output', tempOutputTemplate,
      '--cookies', this.cookieFilePath,
    ];
    
    await this.runYtDlp(ytDlpArgs);

    // Find the actual downloaded file (e.g., ...segment_....webm)
    const files = await fs.readdir(this.audioDir);
    const downloadedFile = files.find(f => f.includes(`${videoId}_segment_${uniqueId}`));
    if (!downloadedFile) {
        throw new Error('Downloaded segment file not found after yt-dlp run.');
    }
    downloadedFilePath = path.join(this.audioDir, downloadedFile);

    // Step 2: Convert the downloaded file to .wav using ffmpeg
    const finalAudioPath = downloadedFilePath.replace(path.extname(downloadedFilePath), '.wav');
    
    await new Promise<void>((resolve, reject) => {
        console.log(`Converting ${downloadedFilePath} to ${finalAudioPath} with ffmpeg...`);
        const ffmpeg = spawn(this.ffmpegPath, [
            '-i', downloadedFilePath,
            '-y', // Overwrite output file if it exists
            finalAudioPath
        ]);
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg conversion failed with code ${code}`));
            }
        });
    });

    // Step 3: Clean up the intermediate file (e.g., delete the .webm)
    await fs.unlink(downloadedFilePath);

    // Return the path to the final .wav file
    return { audioPath: finalAudioPath };
  }
  
  // (extractVoiceSample and clean
  
  // (extractVoiceSample and other functions remain the same)
  async extractVoiceSample(audioPath: string, duration: number = 120): Promise<string> {
    const samplePath = audioPath.replace('.wav', '_sample.wav');
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, [
        '-i', audioPath,
        '-t', duration.toString(),
        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        '-y', samplePath
      ]);
      let stderr = '';
      ffmpeg.stderr.on('data', (data) => stderr += data.toString());
      ffmpeg.on('close', (code) => code === 0 ? resolve(samplePath) : reject(new Error(`ffmpeg failed: ${stderr}`)));
      ffmpeg.on('error', (error) => reject(new Error(`Failed to spawn ffmpeg: ${error.message}`)));
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