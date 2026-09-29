/* Corre localmente (tu IP residencial, no bloqueada por Cloudflare) y
   guarda las aperturas de bancos + la tasa de intervencion real en la
   base de datos de PRODUCCION.

   Antes de usarlo, crea un archivo .env.aperturas.local (nunca se sube a
   git) en la raiz del proyecto con una sola linea:
     DATABASE_URL="<url-de-produccion-copiada-de-vercel>"

   Uso manual:   npm run sync:aperturas
   Uso programado: agrega una tarea en el Programador de Tareas de
   Windows que corra "npm run sync:aperturas" en esta carpeta, todos
   los dias (o cada pocas horas). */
try {
  process.loadEnvFile(".env.aperturas.local");
} catch {
  console.error(
    "Falta .env.aperturas.local con DATABASE_URL de produccion. Ver comentario al inicio de este script."
  );
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APERTURAS_URL = "https://hdavzla.com/app/aperturas";
const TASAS_ACTUAL_URL = "https://hdavzla.com/api/portal/tasas/actual";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function parseAperturasHtml(html) {
  const cards = html.match(/<li[^>]*>\s*<dl[^>]*>[\s\S]*?<\/dl>\s*<\/li>/g) ?? [];
  const entries = [];

  for (const card of cards) {
    const spans = [...card.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) =>
      m[1].trim()
    );
    if (spans.length < 4) continue;

    const [dateStr, bank, mechanism, time, duration] = spans;
    if (!dateStr || !bank || !mechanism || !time) continue;

    const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dateMatch) continue;
    const [, day, month, year] = dateMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    entries.push({ dateStr, date, bank, mechanism, time, duration: duration || null });
  }

  return entries;
}

function todayVetDateStr() {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const parts = fmt.formatToParts(new Date());
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  return `${day}/${month}/${year}`;
}

async function fetchTodayAperturas() {
  const res = await fetch(APERTURAS_URL, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer aperturas`);

  const html = await res.text();
  const all = parseAperturasHtml(html);
  const today = todayVetDateStr();
  return all.filter((e) => e.dateStr === today);
}

async function fetchIntervencionRate() {
  const res = await fetch(TASAS_ACTUAL_URL, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer tasas/actual`);

  const data = await res.json();
  const row = data.data?.find((d) => d.moneda === "INTERVENCION");
  return row && isFinite(row.valor) && row.valor > 0 ? row.valor : null;
}

async function main() {
  const todayAperturas = await fetchTodayAperturas();
  for (const entry of todayAperturas) {
    await prisma.bankOpening.upsert({
      where: {
        date_bank_mechanism_time: {
          date: entry.date,
          bank: entry.bank,
          mechanism: entry.mechanism,
          time: entry.time,
        },
      },
      create: {
        date: entry.date,
        bank: entry.bank,
        mechanism: entry.mechanism,
        time: entry.time,
        duration: entry.duration,
      },
      update: { duration: entry.duration },
    });
  }
  console.log(`Aperturas guardadas/actualizadas: ${todayAperturas.length}`);

  const intervencionRate = await fetchIntervencionRate();
  if (intervencionRate) {
    await prisma.rate.create({ data: { source: "intervencion", price: intervencionRate } });
    console.log(`Tasa de intervencion guardada: ${intervencionRate}`);
  } else {
    console.warn("No se encontro tasa INTERVENCION en la respuesta.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
