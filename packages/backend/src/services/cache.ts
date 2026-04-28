import { Redis } from "ioredis";
import { env } from "../config/env.js";

// We'll assume REDIS_URL is in env, defaulting to localhost if not.
// For the sake of this task, we'll use a simple connection.
const REDIS_URL = process.env["REDIS_URL"] || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1, // Fail fast if Redis is down
  retryStrategy(times) {
    if (times > 3) return null; // stop retrying after 3 attempts
    return Math.min(times * 100, 3000);
  },
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

/**
 * Safely get a value from Redis.
 * If Redis is down, it returns null instead of throwing.
 */
export async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (error) {
    console.error(`Redis safeGet failed for key ${key}:`, error);
    return null;
  }
}

/**
 * Safely set a value in Redis with TTL.
 * If Redis is down, it logs the error but doesn't throw.
 */
export async function safeSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, "EX", ttlSeconds);
  } catch (error) {
    console.error(`Redis safeSet failed for key ${key}:`, error);
  }
}
