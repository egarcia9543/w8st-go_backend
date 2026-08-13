// Puerto de autenticación con Google. Una sola autorización resuelve dos cosas:
// quién es la persona (openid/email/profile) y el permiso para leer su Gmail
// (gmail.readonly), que es lo que /sync necesita.
//
// Separarlas dejaría un estado roto: alguien con sesión pero sin Gmail conectado
// ve una app vacía sin entender por qué. Esta app no hace nada sin el correo.

export interface GoogleIdentity {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GoogleAuthResult {
  identity: GoogleIdentity;
  tokens: GoogleTokens;
}

export class GoogleAuthError extends Error {}

export interface GoogleAuthProvider {
  /** URL de autorización de Google a la que redirigir el navegador. */
  getAuthUrl(): string;

  /**
   * Intercambia el `code` del callback por la identidad y los tokens.
   * No decide si esa persona puede entrar: de eso se encarga el caso de uso.
   */
  handleCallback(params: Record<string, string | undefined>): Promise<GoogleAuthResult>;
}
