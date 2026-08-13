// Adaptador de sesión basado en JWT propios. Implementa el puerto SessionService.
// Concentra la firma/verificación del token de sesión de la app.
import jwt from "jsonwebtoken";
import { SessionService, SessionPayload } from "../../application/ports/session-service";
import { AuthenticatedUser } from "../../application/ports/user-authenticator";

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado en el entorno.");
  return secret;
};

const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

export class JwtSessionService implements SessionService {
  issue(user: AuthenticatedUser): string {
    const payload: SessionPayload = { sub: user.id, email: user.email, name: user.name };
    return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN });
  }

  verify(token: string): SessionPayload {
    return jwt.verify(token, getSecret()) as SessionPayload;
  }
}
