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
        if (!this.apiKey) {
            console.error('TTS Service: Missing API Key');
            // Return empty buffer or handle error appropriately
            return Buffer.from('');
        }

        try {
            // TODO: Implement streaming for lower latency
            // Using a default voice ID if the provided one is a placeholder name
            // In a real app, map VOICES.* constants to actual ElevenLabs Voice IDs
            const actualVoiceId = this.mapVoiceId(voiceId);

            const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${actualVoiceId}`,
                {
                    text: text,
                    model_id: "eleven_turbo_v2", // Switched to Turbo for lower latency and free tier support
                    voice_settings: {
                        stability: 0.7, // Higher stability = more consistent, less emotional/fast
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
        } catch (error) {
            console.error('ElevenLabs TTS Error:', error);
            return Buffer.from('');
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
