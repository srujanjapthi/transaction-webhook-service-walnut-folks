import { transactionQueue } from "../../queues/transaction.queue.js";

import {
  findByTransactionId,
  createTransaction,
  findTransactions,
} from "./transaction.repository.js";

import type {
  TransactionListQuery,
  TransactionWebhookInput,
} from "./transaction.schema.js";

function serializeTransaction(
  transaction: Awaited<ReturnType<typeof findByTransactionId>>,
) {
  if (!transaction) {
    return null;
  }

  return {
    transaction_id: transaction.transactionId,
    source_account: transaction.sourceAccount,
    destination_account: transaction.destinationAccount,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    status: transaction.status,
    created_at: transaction.createdAt,
    processed_at: transaction.processedAt,
  };
}

export async function receiveTransactionWebhook(
  input: TransactionWebhookInput,
) {
  const transactionId = input.transaction_id;
  let transaction = await findByTransactionId(transactionId);

  if (!transaction) {
    try {
      transaction = await createTransaction(input);
    } catch (error) {
      transaction = await findByTransactionId(transactionId);
      if (!transaction) {
        throw error;
      }
    }
  }

  if (transaction.status !== "PENDING") {
    return { transactionId, duplicate: true };
  }

  await transactionQueue.add(
    "process-transaction",
    { transactionId },
    { jobId: transactionId },
  );

  return { transactionId, duplicate: false };
}

export async function getTransactionById(transactionId: string) {
  const transaction = await findByTransactionId(transactionId);

  return serializeTransaction(transaction);
}

export async function getTransactions(query: TransactionListQuery) {
  const { transactions, totalItems } = await findTransactions(query);

  return {
    data: transactions.map((transaction) => serializeTransaction(transaction)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total_items: totalItems,
      total_pages: Math.ceil(totalItems / query.limit),
    },
  };
}
