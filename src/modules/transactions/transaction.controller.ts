import type { Request, Response } from "express";

import {
  getTransactionById,
  getTransactions,
  receiveTransactionWebhook,
} from "./transaction.service.js";
import { sendError, sendSuccess } from "../../utils/api-response.js";

export async function receiveWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  await receiveTransactionWebhook(req.body);
  sendSuccess(res, { type: "message", message: "Webhook accepted" }, 202);
}

export async function getTransaction(
  req: Request,
  res: Response,
): Promise<void> {
  const transactionId = req.params.transactionId as string;
  const transaction = await getTransactionById(transactionId);

  if (!transaction) {
    sendError(
      res,
      { code: "TRANSACTION_NOT_FOUND", message: "Transaction not found" },
      404,
    );
    return;
  }

  sendSuccess(res, { type: "resource", success: true, data: transaction });
}

export async function listTransactions(
  _req: Request,
  res: Response,
): Promise<void> {
  const transactions = await getTransactions(res.locals.validatedQuery);

  sendSuccess(res, {
    type: "list",
    success: true,
    data: transactions.data,
    pagination: transactions.pagination,
  });
}
