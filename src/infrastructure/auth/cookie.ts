import { CookieOptions } from "express";

export const SESSION_COOKIE = "w8st_token";

const isProd = process.env.NODE_ENV === "production";

// El front consume el backend a través de un proxy de mismo origen (Vercel rewrites:
// /api/* -> backend). Por eso la cookie es first-party y basta SameSite=Lax.
// En producción exigimos Secure (HTTPS); en desarrollo (localhost) no.
// Sin Domain explícito: la cookie toma el host desde el que responde (el del front vía proxy).
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  path: "/",
};
