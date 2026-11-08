import express from "express";
import { pinoHttp } from "pino-http";

import { logger } from "./lib/logger.js";
import { notFoundHandler } from "./middleware/not-found.middleware.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import transactionRouter from "./modules/transactions/transaction.route.js";

const app = express();

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "100kb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "HEALTHY",
    current_time: new Date().toISOString(),
  });
});

app.use("/v1", transactionRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
