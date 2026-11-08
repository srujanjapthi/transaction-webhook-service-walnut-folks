import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findByTransactionIdMock,
  createTransactionMock,
  findTransactionsMock,
  queueAddMock,
} = vi.hoisted(() => ({
  findByTransactionIdMock: vi.fn(),
  createTransactionMock: vi.fn(),
  findTransactionsMock: vi.fn(),
  queueAddMock: vi.fn(),
}));

vi.mock("../../../src/modules/transactions/transaction.repository.js", () => ({
  findByTransactionId: findByTransactionIdMock,
  createTransaction: createTransactionMock,
  findTransactions: findTransactionsMock,
}));

vi.mock("../../../src/queues/transaction.queue.js", () => ({
  transactionQueue: {
    add: queueAddMock,
  },
}));

import {
  receiveTransactionWebhook,
  getTransactionById,
  getTransactions,
} from "../../../src/modules/transactions/transaction.service.js";

const webhookInput = {
  transaction_id: "txn_test_001",
  source_account: "ACC001",
  destination_account: "ACC002",
  amount: 1500.5,
  currency: "INR",
};

const pendingTransaction = {
  transactionId: "txn_test_001",
  sourceAccount: "ACC001",
  destinationAccount: "ACC002",
  amount: "1500.50",
  currency: "INR",
  status: "PENDING",
  createdAt: new Date("2026-11-08T10:00:00.000Z"),
  processedAt: null,
};

const processedTransaction = {
  ...pendingTransaction,
  status: "PROCESSED",
  processedAt: new Date("2026-11-08T10:00:30.000Z"),
};

describe("Transaction Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("receiveTransactionWebhook", () => {
    it("should create a transaction and enqueue a job for a new webhook", async () => {
      findByTransactionIdMock.mockResolvedValue(null);
      createTransactionMock.mockResolvedValue(pendingTransaction);
      queueAddMock.mockResolvedValue({});

      const result = await receiveTransactionWebhook(webhookInput);

      expect(findByTransactionIdMock).toHaveBeenCalledWith("txn_test_001");

      expect(createTransactionMock).toHaveBeenCalledWith(webhookInput);

      expect(queueAddMock).toHaveBeenCalledWith(
        "process-transaction",
        { transactionId: "txn_test_001" },
        { jobId: "txn_test_001" },
      );

      expect(result).toEqual({
        transactionId: "txn_test_001",
        duplicate: false,
      });
    });

    it("should enqueue an existing PENDING transaction without creating another record", async () => {
      findByTransactionIdMock.mockResolvedValue(pendingTransaction);
      queueAddMock.mockResolvedValue({});

      const result = await receiveTransactionWebhook(webhookInput);

      expect(createTransactionMock).not.toHaveBeenCalled();

      expect(queueAddMock).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        transactionId: "txn_test_001",
        duplicate: false,
      });
    });

    it("should not enqueue an already processed transaction", async () => {
      findByTransactionIdMock.mockResolvedValue(processedTransaction);

      const result = await receiveTransactionWebhook(webhookInput);

      expect(createTransactionMock).not.toHaveBeenCalled();
      expect(queueAddMock).not.toHaveBeenCalled();

      expect(result).toEqual({
        transactionId: "txn_test_001",
        duplicate: true,
      });
    });

    it("should recover when another request creates the transaction first", async () => {
      findByTransactionIdMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(pendingTransaction);

      createTransactionMock.mockRejectedValue(
        new Error("Unique constraint violation"),
      );

      queueAddMock.mockResolvedValue({});

      const result = await receiveTransactionWebhook(webhookInput);

      expect(findByTransactionIdMock).toHaveBeenCalledTimes(2);
      expect(queueAddMock).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        transactionId: "txn_test_001",
        duplicate: false,
      });
    });

    it("should propagate the original creation error if the transaction does not exist", async () => {
      const databaseError = new Error("Database unavailable");

      findByTransactionIdMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      createTransactionMock.mockRejectedValue(databaseError);

      await expect(receiveTransactionWebhook(webhookInput)).rejects.toBe(
        databaseError,
      );

      expect(queueAddMock).not.toHaveBeenCalled();
    });

    it("should propagate queue errors", async () => {
      findByTransactionIdMock.mockResolvedValue(null);
      createTransactionMock.mockResolvedValue(pendingTransaction);

      const queueError = new Error("Redis unavailable");
      queueAddMock.mockRejectedValue(queueError);

      await expect(receiveTransactionWebhook(webhookInput)).rejects.toBe(
        queueError,
      );
    });
  });

  describe("getTransactionById", () => {
    it("should return a serialized transaction", async () => {
      findByTransactionIdMock.mockResolvedValue(processedTransaction);

      const result = await getTransactionById("txn_test_001");

      expect(findByTransactionIdMock).toHaveBeenCalledWith("txn_test_001");

      expect(result).toEqual({
        transaction_id: "txn_test_001",
        source_account: "ACC001",
        destination_account: "ACC002",
        amount: 1500.5,
        currency: "INR",
        status: "PROCESSED",
        created_at: processedTransaction.createdAt,
        processed_at: processedTransaction.processedAt,
      });
    });

    it("should return null when the transaction does not exist", async () => {
      findByTransactionIdMock.mockResolvedValue(null);

      const result = await getTransactionById("txn_missing");

      expect(result).toBeNull();
    });
  });

  describe("getTransactions", () => {
    it("should return serialized transactions with pagination", async () => {
      const query = {
        page: 2,
        limit: 10,
        status: "PROCESSED",
      } as const;

      findTransactionsMock.mockResolvedValue({
        transactions: [processedTransaction],
        totalItems: 25,
      });

      const result = await getTransactions(query);

      expect(findTransactionsMock).toHaveBeenCalledWith(query);

      expect(result).toEqual({
        data: [
          {
            transaction_id: "txn_test_001",
            source_account: "ACC001",
            destination_account: "ACC002",
            amount: 1500.5,
            currency: "INR",
            status: "PROCESSED",
            created_at: processedTransaction.createdAt,
            processed_at: processedTransaction.processedAt,
          },
        ],
        pagination: {
          page: 2,
          limit: 10,
          total_items: 25,
          total_pages: 3,
        },
      });
    });

    it("should return an empty list when no transactions exist", async () => {
      const query = {
        page: 1,
        limit: 10,
      };

      findTransactionsMock.mockResolvedValue({
        transactions: [],
        totalItems: 0,
      });

      const result = await getTransactions(query);

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total_items: 0,
          total_pages: 0,
        },
      });
    });
  });
});
