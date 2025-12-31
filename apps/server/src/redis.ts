import Redis from "ioredis";
import { env } from "@spur-live-chat-agent/env/server";

let redis: Redis | null = null;
let redisAvailable = false;

/**
 * Get or create a Redis client singleton.
 * Returns null if Redis is unavailable (graceful degradation).
 */
export function getRedisClient(): Redis | null {
	if (redis) return redis;

	const redisUrl = env.REDIS_URL;
	if (!redisUrl) {
		console.log("[Redis] REDIS_URL not configured, caching disabled");
		return null;
	}

	try {
		redis = new Redis(redisUrl, {
			maxRetriesPerRequest: 3,
			retryStrategy: (times) => {
				if (times > 3) {
					console.error("[Redis] Max retries reached, disabling cache");
					redisAvailable = false;
					return null;
				}
				return Math.min(times * 100, 3000);
			},
			lazyConnect: true,
		});

		redis.on("connect", () => {
			console.log("[Redis] Connected successfully");
			redisAvailable = true;
		});

		redis.on("error", (err) => {
			console.error("[Redis] Connection error:", err.message);
			redisAvailable = false;
		});

		redis.on("close", () => {
			console.log("[Redis] Connection closed");
			redisAvailable = false;
		});

		// Attempt connection
		redis.connect().catch((err) => {
			console.error("[Redis] Initial connection failed:", err.message);
			redisAvailable = false;
		});

		return redis;
	} catch (error) {
		console.error("[Redis] Failed to initialize client:", error);
		return null;
	}
}

/**
 * Check if Redis is available for use
 */
export function isRedisAvailable(): boolean {
	return redisAvailable && redis !== null;
}

/**
 * Safely get a value from Redis cache.
 * Returns null on any error or if Redis is unavailable.
 */
export async function getCached<T>(key: string): Promise<T | null> {
	if (!isRedisAvailable() || !redis) return null;

	try {
		const cached = await redis.get(key);
		if (!cached) return null;
		return JSON.parse(cached) as T;
	} catch (error) {
		console.error(`[Redis] Error getting key ${key}:`, error);
		return null;
	}
}

/**
 * Safely set a value in Redis cache with TTL.
 * Fails silently if Redis is unavailable.
 */
export async function setCached(
	key: string,
	value: any,
	ttlSeconds: number = 90,
): Promise<void> {
	if (!isRedisAvailable() || !redis) return;

	try {
		await redis.setex(key, ttlSeconds, JSON.stringify(value));
	} catch (error) {
		console.error(`[Redis] Error setting key ${key}:`, error);
	}
}

/**
 * Safely delete one or more keys from Redis cache.
 * Fails silently if Redis is unavailable.
 */
export async function deleteCached(...keys: string[]): Promise<void> {
	if (!isRedisAvailable() || !redis || keys.length === 0) return;

	try {
		await redis.del(...keys);
	} catch (error) {
		console.error(`[Redis] Error deleting keys:`, error);
	}
}

/**
 * Build cache key for conversation list by session
 */
export function conversationListCacheKey(sessionId: string): string {
	return `chat:conversations:session:${sessionId}`;
}

/**
 * Build cache key for conversation messages
 */
export function conversationMessagesCacheKey(conversationId: string): string {
	return `chat:messages:conversation:${conversationId}`;
}
