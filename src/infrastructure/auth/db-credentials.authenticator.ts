// Adaptador de autenticación por credenciales contra la DB. Implementa el puerto
// UserAuthenticator usando Prisma + bcrypt. Es el "nosotros hacemos el auth".
import bcrypt from "bcryptjs";
import {
  UserAuthenticator,
  AuthenticatedUser,
  InvalidCredentialsError,
} from "../../application/ports/user-authenticator";
import prisma from "../database/prisma";

const BCRYPT_ROUNDS = 12;

/** Genera el hash de una contraseña (lo usa el seed del owner). */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

export class DbCredentialsAuthenticator implements UserAuthenticator {
  async authenticate(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Comparamos siempre contra un hash (real o dummy) para no filtrar por tiempo
    // si el email existe o no.
    const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      throw new InvalidCredentialsError();
    }

    return { id: user.id, email: user.email, name: user.name ?? undefined };
  }
}
