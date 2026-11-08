import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  where: vi.fn(),
  first: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  all: vi.fn(),
  aggregate: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../../src/models/transaction.model.js", () => ({
  transactionModel: {
    where: mocks.where,
    aggregate: mocks.aggregate,
    create: mocks.create,
  },
}));

import {
  findByTransactionId,
  findTransactions,
  createTransaction,
  markAsProcessing,
  markAsProcessed,
  markAsFailed,
} from "../../../src/modules/transactions/transaction.repository.js";

describe("Transaction Repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.where.mockReturnValue({
      first: mocks.first,
      update: mocks.update,
      orderBy: mocks.orderBy,
      aggregate: mocks.aggregate,
    });

    mocks.orderBy.mockReturnValue({
      limit: mocks.limit,
    });

    mocks.limit.mockReturnValue({
      offset: mocks.offset,
    });

    mocks.offset.mockReturnValue({
      all: mocks.all,
    });

    mocks.aggregate.mockResolvedValue({
      totalItems: 10,
    });
  });

  describe("findByTransactionId", () => {
    it("should find a transaction by its transaction ID", async () => {
      const transaction = { transactionId: "txn_123" };

      mocks.first.mockResolvedValue(transaction);

      const result = await findByTransactionId("txn_123");

      expect(mocks.where).toHaveBeenCalledWith({
        transactionId: "txn_123",
      });

      expect(result).toEqual(transaction);
    });

    it("should return null when transaction does not exist", async () => {
      mocks.first.mockResolvedValue(null);

      const result = await findByTransactionId("unknown");

      expect(result).toBeNull();
    });
  });

  describe("findTransactions", () => {
    it("should return paginated transactions", async () => {
      const transactions = [
        { transactionId: "txn_1" },
        { transactionId: "txn_2" },
      ];

      mocks.all.mockResolvedValue(transactions);

      const result = await findTransactions({
        page: 2,
        limit: 10,
      });

      expect(mocks.where).toHaveBeenCalledWith({});
      expect(mocks.limit).toHaveBeenCalledWith(10);
      expect(mocks.offset).toHaveBeenCalledWith(10);
      expect(mocks.all).toHaveBeenCalledOnce();

      expect(result).toEqual({
        transactions,
        totalItems: 10,
      });
    });

    it("should apply the status filter to the transaction query", async () => {
      mocks.all.mockResolvedValue([]);

      await findTransactions({
        page: 1,
        limit: 10,
        status: "PROCESSED",
      });

      expect(mocks.where).toHaveBeenCalledWith({
        status: "PROCESSED",
      });
    });

    it("should propagate database errors", async () => {
      mocks.all.mockRejectedValue(new Error("Database unavailable"));

      await expect(findTransactions({ page: 1, limit: 10 })).rejects.toThrow(
        "Database unavailable",
      );
    });
  });

  describe("createTransaction", () => {
    it("should create a transaction with the correct field mapping", async () => {
      const input = {
        transaction_id: "txn_123",
        source_account: "ACC001",
        destination_account: "ACC002",
        amount: 1500.5,
        currency: "INR",
      };

      const createdTransaction = {
        transactionId: "txn_123",
        amount: "1500.50",
      };

      mocks.create.mockResolvedValue(createdTransaction);

      const result = await createTransaction(input);

      expect(mocks.create).toHaveBeenCalledWith({
        transactionId: "txn_123",
        sourceAccount: "ACC001",
        destinationAccount: "ACC002",
        amount: "1500.50",
        currency: "INR",
      });

      expect(result).toEqual(createdTransaction);
    });

    it("should propagate database errors", async () => {
      mocks.create.mockRejectedValue(new Error("Insert failed"));

      await expect(
        createTransaction({
          transaction_id: "txn_123",
          source_account: "ACC001",
          destination_account: "ACC002",
          amount: 100,
          currency: "INR",
        }),
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("status updates", () => {
    it("should mark a PENDING transaction as PROCESSING", async () => {
      mocks.update.mockResolvedValue(1);

      const result = await markAsProcessing("txn_123");

      expect(mocks.where).toHaveBeenCalledWith({
        transactionId: "txn_123",
        status: "PENDING",
      });

      expect(mocks.update).toHaveBeenCalledWith({
        status: "PROCESSING",
      });

      expect(result).toBe(1);
    });

    it("should mark a PROCESSING transaction as PROCESSED", async () => {
      mocks.update.mockResolvedValue(1);

      await markAsProcessed("txn_123");

      expect(mocks.where).toHaveBeenCalledWith({
        transactionId: "txn_123",
        status: "PROCESSING",
      });

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PROCESSED",
          processedAt: expect.any(Date),
        }),
      );
    });

    it("should mark a PROCESSING transaction as FAILED", async () => {
      mocks.update.mockResolvedValue(1);

      await markAsFailed("txn_123");

      expect(mocks.where).toHaveBeenCalledWith({
        transactionId: "txn_123",
        status: "PROCESSING",
      });

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "FAILED",
          processedAt: expect.any(Date),
        }),
      );
    });

    it("should return zero when no transaction matches the update condition", async () => {
      mocks.update.mockResolvedValue(0);

      const result = await markAsProcessing("txn_123");

      expect(result).toBe(0);
    });

    it("should propagate database errors during status updates", async () => {
      mocks.update.mockRejectedValue(new Error("Update failed"));

      await expect(markAsProcessing("txn_123")).rejects.toThrow(
        "Update failed",
      );
    });
  });
});
