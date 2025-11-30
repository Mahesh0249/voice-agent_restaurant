import fastify from 'fastify';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { redis } from './infra/redis';
import { DialogueManager } from './managers/dialogueManager';
import audioRoutes from './routes/audio';
import fs from 'fs';
import path from 'path';

dotenv.config();

const server = fastify({ logger: true });

// Initialize DialogueManager
const dialogueManager = new DialogueManager();

// Register WebSocket plugin
server.register(websocket);

// Register Health Route
server.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// Serve Test Client
server.get('/', async (request, reply) => {
    try {
        // Use process.cwd() to be safe regardless of where __dirname is
        const filePath = path.join(process.cwd(), 'client/index.html');
        console.log('Serving client from:', filePath);
        const html = fs.readFileSync(filePath, 'utf8');
        reply.type('text/html').send(html);
    } catch (err) {
        reply.code(500).send('Error loading client: ' + err);
    }
});

// Register Audio Routes
server.register(async (instance) => {
    await audioRoutes(instance, { dialogueManager });
});

const start = async () => {
    try {
        const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server started on port ${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
