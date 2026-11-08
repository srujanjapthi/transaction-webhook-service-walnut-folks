import { Worker } from "bullmq";

import { bullMQConnection } from "../lib/bullmq-connection.js";
import { logger } from "../lib/logger.js";

import {
  findByTransactionId,
  markAsProcessing,
  markAsProcessed,
  markAsFailed,
} from "../modules/transactions/transaction.repository.js";

import type { TransactionJobData } from "../queues/transaction.types.js";

const PROCESSING_DELAY = 30_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const transactionWorker = new Worker<TransactionJobData>(
  "transactions",
  async (job) => {
    const { transactionId } = job.data;

    logger.info({ transactionId }, "Transaction job started");

    let transaction = await findByTransactionId(transactionId);

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status === "PROCESSED" || transaction.status === "FAILED") {
      logger.info({ transactionId }, "Transaction already completed");
      return;
    }

    if (transaction.status === "PENDING") {
      await markAsProcessing(transactionId);

      transaction = await findByTransactionId(transactionId);

      if (transaction?.status !== "PROCESSING") {
        throw new Error(
          `Unable to start processing transaction ${transactionId}`,
        );
      }
    }

    logger.info({ transactionId }, "Simulating external API call");

    await delay(PROCESSING_DELAY);

    const updatedTransaction = await markAsProcessed(transactionId);

    if (!updatedTransaction) {
      throw new Error(`Unable to complete transaction ${transactionId}`);
    }

    logger.info({ transactionId }, "Transaction processed successfully");
  },
  { connection: bullMQConnection, concurrency: 5 },
);

transactionWorker.on("failed", async (job, error) => {
  if (!job) {
    logger.error({ err: error }, "Transaction job failed");
    return;
  }

  const maxAttempts = job.opts.attempts ?? 1;

  logger.error(
    {
      transactionId: job.data.transactionId,
      attemptsMade: job.attemptsMade,
      maxAttempts,
      err: error,
    },
    "Transaction job attempt failed",
  );

  if (job.attemptsMade >= maxAttempts) {
    try {
      await markAsFailed(job.data.transactionId);

      logger.error(
        { transactionId: job.data.transactionId },
        "Transaction permanently failed",
      );
    } catch (failureError) {
      logger.error(
        { transactionId: job.data.transactionId, err: failureError },
        "Unable to update failed transaction status",
      );
    }
  }
});

transactionWorker.on("error", (error) => {
  logger.error({ err: error }, "Transaction worker error");
});
