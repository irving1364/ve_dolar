import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  const f = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return f.format(d);
}

export default async function HomePage() {
  const [paraleloRecords, recentRecords, latestParalelo] = await Promise.all([
    prisma.rate.findMany({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      take: 100,
      select: { price: true, fetchedAt: true },
    }),
    prisma.rate.findMany({
      orderBy: { fetchedAt: "desc" },
      take: 20,
      select: { source: true, price: true, buyPrice: true, sellPrice: true, buyVolume: true, sellVolume: true, fetchedAt: true },
    }),
    prisma.rate.findFirst({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      select: { buyPrice: true, sellPrice: true, buyVolume: true, sellVolume: true },
    }),
  ]);

  const latest = latestParalelo
    ? {
        buyPrice: latestParalelo.buyPrice,
        sellPrice: latestParalelo.sellPrice,
        buyVolume: latestParalelo.buyVolume,
        sellVolume: latestParalelo.sellVolume,
      }
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          VE Dólar
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Monitoreo de tasas USDT/VES · BCV y Paralelo
        </p>
      </header>

      <Dashboard
        latestMarket={latest}
        paraleloHistory={paraleloRecords.map((r) => ({
          price: r.price,
          time: fmt(r.fetchedAt),
        }))}
        recentRecords={recentRecords.map((r) => ({
          source: r.source,
          price: r.price,
          buyPrice: r.buyPrice ?? undefined,
          sellPrice: r.sellPrice ?? undefined,
          buyVolume: r.buyVolume ?? undefined,
          sellVolume: r.sellVolume ?? undefined,
          time: fmt(r.fetchedAt),
        }))}
      />
    </main>
  );
}
