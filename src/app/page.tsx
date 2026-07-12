import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function HomePage() {
  const [paraleloRecords, recentRecords] = await Promise.all([
    prisma.rate.findMany({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      take: 100,
      select: { price: true, fetchedAt: true },
    }),
    prisma.rate.findMany({
      orderBy: { fetchedAt: "desc" },
      take: 20,
      select: { source: true, price: true, fetchedAt: true },
    }),
  ]);

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
        paraleloHistory={paraleloRecords.map((r) => ({
          price: r.price,
          time: fmt(r.fetchedAt),
        }))}
        recentRecords={recentRecords.map((r) => ({
          source: r.source,
          price: r.price,
          time: fmt(r.fetchedAt),
        }))}
      />
    </main>
  );
}
