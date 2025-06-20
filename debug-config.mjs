import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Log environment variables
console.log('Environment variables before import:');
console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'Set (length: ' + process.env.ELEVENLABS_API_KEY.length + ')' : 'Not set');

// Import the config module
import { config } from './dist/config/index.js';

console.log('Loaded config:', config);
