import { google, gmail_v1 } from "googleapis";
import { createOAuthClient } from "./gmail.client";
import prisma from "../database/prisma";

const buildAuthenticatedClient = async (userId: string) => {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { userId },
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
        where: { userId },
        data: {
          accessToken: tokens.access_token,
          expiresAt: new Date(tokens.expiry_date!),
        },
      });
    }
  });

  return client;
};

// Un solo remitente dejaba fuera las notificaciones que no salen de la dirección
// de alertas (nómina, consignaciones). El dominio base cubre los subdominios
// como an.notificacionesbancolombia.com.
const remitentes = (): string[] =>
  (process.env.GMAIL_SENDERS ?? "notificacionesbancolombia.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const construirQuery = (since?: string): string => {
  const from = `from:(${remitentes().join(" OR ")})`;
  return since ? `${from} after:${since}` : from;
};

export type FetchedEmail = {
  id: string;
  subject: string;
  fromAddress: string;
  snippet: string;
  receivedAt: Date;
  payload: gmail_v1.Schema$MessagePart | undefined;
};

const header = (payload: gmail_v1.Schema$MessagePart | undefined, nombre: string): string =>
  payload?.headers?.find((h) => h.name?.toLowerCase() === nombre.toLowerCase())?.value ?? "";

// Trae los IDs de TODOS los mensajes que coinciden, no los primeros 50.
// maxResults sin paginación dejaba el histórico viejo permanentemente fuera de
// alcance: por muchas veces que sincronizaras, siempre veías la misma ventana.
const listarIds = async (
  gmail: gmail_v1.Gmail,
  query: string,
  limite: number
): Promise<string[]> => {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const respuesta = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
      pageToken,
    });

    for (const msg of respuesta.data.messages ?? []) {
      if (msg.id) ids.push(msg.id);
    }

    pageToken = respuesta.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < limite);

  return ids.slice(0, limite);
};

// En lotes: un Promise.all sobre cientos de mensajes dispara rate limiting.
const enLotes = async <T, R>(
  items: T[],
  tamano: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const resultados: R[] = [];
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano);
    resultados.push(...(await Promise.all(lote.map(fn))));
  }
  return resultados;
};

export type FetchOptions = {
  /// Formato YYYY/MM/DD. Se traduce al operador `after:` de Gmail.
  /// Normalmente lo calcula syncTransactions (ventana de 30 días como tope);
  /// pasarlo explícitamente sirve para una carga puntual más profunda.
  since?: string;
  /// Red de seguridad, no la ventana normal. Con el `since` por defecto son
  /// ~40 correos y este tope nunca llega a aplicar; protege el caso de un
  /// `since` manual muy amplio (el buzón tiene ~2000 correos desde 2021).
  limite?: number;
};

export const fetchBancolombiaEmails = async (
  userId: string,
  options: FetchOptions = {}
): Promise<FetchedEmail[]> => {
  const { since, limite = 500 } = options;

  const auth = await buildAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const ids = await listarIds(gmail, construirQuery(since), limite);

  return enLotes(ids, 10, async (id) => {
    const full = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const payload = full.data.payload ?? undefined;

    // internalDate es epoch en milisegundos como string.
    const internal = full.data.internalDate;
    const receivedAt = internal ? new Date(Number(internal)) : new Date();

    return {
      id,
      subject: header(payload, "Subject"),
      fromAddress: header(payload, "From"),
      snippet: full.data.snippet ?? "",
      receivedAt,
      payload,
    };
  });
};

// Guarda el historyId actual del buzón. No lo usamos todavía para sincronizar
// incrementalmente, pero sin persistirlo esa optimización nunca va a ser
// posible: el historyId solo se puede obtener hacia adelante.
export const guardarHistoryId = async (userId: string): Promise<void> => {
  try {
    const auth = await buildAuthenticatedClient(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const perfil = await gmail.users.getProfile({ userId: "me" });
    const historyId = perfil.data.historyId;
    if (!historyId) return;

    await prisma.gmailSync.upsert({
      where: { userId },
      update: { historyId: String(historyId) },
      create: { userId, historyId: String(historyId) },
    });
  } catch (err) {
    // No es crítico: si falla, el próximo sync completo sigue funcionando.
    console.warn("[sync] No se pudo guardar el historyId:", err);
  }
};
