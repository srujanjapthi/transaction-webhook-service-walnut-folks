import { z } from "zod";

export const transactionWebhookSchema = z.object({
  transaction_id: z.string().trim().min(1).max(100),
  source_account: z.string().trim().min(1).max(100),
  destination_account: z.string().trim().min(1).max(100),
  amount: z
    .number()
    .positive()
    .refine(
      (value) => Number.isInteger(value * 100),
      "Amount must have at most 2 decimal places",
    ),
  currency: z.string().regex(/^[A-Z]{3}$/, {
    error: "Currency must be a 3-letter uppercase code",
  }),
});

export type TransactionWebhookInput = z.infer<typeof transactionWebhookSchema>;

export const transactionListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["PENDING", "PROCESSING", "PROCESSED", "FAILED"]).optional(),
});

export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
