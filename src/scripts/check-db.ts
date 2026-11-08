import { db } from "../prisma/db.js";
import { logger } from "../lib/logger.js";

async function main(): Promise<void> {
  try {
    const transactions = await db.orm.public.Transaction.all();

    logger.info(
      { transactionCount: transactions.length },
      "Database connection verified successfully",
    );
  } catch (error) {
    logger.error({ err: error }, "Database connection failed");
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

await main();
