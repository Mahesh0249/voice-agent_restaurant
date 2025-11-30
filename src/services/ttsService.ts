import dotenv from 'dotenv';
import * as googleTTS from 'google-tts-api';

dotenv.config();

export class TTSService {
    constructor() {
        console.log('TTSService initialized (Google TTS Mode)');
    }

    async synthesize(text: string, voiceId: string): Promise<Buffer> {
        try {
            console.log('Synthesizing with Google TTS:', text);

            // Google TTS API returns base64 string
            const base64Audio = await googleTTS.getAudioBase64(text, {
                lang: 'en',
                slow: false,
                host: 'https://translate.google.com',
            });

            return Buffer.from(base64Audio, 'base64');
        } catch (error) {
            console.error('Google TTS Error:', error);
            return Buffer.from('');
        }
    }
}
