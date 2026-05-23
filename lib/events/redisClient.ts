// lib/events/redisClient.ts

import IORedis from 'ioredis';

// Create a singleton Redis client. Configuration is read from environment variables.
// In production you should set REDIS_HOST, REDIS_PORT, and optionally REDIS_PASSWORD.
const redis = new IORedis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
});

export default redis;
