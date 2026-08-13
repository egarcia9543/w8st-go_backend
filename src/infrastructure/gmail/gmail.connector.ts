// Adaptador del conector de Gmail (Google OAuth). Implementa el puerto GmailConnector.
// Su ÚNICA responsabilidad es autorizar el acceso a Gmail y persistir los tokens
// que /sync usa para leer los correos de Bancolombia. Ya NO autentica al usuario.
import { GmailConnector } from "../../application/ports/gmail-connector";
import { getAuthUrl, createOAuthClient } from "./gmail.client";
import prisma from "../database/prisma";

export class GoogleGmailConnector implements GmailConnector {
  getAuthUrl(): string {
    return getAuthUrl();
  }

  async handleCallback(params: Record<string, string | undefined>): Promise<void> {
    const { code } = params;
    if (!code) {
      throw new Error("Falta el parámetro 'code' en el callback.");
    }

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new Error("Google no devolvió tokens completos. Reintenta la conexión de Gmail.");
    }

    await prisma.oAuthToken.upsert({
      where: { id: "singleton" },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
      },
      create: {
        id: "singleton",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
      },
    });
  }
}
