import dotenv from 'dotenv';

const result = dotenv.config();
console.log('Dotenv config result:', result);
console.log('Environment variables:');
console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'Set (length: ' + process.env.ELEVENLABS_API_KEY.length + ')' : 'Not set');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MAX_QUESTIONS_PER_VIDEO:', process.env.MAX_QUESTIONS_PER_VIDEO);
console.log('CACHE_DURATION_HOURS:', process.env.CACHE_DURATION_HOURS);
console.log('MAX_CONTEXT_WINDOW_SECONDS:', process.env.MAX_CONTEXT_WINDOW_SECONDS);
