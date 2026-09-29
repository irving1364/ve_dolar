import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/DashboardLayout";
import { getEnabledExchanges } from "@/lib/exchanges";

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

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const exchanges = getEnabledExchanges();

  const [paraleloRecords, bcvRecords, recentRecords, latestParalelo] =
    await Promise.all([
      prisma.rate.findMany({
        where: { source: "paralelo", exchange: "binance" },
        orderBy: { fetchedAt: "desc" },
        take: 100,
        select: { price: true, fetchedAt: true },
      }),
      prisma.rate.findMany({
        where: { source: "bcv" },
        orderBy: { fetchedAt: "desc" },
        take: 100,
        select: { price: true, fetchedAt: true },
      }),
      prisma.rate.findMany({
        orderBy: { fetchedAt: "desc" },
        take: 20,
        select: { source: true, exchange: true, price: true, buyPrice: true, sellPrice: true, buyVolume: true, sellVolume: true, fetchedAt: true },
      }),
      prisma.rate.findFirst({
        where: { source: "paralelo", exchange: "binance" },
        orderBy: { fetchedAt: "desc" },
        select: { price: true, buyPrice: true, sellPrice: true, buyVolume: true, sellVolume: true },
      }),
    ]);

  const exchangeHistoryArrays = await Promise.all(
    exchanges.map((exchange) =>
      prisma.rate.findMany({
        where: { source: "paralelo", exchange },
        orderBy: { fetchedAt: "desc" },
        take: 100,
        select: { price: true, fetchedAt: true },
      })
    )
  );

  const latestExchangeArrays = await Promise.all(
    exchanges.map((exchange) =>
      prisma.rate.findFirst({
        where: { source: "paralelo", exchange },
        orderBy: { fetchedAt: "desc" },
        select: { price: true, buyPrice: true, sellPrice: true, buyVolume: true, sellVolume: true },
      })
    )
  );

  const latestBcv = await prisma.rate.findFirst({
    where: { source: "bcv" },
    orderBy: { fetchedAt: "desc" },
    select: { price: true },
  });

  const latestIntervencion = await prisma.rate.findFirst({
    where: { source: "intervencion" },
    orderBy: { fetchedAt: "desc" },
    select: { price: true },
  });

  const latest = latestParalelo
    ? {
        price: latestParalelo.price,
        buyPrice: latestParalelo.buyPrice,
        sellPrice: latestParalelo.sellPrice,
        buyVolume: latestParalelo.buyVolume,
        sellVolume: latestParalelo.sellVolume,
        bcvPrice: latestBcv?.price ?? null,
        intervencionPrice: latestIntervencion?.price ?? null,
      }
    : null;

  const exchangeHistory: Record<string, { price: number; time: string; ts: number }[]> = {};
  const latestExchanges = exchanges.map((exchange, i) => {
    const records = exchangeHistoryArrays[i] ?? [];
    exchangeHistory[exchange] = records.map((r) => ({
      price: r.price,
      time: fmt(r.fetchedAt),
      ts: r.fetchedAt.getTime(),
    }));

    const snap = latestExchangeArrays[i];
    if (!snap) return null;
    return {
      exchange,
      price: snap.price,
      buyPrice: snap.buyPrice ?? null,
      sellPrice: snap.sellPrice ?? null,
      buyVolume: snap.buyVolume ?? null,
      sellVolume: snap.sellVolume ?? null,
    };
  });

  const trades = userId
    ? await prisma.trade.findMany({
        where: { status: "open", userId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <DashboardLayout
      latestMarket={latest}
      paraleloHistory={paraleloRecords.map((r) => ({ price: r.price, time: fmt(r.fetchedAt), ts: r.fetchedAt.getTime() }))}
      exchangeHistory={exchangeHistory}
      latestExchanges={latestExchanges}
      recentRecords={recentRecords.map((r) => ({
        source: r.source,
        exchange: r.exchange ?? undefined,
        price: r.price,
        buyPrice: r.buyPrice ?? undefined,
        sellPrice: r.sellPrice ?? undefined,
        buyVolume: r.buyVolume ?? undefined,
        sellVolume: r.sellVolume ?? undefined,
        time: fmt(r.fetchedAt),
      }))}
      trades={trades.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        price: t.price,
        status: t.status,
        targetPrice: t.targetPrice,
        profit: t.profit,
        profitPct: t.profitPct,
        notes: t.notes,
        createdAt: t.createdAt.toISOString(),
        closedAt: t.closedAt?.toISOString() ?? null,
      }))}
      isAuthenticated={!!userId}
    />
  );
}
