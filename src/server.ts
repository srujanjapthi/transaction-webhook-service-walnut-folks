import http from "node:http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { connectRedis, disconnectRedis } from "./lib/redis.js";
import { db } from "./prisma/db.js";

async function main(): Promise<void> {
  await connectRedis();
  logger.info("Redis initialization complete");

  await db.connect();
  logger.info("PostgreSQL connected successfully");

  const [{ app }, { transactionWorker }, { transactionQueue }] =
    await Promise.all([
      import("./app.js"),
      import("./workers/transaction.worker.js"),
      import("./queues/transaction.queue.js"),
    ]);

  const server = http.createServer(app);

  await Promise.all([
    transactionWorker.waitUntilReady(),
    transactionQueue.waitUntilReady(),
  ]);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HTTP server started");
  });

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;

    shuttingDown = true;
    logger.info({ signal }, "Shutdown initiated");

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await transactionWorker.close();
      await transactionQueue.close();
      await db.close();
      await disconnectRedis();

      logger.info("Application shutdown completed");
    } catch (error) {
      logger.error({ err: error }, "Application shutdown failed");
      process.exitCode = 1;
    }
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "Application startup failed");

  try {
    await db.close();
    await disconnectRedis();
  } catch (shutdownError) {
    logger.error({ err: shutdownError }, "Startup cleanup failed");
  }

  process.exitCode = 1;
});
