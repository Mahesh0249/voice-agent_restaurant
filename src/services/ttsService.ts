import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class TTSService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.ELEVENLABS_API_KEY || '';
        if (!this.apiKey) {
            console.warn('ELEVENLABS_API_KEY is missing');
        }
    }

    async synthesize(text: string, voiceId: string): Promise<Buffer> {
        try {
            // Priority 1: Try ElevenLabs
            if (this.apiKey) {
                const actualVoiceId = this.mapVoiceId(voiceId);
                const response = await axios.post(
                    `https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`,
                    {
                        text: text,
                        model_id: "eleven_turbo_v2",
                        voice_settings: {
                            stability: 0.7,
                            similarity_boost: 0.8
                        }
                    },
                    {
                        headers: {
                            'xi-api-key': this.apiKey,
                            'Content-Type': 'application/json',
                            'Accept': 'audio/mpeg'
                        },
                        responseType: 'arraybuffer'
                    }
                );
                return Buffer.from(response.data);
            } else {
                console.warn('ElevenLabs API Key missing, falling back to Google TTS');
                throw new Error('Missing API Key');
            }
        } catch (error) {
            console.error('ElevenLabs TTS Error (Falling back to Google TTS):', error);

            // Priority 2: Fallback to Google TTS (Free)
            try {
                // Dynamic import to avoid issues if package is missing
                const googleTTS = require('google-tts-api');
                const base64Audio = await googleTTS.getAudioBase64(text, {
                    lang: 'en',
                    slow: false,
                    host: 'https://translate.google.com',
                });
                return Buffer.from(base64Audio, 'base64');
            } catch (fallbackError) {
                console.error('Google TTS Fallback Error:', fallbackError);
                return Buffer.from('');
            }
        }
    }

    private mapVoiceId(voiceName: string): string {
        // If it looks like a valid ID (e.g. from voiceConfig), use it directly
        if (voiceName && voiceName.length > 10) {
            return voiceName;
        }

        // Map abstract voice names to specific ElevenLabs IDs
        // These are example IDs, replace with your preferred ones
        const voiceMap: { [key: string]: string } = {
            'voice_formal': '21m00Tcm4TlvDq8ikWAM', // Rachel
            'voice_friendly': 'AZnzlk1XvdvUeBnXmlld', // Domi
            'voice_casual': 'ErXwobaYiN019PkySvjV', // Antoni
            'voice_neutral': 'MF3mGyEYCl7XYWlgWWvy'  // Elli
        };
        return voiceMap[voiceName] || '21m00Tcm4TlvDq8ikWAM';
    }
}
