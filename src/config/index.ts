import { z } from 'zod';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const configSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ELEVENLABS_API_KEY: z.string().min(1, 'ElevenLabs API key is required'),
  MAX_QUESTIONS_PER_VIDEO: z.string().default('25'),
  CACHE_DURATION_HOURS: z.string().default('24'),
  MAX_CONTEXT_WINDOW_SECONDS: z.string().default('60'),
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
});

function loadConfig() {
  const env = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    MAX_QUESTIONS_PER_VIDEO: process.env.MAX_QUESTIONS_PER_VIDEO,
    CACHE_DURATION_HOURS: process.env.CACHE_DURATION_HOURS,
    MAX_CONTEXT_WINDOW_SECONDS: process.env.MAX_CONTEXT_WINDOW_SECONDS,
    FFMPEG_PATH: process.env.FFMPEG_PATH,
    FFPROBE_PATH: process.env.FFPROBE_PATH,
  };

  const result = configSchema.safeParse(env);
  
  if (!result.success) {
    console.error('Configuration validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return {
    PORT: parseInt(result.data.PORT),
    NODE_ENV: result.data.NODE_ENV,
    ELEVENLABS_API_KEY: result.data.ELEVENLABS_API_KEY,
    MAX_QUESTIONS_PER_VIDEO: parseInt(result.data.MAX_QUESTIONS_PER_VIDEO),
    CACHE_DURATION_HOURS: parseInt(result.data.CACHE_DURATION_HOURS),
    MAX_CONTEXT_WINDOW_SECONDS: parseInt(result.data.MAX_CONTEXT_WINDOW_SECONDS),
    FFMPEG_PATH: result.data.FFMPEG_PATH,
    FFPROBE_PATH: result.data.FFPROBE_PATH,
  };
}

export const config = loadConfig();