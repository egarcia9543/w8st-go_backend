import { Router, Request, Response } from "express";
import { getAuthUrl, createOAuthClient } from "../../../infrastructure/gmail/gmail.client";
import { signSession } from "../../../infrastructure/auth/jwt.service";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../infrastructure/auth/cookie";
import { requireAuth } from "../middlewares/auth.middleware";
import prisma from "../../../infrastructure/database/prisma";

export const authRouter = Router();

authRouter.get("/auth/google", (_req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

authRouter.get("/auth/callback", async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };

  if (!code) {
    return res.status(400).json({ error: "Falta el parámetro 'code' en el callback." });
  }

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  // Verificar la identidad del usuario con el id_token de Google.
  if (!tokens.id_token) {
    return res.status(401).json({ error: "Google no devolvió un id_token. No se pudo verificar la identidad." });
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const profile = ticket.getPayload();

  if (!profile?.email || !profile.email_verified) {
    return res.status(401).json({ error: "No se pudo verificar el correo de la cuenta de Google." });
  }

  // App mono-usuario: solo el dueño (OWNER_EMAIL) puede iniciar sesión.
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail && profile.email.toLowerCase() !== ownerEmail.toLowerCase()) {
    return res.status(403).json({ error: "Esta cuenta no está autorizada para usar la aplicación." });
  }

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

  const sessionToken = signSession({
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
  });

  // El token viaja en una cookie httpOnly: el JS del front no lo puede leer.
  res.cookie(SESSION_COOKIE, sessionToken, sessionCookieOptions);

  // Si hay un frontend configurado, redirigimos a la app; si no, respondemos JSON (útil en pruebas).
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    return res.redirect(frontendUrl);
  }

  res.json({ message: "Autenticación exitosa." });
});

authRouter.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

authRouter.post("/auth/logout", (_req: Request, res: Response) => {
  // Limpia la cookie usando las mismas opciones con las que se creó.
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.json({ message: "Sesión cerrada." });
});
