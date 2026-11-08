import { createClient } from "redis";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redisClient = createClient({
  url: env.REDIS_URL,
});

redisClient.on("error", (error) => {
  logger.error({ err: error }, "Redis client error");
});

export async function connectRedis(): Promise<void> {
  if (redisClient.isOpen) {
    return;
  }

  await redisClient.connect();

  logger.info("Redis connected successfully");
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.quit();

  logger.info("Redis disconnected");
}
