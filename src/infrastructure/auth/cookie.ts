import { CookieOptions } from "express";

export const SESSION_COOKIE = "w8st_token";

const isProd = process.env.NODE_ENV === "production";

// En producción (front y back en HTTPS, posiblemente en dominios distintos) usamos
// SameSite=None + Secure. En desarrollo (localhost) SameSite=Lax basta y no requiere HTTPS.
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  path: "/",
};
