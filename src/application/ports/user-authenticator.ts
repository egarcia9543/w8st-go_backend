// Puerto (interfaz) de autenticación de usuarios: describe QUÉ necesita la app
// para verificar credenciales, sin acoplarse a CÓMO se almacenan/verifican.
// Hoy el adaptador consulta la DB con contraseña hasheada (DbCredentialsAuthenticator);
// mañana podría ser LDAP, un IdP externo, etc., sin tocar rutas ni middleware.

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Credenciales inválidas.");
    this.name = "InvalidCredentialsError";
  }
}

export interface UserAuthenticator {
  /**
   * Verifica email + contraseña y devuelve el usuario autenticado.
   * Lanza InvalidCredentialsError si no coinciden.
   */
  authenticate(email: string, password: string): Promise<AuthenticatedUser>;
}
