import { Router, Request, Response } from "express";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../infrastructure/auth/cookie";
import { requireAuth } from "../middlewares/auth.middleware";
import { userAuthenticator, sessionService, gmailConnector } from "../../../infrastructure/auth";
import { InvalidCredentialsError } from "../../../application/ports/user-authenticator";

export const authRouter = Router();

// --- Login propio (usuarios en nuestra DB) ---
authRouter.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = (req.body ?? {}) as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Faltan email o password." });
  }

  try {
    const user = await userAuthenticator.authenticate(email, password);
    const token = sessionService.issue(user);

    // El token viaja en una cookie httpOnly: el JS del front no lo puede leer.
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions);
    return res.json({ user: { email: user.email, name: user.name } });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }
    throw err;
  }
});

authRouter.get("/auth/me", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

authRouter.post("/auth/logout", (_req: Request, res: Response) => {
  // Limpia la cookie usando las mismas opciones con las que se creó.
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
  res.json({ message: "Sesión cerrada." });
});

// --- Conexión de Gmail (NO es login): autoriza el acceso que /sync necesita. ---
// Protegido: solo el owner ya autenticado puede conectar Gmail.
authRouter.get("/auth/google", requireAuth, (_req: Request, res: Response) => {
  res.redirect(gmailConnector.getAuthUrl());
});

authRouter.get("/auth/callback", requireAuth, async (req: Request, res: Response) => {
  try {
    await gmailConnector.handleCallback(req.query as Record<string, string | undefined>);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo conectar Gmail.";
    return res.status(400).json({ error: message });
  }

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    return res.redirect(frontendUrl);
  }
  res.json({ message: "Gmail conectado correctamente." });
});
