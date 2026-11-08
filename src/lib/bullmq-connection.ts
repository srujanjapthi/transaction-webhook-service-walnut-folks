import { createNodeRedisClient } from "bullmq";

import { redisClient } from "./redis.js";

export const bullMQConnection = createNodeRedisClient(redisClient);
