// Seed del owner (app mono-usuario). Crea o actualiza la única cuenta con la que
// se inicia sesión, leyendo OWNER_EMAIL / OWNER_PASSWORD del entorno.
//
// Uso:  npm run seed        (requiere OWNER_EMAIL y OWNER_PASSWORD en el entorno/.env)
import "dotenv/config";
import prisma from "../src/infrastructure/database/prisma";
import { hashPassword } from "../src/infrastructure/auth/db-credentials.authenticator";

async function main() {
  const email = process.env.OWNER_EMAIL?.toLowerCase().trim();
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME;

  if (!email || !password) {
    throw new Error("Debes definir OWNER_EMAIL y OWNER_PASSWORD en el entorno para crear el owner.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Owner listo: ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
