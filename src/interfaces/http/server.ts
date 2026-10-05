import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.routes";
import { transactionRouter } from "./routes/transaction.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { cardsRouter } from "./routes/cards.routes";
import { emailsRouter } from "./routes/emails.routes";
import { wishlistRouter } from "./routes/wishlist.routes";
import { requireAuth } from "./middlewares/auth.middleware";
import { syncTransactions } from "../../application/use-cases/sync-transactions";
import { currentUserId } from "./current-user";

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
  app.use(analyticsRouter);
  app.use(cardsRouter);
  app.use(emailsRouter);
  app.use(wishlistRouter);

  app.post("/sync", requireAuth, async (req, res) => {
    const { since, limite } = req.query as { since?: string; limite?: string };

    // `since` en formato YYYY/MM/DD (operador `after:` de Gmail). Sin él se
    // recorre todo el histórico que devuelva la búsqueda, hasta `limite`.
    if (since && !/^\d{4}\/\d{2}\/\d{2}$/.test(since)) {
      return res.status(400).json({ error: "`since` debe ser YYYY/MM/DD." });
    }

    const parsedLimite = limite ? Number(limite) : undefined;
    if (parsedLimite !== undefined && (!Number.isFinite(parsedLimite) || parsedLimite < 1)) {
      return res.status(400).json({ error: "`limite` debe ser un número positivo." });
    }

    const result = await syncTransactions(currentUserId(req), {
      since,
      limite: parsedLimite,
    });
    res.json(result);
  });

  return app;
};
