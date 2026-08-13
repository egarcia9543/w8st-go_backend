import {
  GoogleAuthError,
  GoogleAuthProvider,
  GoogleAuthResult,
} from "../../application/ports/google-auth";
import { createOAuthClient, getAuthUrl } from "../gmail/gmail.client";

export class GoogleOAuthProvider implements GoogleAuthProvider {
  getAuthUrl(): string {
    return getAuthUrl();
  }

  async handleCallback(params: Record<string, string | undefined>): Promise<GoogleAuthResult> {
    const { code, error } = params;

    if (error) throw new GoogleAuthError(`Google devolvió un error: ${error}`);
    if (!code) throw new GoogleAuthError("Falta el parámetro 'code' en el callback.");

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.expiry_date) {
      throw new GoogleAuthError("Google no devolvió tokens completos.");
    }

    if (!tokens.id_token) {
      throw new GoogleAuthError("Google no devolvió id_token. Falta el scope 'openid'.");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new GoogleAuthError("El id_token no trae identidad utilizable.");
    }

    return {
      identity: {
        googleSub: payload.sub,
        email: payload.email.toLowerCase().trim(),
        emailVerified: payload.email_verified === true,
        name: payload.name,
        picture: payload.picture,
      },
      tokens: {
        accessToken: tokens.access_token,
        // Google solo devuelve refresh_token cuando hay consentimiento nuevo.
        // getAuthUrl fuerza prompt=consent, pero si algún día se relaja, este
        // campo llega vacío y hay que conservar el que ya estaba guardado.
        refreshToken: tokens.refresh_token ?? "",
        expiresAt: new Date(tokens.expiry_date),
      },
    };
  }
}
