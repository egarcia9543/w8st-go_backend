import { Request } from "express";

/**
 * Id del usuario de la petición. Lanza si falta, en vez de devolver undefined:
 * un `where: { userId: undefined }` en Prisma NO filtra nada y devolvería datos
 * de todos los usuarios en silencio. Preferimos un 500 ruidoso a una fuga.
 */
export const currentUserId = (req: Request): string => {
  const id = req.user?.sub;
  if (!id) {
    throw new Error("Ruta sin requireAuth: no hay usuario en la petición.");
  }
  return id;
};
