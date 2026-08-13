// Puerto (interfaz) de sesión: emite y verifica la sesión de la APP, con
// independencia de CÓMO se autenticó el usuario. Hoy se implementa con JWT
// propios (JwtSessionService); si mañana se cambia el mecanismo, solo cambia
// el adaptador, no las rutas ni el middleware.
import type { AuthenticatedUser } from "./user-authenticator";

export interface SessionPayload {
  sub: string; // id del usuario en la DB
  email: string;
  name?: string;
}

export interface SessionService {
  /** Emite el token de sesión a partir de un usuario ya autenticado. */
  issue(user: AuthenticatedUser): string;

  /** Verifica el token de sesión y devuelve su payload. Lanza si es inválido. */
  verify(token: string): SessionPayload;
}
