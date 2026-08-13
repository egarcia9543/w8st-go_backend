import {
  GoogleAuthError,
  GoogleAuthProvider,
  GoogleIdentity,
} from "../ports/google-auth";
import { AuthenticatedUser } from "../ports/user-authenticator";
import prisma from "../../infrastructure/database/prisma";

export class NotAllowedError extends Error {
  constructor(email: string) {
    super(`La cuenta ${email} no está autorizada para usar esta aplicación.`);
  }
}

/**
 * La app está publicada en Google: cualquier cuenta puede completar el consent.
 * Sin esta lista, cualquiera con el enlace crearía una cuenta y empezaría a
 * sincronizar su correo bancario contra nuestra base.
 *
 * Vive en ALLOWED_EMAILS (separados por coma) y no en el código: son correos
 * personales y cambiarlos no debería requerir un despliegue de código.
 */
const allowedEmails = (): string[] =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.toLowerCase().trim())
    .filter(Boolean);

export const isAllowed = (email: string): boolean => {
  const lista = allowedEmails();
  // Lista vacía = nadie entra. Un fallo de configuración no debe abrir la puerta.
  if (lista.length === 0) return false;
  return lista.includes(email.toLowerCase().trim());
};

const upsertUser = async (identity: GoogleIdentity): Promise<AuthenticatedUser> => {
  const user = await prisma.user.upsert({
    where: { email: identity.email },
    update: {
      googleSub: identity.googleSub,
      name: identity.name,
      picture: identity.picture,
    },
    create: {
      email: identity.email,
      googleSub: identity.googleSub,
      name: identity.name,
      picture: identity.picture,
    },
  });

  return { id: user.id, email: user.email, name: user.name ?? undefined };
};

export const signInWithGoogle = async (
  provider: GoogleAuthProvider,
  params: Record<string, string | undefined>
): Promise<AuthenticatedUser> => {
  const { identity, tokens } = await provider.handleCallback(params);

  if (!identity.emailVerified) {
    throw new GoogleAuthError("La cuenta de Google no tiene el correo verificado.");
  }

  if (!isAllowed(identity.email)) {
    throw new NotAllowedError(identity.email);
  }

  const user = await upsertUser(identity);

  // Sin refresh_token no se puede renovar el acceso: conservamos el anterior si
  // existe, en vez de sobrescribirlo con vacío y romper el sync del usuario.
  const existente = await prisma.oAuthToken.findUnique({ where: { userId: user.id } });
  const refreshToken = tokens.refreshToken || existente?.refreshToken;

  if (!refreshToken) {
    throw new GoogleAuthError(
      "Google no devolvió refresh_token y no hay uno guardado. Revoca el acceso en tu cuenta de Google y vuelve a entrar."
    );
  }

  await prisma.oAuthToken.upsert({
    where: { userId: user.id },
    update: { accessToken: tokens.accessToken, refreshToken, expiresAt: tokens.expiresAt },
    create: {
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken,
      expiresAt: tokens.expiresAt,
    },
  });

  return user;
};
