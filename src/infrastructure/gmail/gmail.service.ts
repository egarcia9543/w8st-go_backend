import { google } from "googleapis";
import { createOAuthClient } from "./gmail.client";
import prisma from "../database/prisma";

const buildAuthenticatedClient = async () => {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { id: "singleton" },
  });

  if (!tokenRecord) throw new Error("No hay tokens OAuth guardados. Completa el flujo /auth/google primero.");

  const client = createOAuthClient();
  client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken,
    expiry_date: tokenRecord.expiresAt.getTime(),
  });

  client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await prisma.oAuthToken.update({
        where: { id: "singleton" },
        data: {
          accessToken: tokens.access_token,
          expiresAt: new Date(tokens.expiry_date!),
        },
      });
    }
  });

  return client;
};

export const fetchBancolombiaEmails = async () => {
  const auth = await buildAuthenticatedClient();
  const gmail = google.gmail({ version: "v1", auth });

  const response = await gmail.users.messages.list({
    userId: "me",
    q: "from:alertasynotificaciones@an.notificacionesbancolombia.com",
    maxResults: 50,
  });

  const messages = response.data.messages || [];

  const emails = await Promise.all(
    messages.map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });
      return { id: msg.id!, payload: full.data.payload };
    })
  );

  return emails;
};
