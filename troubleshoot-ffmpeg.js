#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

console.log('🔍 VoxTube FFmpeg & yt-dlp Troubleshooting Tool\n');

async function checkCommand(command, args = []) {
  return new Promise((resolve) => {
    console.log(`Checking: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${command} is working`);
        resolve({ success: true, stdout, stderr });
      } else {
        console.log(`❌ ${command} failed with code ${code}`);
        console.log(`   stderr: ${stderr}`);
        resolve({ success: false, stdout, stderr, code });
      }
    });
    
    proc.on('error', (error) => {
      console.log(`❌ ${command} not found: ${error.message}`);
      resolve({ success: false, error: error.message });
    });
  });
}

async function checkEnvironment() {
  console.log('📋 Environment Check:');
  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);
  console.log(`   Current directory: ${process.cwd()}`);
  console.log(`   PATH: ${process.env.PATH}`);
  console.log('');
}

async function checkFFmpegPaths() {
  console.log('🎬 FFmpeg Path Check:');
  
  const ffmpegPaths = [
    'ffmpeg',
    'ffprobe',
    process.env.FFMPEG_PATH,
    process.env.FFPROBE_PATH,
    'D:\\Development\\ffmpeg-7.1.1-essentials_build\\bin\\ffmpeg.exe',
    'D:\\Development\\ffmpeg-7.1.1-essentials_build\\bin\\ffprobe.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffprobe.exe'
  ].filter(Boolean);
  
  for (const ffmpegPath of ffmpegPaths) {
    if (ffmpegPath) {
      try {
        await fs.access(ffmpegPath);
        console.log(`✅ Found: ${ffmpegPath}`);
      } catch (error) {
        console.log(`❌ Not found: ${ffmpegPath}`);
      }
    }
  }
  console.log('');
}

async function runTests() {
  console.log('🧪 Running Tests:\n');
  
  // Test basic commands
  await checkCommand('ffmpeg', ['-version']);
  await checkCommand('ffprobe', ['-version']);
  await checkCommand('yt-dlp', ['--version']);
  
  console.log('');
  
  // Test with environment variables
  if (process.env.FFMPEG_PATH) {
    console.log('Testing with FFMPEG_PATH environment variable:');
    await checkCommand(process.env.FFMPEG_PATH, ['-version']);
    console.log('');
  }
  
  if (process.env.FFPROBE_PATH) {
    console.log('Testing with FFPROBE_PATH environment variable:');
    await checkCommand(process.env.FFPROBE_PATH, ['-version']);
    console.log('');
  }
}

async function main() {
  await checkEnvironment();
  await checkFFmpegPaths();
  await runTests();
  
  console.log('📝 Troubleshooting Summary:');
  console.log('');
  console.log('If you see ❌ errors above, here are the solutions:');
  console.log('');
  console.log('1. **Add FFmpeg to PATH (Recommended):**');
  console.log('   - Download FFmpeg from https://ffmpeg.org/download.html');
  console.log('   - Extract to C:\\ffmpeg or similar');
  console.log('   - Add C:\\ffmpeg\\bin to your system PATH');
  console.log('');
  console.log('2. **Use Environment Variables:**');
  console.log('   - Create a .env file in the project root');
  console.log('   - Add: FFMPEG_PATH=C:\\path\\to\\ffmpeg.exe');
  console.log('   - Add: FFPROBE_PATH=C:\\path\\to\\ffprobe.exe');
  console.log('');
  console.log('3. **Install yt-dlp:**');
  console.log('   - Download from https://github.com/yt-dlp/yt-dlp/releases');
  console.log('   - Add to PATH or place in project directory');
  console.log('');
  console.log('4. **Verify Installation:**');
  console.log('   - Open a new terminal/command prompt');
  console.log('   - Run: ffmpeg -version');
  console.log('   - Run: ffprobe -version');
  console.log('   - Run: yt-dlp --version');
}

main().catch(console.error); 