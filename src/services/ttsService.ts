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
            return Buffer.from('');
        }

        try {
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
        } catch (error) {
            console.error('ElevenLabs TTS Error:', error);
            return Buffer.from('');
        }
    }

    private mapVoiceId(voiceName: string): string {
        if (voiceName && voiceName.length > 10) {
            return voiceName;
        }

        const voiceMap: { [key: string]: string } = {
            'voice_formal': '21m00Tcm4TlvDq8ikWAM', // Rachel
            'voice_friendly': 'AZnzlk1XvdvUeBnXmlld', // Domi
            'voice_casual': 'ErXwobaYiN019PkySvjV', // Antoni
            'voice_neutral': 'MF3mGyEYCl7XYWlgWWvy'  // Elli
        };
        return voiceMap[voiceName] || '21m00Tcm4TlvDq8ikWAM';
    }
}
