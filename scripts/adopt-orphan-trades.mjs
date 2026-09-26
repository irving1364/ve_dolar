/* Migracion one-off: asigna los trades con userId=null al email indicado.
   Uso: node scripts/adopt-orphan-trades.mjs usuario@ejemplo.com */
try {
  process.loadEnvFile(".env");
} catch {
  // .env opcional en CI
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Uso: node scripts/adopt-orphan-trades.mjs usuario@ejemplo.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No existe ningun usuario con email ${email}`);
    process.exit(1);
  }

  const result = await prisma.trade.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  });
  console.log(`Trades huerfanos asignados a ${email}: ${result.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
