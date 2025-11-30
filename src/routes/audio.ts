import { FastifyInstance, FastifyRequest } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { STTService } from '../services/sttService';
import { TTSService } from '../services/ttsService';
import { DialogueManager } from '../managers/dialogueManager';

export default async function audioRoutes(fastify: FastifyInstance, options: { dialogueManager: DialogueManager }) {
    const stt = new STTService();
    const tts = new TTSService();
    const dialogueManager = options.dialogueManager;

    fastify.get('/audio', { websocket: true }, (connection: SocketStream, req: FastifyRequest) => {
        console.log('Client connected to /audio');

        const sessionId = dialogueManager.createSession();
        let audioChunks: Buffer[] = [];

        // Initial Greeting
        (async () => {
            const response = await dialogueManager.handleInput(sessionId, ''); // Trigger WELCOME
            if (response.text) {
                const audioBuffer = await tts.synthesize(response.text, response.voice);
                connection.socket.send(audioBuffer);
            }
        })();

        connection.socket.on('message', async (message: Buffer) => {
            // Check if message is a control signal (e.g., "end" string buffer)
            // For simplicity, let's assume if it's small string, it's a signal.
            // In production, use a proper protocol or separate channel.

            // For this stub, we'll assume the client sends raw audio, and we process it 
            // when we get a specific marker or just process every chunk if we were streaming.
            // Requirement says: "When client sends 'end', call sttService"

            if (message.toString() === 'end') {
                const fullBuffer = Buffer.concat(audioChunks);
                audioChunks = []; // Reset buffer

                // STT
                const { text } = await stt.transcribeAudio(fullBuffer);
                console.log(`User said: ${text}`);

                if (text) {
                    // Dialogue Manager
                    const response = await dialogueManager.handleInput(sessionId, text);
                    console.log(`Bot says: ${response.text}`);

                    // TTS
                    if (response.text) {
                        const audioBuffer = await tts.synthesize(response.text, response.voice);
                        connection.socket.send(audioBuffer);

                        // If booking is finalized, send confirmation data to client
                        if (response.booking) {
                            connection.socket.send(JSON.stringify({
                                type: 'booking',
                                data: response.booking
                            }));
                        }

                        if (response.shouldEnd) {
                            connection.socket.close();
                        }
                    }
                }
            } else {
                // Accumulate audio chunks
                // console.log(`Received chunk: ${message.length} bytes`);
                audioChunks.push(message);
            }
        });

        connection.socket.on('close', () => {
            console.log(`Client disconnected: ${sessionId}`);
        });
    });
}
