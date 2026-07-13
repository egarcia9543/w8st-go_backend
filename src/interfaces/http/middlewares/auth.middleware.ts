import { Request, Response, NextFunction } from "express";
import { verifySession, SessionPayload } from "../../../infrastructure/auth/jwt.service";
import { SESSION_COOKIE } from "../../../infrastructure/auth/cookie";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Prioridad: cookie httpOnly; fallback al header Bearer (útil para pruebas con curl).
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;

  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: "No autenticado. Falta la sesión." });
  }

  try {
    req.user = verifySession(token);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
};
