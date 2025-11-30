import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class STTService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.DEEPGRAM_API_KEY || '';
        if (!this.apiKey) {
            console.warn('DEEPGRAM_API_KEY is missing');
        }
    }

    async transcribeAudio(buffer: Buffer): Promise<{ text: string, confidence?: number }> {
        if (!this.apiKey) {
            console.error('STT Service: Missing API Key');
            return { text: '' };
        }

        try {
            // TODO: Switch to streaming or WebRTC for lower latency in future
            const response = await axios.post(
                'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
                buffer,
                {
                    headers: {
                        'Authorization': `Token ${this.apiKey}`,
                        // Browser MediaRecorder usually sends webm/ogg. Deepgram supports this.
                        // We set it to audio/webm to match the client.
                        'Content-Type': 'audio/webm'
                    }
                }
            );

            const transcript = response.data?.results?.channels[0]?.alternatives[0]?.transcript || '';
            const confidence = response.data?.results?.channels[0]?.alternatives[0]?.confidence || 0;

            return { text: transcript, confidence };
        } catch (error) {
            console.error('Deepgram STT Error:', error);
            return { text: '' };
        }
    }
}
