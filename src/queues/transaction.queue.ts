import { Queue } from "bullmq";

import { bullMQConnection } from "../lib/bullmq-connection.js";
import type { TransactionJobData } from "./transaction.types.js";

export const transactionQueue = new Queue<TransactionJobData>("transactions", {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});
