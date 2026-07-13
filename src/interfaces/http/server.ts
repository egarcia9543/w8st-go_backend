import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.routes";
import { transactionRouter } from "./routes/transaction.routes";
import { requireAuth } from "./middlewares/auth.middleware";
import { syncTransactions } from "../../application/use-cases/sync-transactions";

export const buildServer = () => {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:4200",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(authRouter);
  app.use(transactionRouter);
  app.post("/sync", requireAuth, async (_req, res) => {
    const result = await syncTransactions();
    res.json(result);
  });

  return app;
};
