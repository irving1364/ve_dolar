/* Backfill: asigna exchange="binance" a los registros "paralelo" existentes.
   Uso: npm run backfill:exchange */
try {
  process.loadEnvFile(".env");
} catch {
  // .env opcional en CI
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.rate.updateMany({
    where: {
      source: "paralelo",
      exchange: null,
    },
    data: { exchange: "binance" },
  });
  console.log(`Registros actualizados a exchange=binance: ${result.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
