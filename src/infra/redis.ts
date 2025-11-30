import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl);

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

// Helper functions
export async function getSlotCount(date: string, hour: string): Promise<number> {
    const key = `booking:slot:${date}:${hour}`;
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
}

export async function incrementSlot(date: string, hour: string): Promise<number> {
    const key = `booking:slot:${date}:${hour}`;
    return await redis.incr(key);
}

export async function lockSlot(date: string, hour: string, sessionId: string): Promise<boolean> {
    const lockKey = `lock:slot:${date}:${hour}`;

    // Check if we already hold the lock
    const currentHolder = await redis.get(lockKey);
    if (currentHolder === sessionId) {
        // Refresh TTL
        await redis.expire(lockKey, 300);
        return true;
    }

    // Try to acquire a lock for this slot
    // Set NX (not exists) with a TTL of 5 minutes (300 seconds) to prevent deadlocks
    const result = await redis.set(lockKey, sessionId, 'EX', 300, 'NX');
    return result === 'OK';
}

export async function unlockSlot(date: string, hour: string, sessionId: string): Promise<void> {
    const lockKey = `lock:slot:${date}:${hour}`;
    // Only unlock if we hold the lock
    const currentHolder = await redis.get(lockKey);
    if (currentHolder === sessionId) {
        await redis.del(lockKey);
    }
}
