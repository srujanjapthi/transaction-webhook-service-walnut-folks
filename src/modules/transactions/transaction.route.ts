import { Router } from "express";

import {
  receiveWebhook,
  getTransaction,
  listTransactions,
} from "./transaction.controller.js";
import {
  validateQuery,
  validateRequest,
} from "../../middleware/validate.middleware.js";
import {
  transactionListQuerySchema,
  transactionWebhookSchema,
} from "./transaction.schema.js";

const transactionRouter = Router();

transactionRouter.post(
  "/webhooks/transactions",
  validateRequest(transactionWebhookSchema),
  receiveWebhook,
);

transactionRouter.get(
  "/transactions",
  validateQuery(transactionListQuerySchema),
  listTransactions,
);
transactionRouter.get("/transactions/:transactionId", getTransaction);

export default transactionRouter;
