#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

console.log('🔧 VoxTube Environment Setup\n');

async function checkFFmpegInstallation() {
  console.log('Checking FFmpeg installation...');
  
  const possiblePaths = [
    'D:\\Development\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe'
  ];
  
  let foundPath = null;
  
  for (const ffmpegPath of possiblePaths) {
    try {
      await fs.access(ffmpegPath);
      console.log(`✅ Found FFmpeg at: ${ffmpegPath}`);
      foundPath = ffmpegPath;
      break;
    } catch (error) {
      console.log(`❌ Not found: ${ffmpegPath}`);
    }
  }
  
  return foundPath;
}

async function createEnvFile(ffmpegPath) {
  const envContent = `# ElevenLabs API Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Application Settings
MAX_QUESTIONS_PER_VIDEO=25
CACHE_DURATION_HOURS=24
MAX_CONTEXT_WINDOW_SECONDS=60

# FFmpeg Configuration (Windows)
FFMPEG_PATH=${ffmpegPath}
FFPROBE_PATH=${ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe')}

# FFmpeg Configuration (macOS/Linux)
# FFMPEG_PATH=/usr/local/bin/ffmpeg
# FFPROBE_PATH=/usr/local/bin/ffprobe
`;

  try {
    await fs.writeFile('.env', envContent);
    console.log('✅ Created .env file successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Edit the .env file and add your ElevenLabs API key');
    console.log('2. Restart your development server: npm run dev');
    console.log('3. Test the application');
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
  }
}

async function main() {
  const ffmpegPath = await checkFFmpegInstallation();
  
  if (ffmpegPath) {
    console.log('');
    console.log('🎬 FFmpeg found! Creating .env file...');
    await createEnvFile(ffmpegPath);
  } else {
    console.log('');
    console.log('❌ FFmpeg not found in common locations.');
    console.log('');
    console.log('📝 Please install FFmpeg:');
    console.log('1. Download from: https://ffmpeg.org/download.html');
    console.log('2. Extract to C:\\ffmpeg or D:\\Development\\ffmpeg-7.1.1-essentials_build');
    console.log('3. Run this script again');
    console.log('');
    console.log('Or manually create a .env file with your FFmpeg paths.');
  }
}

main().catch(console.error); 