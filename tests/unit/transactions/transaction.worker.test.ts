import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockJob {
  data: {
    transactionId: string;
  };
  attemptsMade: number;
  opts: {
    attempts: number;
  };
}

type WorkerProcessor = (job: MockJob) => Promise<void>;
type WorkerEventHandler = (...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  findByTransactionId: vi.fn(),
  markAsProcessing: vi.fn(),
  markAsProcessed: vi.fn(),
  markAsFailed: vi.fn(),

  processor: null as WorkerProcessor | null,

  events: {} as Record<string, WorkerEventHandler>,

  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_queueName: string, processor: WorkerProcessor) {
      mocks.processor = processor;
    }

    on(event: string, handler: WorkerEventHandler) {
      mocks.events[event] = handler;
      return this;
    }
  },
}));

vi.mock("../../../src/lib/bullmq-connection.js", () => ({
  bullMQConnection: {},
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: mocks.logger,
}));

vi.mock("../../../src/modules/transactions/transaction.repository.js", () => ({
  findByTransactionId: mocks.findByTransactionId,
  markAsProcessing: mocks.markAsProcessing,
  markAsProcessed: mocks.markAsProcessed,
  markAsFailed: mocks.markAsFailed,
}));

import "../../../src/workers/transaction.worker.js";

const transactionId = "txn_test_001";

const pendingTransaction = {
  transactionId,
  status: "PENDING",
};

const processingTransaction = {
  transactionId,
  status: "PROCESSING",
};

const processedTransaction = {
  transactionId,
  status: "PROCESSED",
};

const failedTransaction = {
  transactionId,
  status: "FAILED",
};

function createJob(attemptsMade = 0, attempts = 3): MockJob {
  return {
    data: { transactionId },
    attemptsMade,
    opts: { attempts },
  };
}

function getProcessor(): WorkerProcessor {
  const processor = mocks.processor;

  if (!processor) {
    throw new Error("Worker processor was not initialized");
  }

  return processor;
}

function getEventHandler(event: string): WorkerEventHandler {
  const handler = mocks.events[event];

  if (!handler) {
    throw new Error(`Worker event handler '${event}' was not registered`);
  }

  return handler;
}

describe("Transaction Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should throw an error if transaction does not exist", async () => {
    mocks.findByTransactionId.mockResolvedValue(null);

    await expect(getProcessor()(createJob())).rejects.toThrow(
      `Transaction ${transactionId} not found`,
    );

    expect(mocks.markAsProcessing).not.toHaveBeenCalled();
    expect(mocks.markAsProcessed).not.toHaveBeenCalled();
  });

  it("should skip an already PROCESSED transaction", async () => {
    mocks.findByTransactionId.mockResolvedValue(processedTransaction);

    await getProcessor()(createJob());

    expect(mocks.markAsProcessing).not.toHaveBeenCalled();
    expect(mocks.markAsProcessed).not.toHaveBeenCalled();
  });

  it("should skip an already FAILED transaction", async () => {
    mocks.findByTransactionId.mockResolvedValue(failedTransaction);

    await getProcessor()(createJob());

    expect(mocks.markAsProcessing).not.toHaveBeenCalled();
    expect(mocks.markAsProcessed).not.toHaveBeenCalled();
  });

  it("should process a PENDING transaction successfully", async () => {
    vi.useFakeTimers();

    mocks.findByTransactionId
      .mockResolvedValueOnce(pendingTransaction)
      .mockResolvedValueOnce(processingTransaction);

    mocks.markAsProcessing.mockResolvedValue(1);
    mocks.markAsProcessed.mockResolvedValue(processedTransaction);

    const processing = getProcessor()(createJob());

    await vi.advanceTimersByTimeAsync(30_000);

    await expect(processing).resolves.toBeUndefined();

    expect(mocks.markAsProcessing).toHaveBeenCalledWith(transactionId);
    expect(mocks.markAsProcessed).toHaveBeenCalledWith(transactionId);
  });

  it("should resume processing a transaction already in PROCESSING state", async () => {
    vi.useFakeTimers();

    mocks.findByTransactionId.mockResolvedValue(processingTransaction);
    mocks.markAsProcessed.mockResolvedValue(processedTransaction);

    const processing = getProcessor()(createJob());

    await vi.advanceTimersByTimeAsync(30_000);

    await expect(processing).resolves.toBeUndefined();

    expect(mocks.markAsProcessing).not.toHaveBeenCalled();
    expect(mocks.markAsProcessed).toHaveBeenCalledWith(transactionId);
  });

  it("should throw if transaction cannot transition to PROCESSING", async () => {
    mocks.findByTransactionId
      .mockResolvedValueOnce(pendingTransaction)
      .mockResolvedValueOnce(pendingTransaction);

    mocks.markAsProcessing.mockResolvedValue(0);

    await expect(getProcessor()(createJob())).rejects.toThrow(
      `Unable to start processing transaction ${transactionId}`,
    );

    expect(mocks.markAsProcessed).not.toHaveBeenCalled();
  });

  it("should throw if transaction cannot transition to PROCESSED", async () => {
    vi.useFakeTimers();

    mocks.findByTransactionId.mockResolvedValue(processingTransaction);
    mocks.markAsProcessed.mockResolvedValue(0);

    const processing = getProcessor()(createJob());

    const assertion = expect(processing).rejects.toThrow(
      `Unable to complete transaction ${transactionId}`,
    );

    await vi.advanceTimersByTimeAsync(30_000);

    await assertion;
  });

  it("should not mark transaction FAILED before final retry", async () => {
    const failedHandler = getEventHandler("failed");

    const job = createJob(1, 3);

    await failedHandler(job, new Error("Temporary failure"));

    expect(mocks.markAsFailed).not.toHaveBeenCalled();
  });

  it("should mark transaction FAILED after final retry", async () => {
    const failedHandler = getEventHandler("failed");

    const job = createJob(3, 3);

    mocks.markAsFailed.mockResolvedValue(1);

    await failedHandler(job, new Error("Permanent failure"));

    expect(mocks.markAsFailed).toHaveBeenCalledWith(transactionId);
  });

  it("should handle a failed event without a job", async () => {
    const failedHandler = getEventHandler("failed");

    await failedHandler(null, new Error("Worker failure"));

    expect(mocks.logger.error).toHaveBeenCalled();
    expect(mocks.markAsFailed).not.toHaveBeenCalled();
  });

  it("should log worker errors", () => {
    const errorHandler = getEventHandler("error");
    const error = new Error("Redis connection lost");

    errorHandler(error);

    expect(mocks.logger.error).toHaveBeenCalledWith(
      { err: error },
      "Transaction worker error",
    );
  });
});
