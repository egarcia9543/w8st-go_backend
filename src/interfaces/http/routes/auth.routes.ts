import { Router, Request, Response } from "express";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../infrastructure/auth/cookie";
import { requireAuth } from "../middlewares/auth.middleware";
import { userAuthenticator, sessionService, googleAuthProvider } from "../../../infrastructure/auth";
import { InvalidCredentialsError } from "../../../application/ports/user-authenticator";
import { GoogleAuthError } from "../../../application/ports/google-auth";
import { NotAllowedError, signInWithGoogle } from "../../../application/use-cases/sign-in-with-google";

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

// --- Login con Google ---
// Una sola autorización resuelve identidad y permiso de lectura de Gmail.
// NO lleva requireAuth: es justamente la puerta de entrada.
authRouter.get("/auth/google", (_req: Request, res: Response) => {
  res.redirect(googleAuthProvider.getAuthUrl());
});

authRouter.get("/auth/callback", async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL;

  try {
    const user = await signInWithGoogle(
      googleAuthProvider,
      req.query as Record<string, string | undefined>
    );

    res.cookie(SESSION_COOKIE, sessionService.issue(user), sessionCookieOptions);
    return frontendUrl ? res.redirect(frontendUrl) : res.json({ user });
  } catch (err) {
    if (err instanceof NotAllowedError) {
      return frontendUrl
        ? res.redirect(`${frontendUrl}/login?error=not_allowed`)
        : res.status(403).json({ error: err.message });
    }

    if (err instanceof GoogleAuthError) {
      return frontendUrl
        ? res.redirect(`${frontendUrl}/login?error=google`)
        : res.status(400).json({ error: err.message });
    }

    throw err;
  }
});
