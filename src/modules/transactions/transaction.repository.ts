import { transactionModel } from "../../models/transaction.model.js";
import type {
  TransactionListQuery,
  TransactionWebhookInput,
} from "./transaction.schema.js";

export async function findByTransactionId(transactionId: string) {
  return transactionModel.where({ transactionId }).first();
}

export async function findTransactions(query: TransactionListQuery) {
  const { limit, page, status } = query;
  const offset = (page - 1) * limit;
  const filters = status ? { status } : {};

  const [transactions, countResult] = await Promise.all([
    transactionModel
      .where(filters)
      .orderBy([(transaction) => transaction.createdAt.desc()])
      .limit(limit)
      .offset(offset)
      .all(),
    transactionModel.where(filters).aggregate((aggregate) => ({
      totalItems: aggregate.count(),
    })),
  ]);

  return {
    transactions,
    totalItems: countResult.totalItems,
  };
}

export async function createTransaction(input: TransactionWebhookInput) {
  return transactionModel.create({
    transactionId: input.transaction_id,
    sourceAccount: input.source_account,
    destinationAccount: input.destination_account,
    amount: input.amount.toFixed(2),
    currency: input.currency,
  });
}

export async function markAsProcessing(transactionId: string) {
  return transactionModel
    .where({ transactionId, status: "PENDING" })
    .update({ status: "PROCESSING" });
}

export async function markAsProcessed(transactionId: string) {
  return transactionModel
    .where({ transactionId, status: "PROCESSING" })
    .update({ status: "PROCESSED", processedAt: new Date() });
}

export async function markAsFailed(transactionId: string) {
  return transactionModel
    .where({ transactionId, status: "PROCESSING" })
    .update({ status: "FAILED", processedAt: new Date() });
}
