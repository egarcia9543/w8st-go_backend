import jwt from "jsonwebtoken";

export interface SessionPayload {
  sub: string; // Google user id
  email: string;
  name?: string;
}

const getSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurado en el entorno.");
  return secret;
};

const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"];

export const signSession = (payload: SessionPayload): string => {
  return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN });
};

export const verifySession = (token: string): SessionPayload => {
  return jwt.verify(token, getSecret()) as SessionPayload;
};
