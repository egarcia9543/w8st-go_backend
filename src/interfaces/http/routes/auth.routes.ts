import { Router, Request, Response } from "express";
import { getAuthUrl, createOAuthClient } from "../../../infrastructure/gmail/gmail.client";
import prisma from "../../../infrastructure/database/prisma";

export const authRouter = Router();

authRouter.get("/auth/google", (_req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

authRouter.get("/auth/callback", async (req: Request, res: Response) => {
  const { code } = req.query as { code: string };

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  await prisma.oAuthToken.upsert({
    where: { id: "singleton" },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    },
    create: {
      id: "singleton",
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
    },
  });

  res.json({ message: "Autenticación exitosa. Ya puedes cerrar esta ventana." });
});
