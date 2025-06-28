import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const result = dotenv.config();
console.log('Dotenv config result:', result);
console.log('Environment variables:', {
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ? 'Set (length: ' + process.env.ELEVENLABS_API_KEY.length + ')' : 'Not set',
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  MAX_QUESTIONS_PER_VIDEO: process.env.MAX_QUESTIONS_PER_VIDEO,
  CACHE_DURATION_HOURS: process.env.CACHE_DURATION_HOURS,
  MAX_CONTEXT_WINDOW_SECONDS: process.env.MAX_CONTEXT_WINDOW_SECONDS
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import apiRoutes from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3001"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        // Add other directives as needed
      }
    }
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use(limiter);

// Body parsing with increased limits for large audio files
app.use(express.json());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static files (for serving audio samples and public files)
app.use('/audio', express.static('audio'));
app.use(express.static('public'));
const vsPath = path.join(__dirname, '..', 'node_modules', 'voice-stream');
console.log('Serving voice-stream from:', vsPath);
app.use('/modules/voice-stream', express.static(vsPath));
app.use('/api', apiRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'YouTube AI Speaker Backend',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server with timeout configuration
const server = app.listen(config.PORT, () => {
  console.log(`🚀 Server running on port ${config.PORT}`);
  console.log(`📝 Environment: ${config.NODE_ENV}`);
  console.log(`🎯 API available at: http://localhost:${config.PORT}/api`);
  console.log(`⏱️  Request timeout: 10 minutes`);
  
  if (config.NODE_ENV === 'development') {
    console.log('\n📋 Available endpoints:');
    console.log('  POST /api/prepare-context    - Extract video transcript and voice sample');
    console.log('  POST /api/clone-voice        - Clone speaker voice with ElevenLabs');
    console.log('  POST /api/get-context-window - Get transcript context for timestamp');
    console.log('  POST /api/build-conversation - Build conversation config for AI');
    console.log('  POST /api/speak              - Generate speech with cloned voice');
    console.log('  GET  /api/health             - Service health check');
  }
});

// Configure server timeouts for long-running requests
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    // Force exit after a timeout if the server doesn't close gracefully
    setTimeout(() => {
      console.log('Forcing process exit');
      process.exit(0);
    }, 1000);
  });
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  shutdown();
});

export default app;