import { db } from "../prisma/db.js";

export const transactionModel = db.orm.public.Transaction;
