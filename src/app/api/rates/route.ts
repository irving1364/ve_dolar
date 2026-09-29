import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getEnabledExchanges } from "@/lib/exchanges";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

function getRangeDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "3d":
      return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

function getTakeForRange(range: string): number {
  switch (range) {
    case "today":
      return 500;
    case "3d":
      return 1000;
    case "week":
      return 2000;
    case "month":
      return 5000;
    default:
      return 1000;
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "week";
  const recordsPage = parseInt(searchParams.get("recordsPage") ?? "1");
  const recordsPerPage = 20;
  const tradesPage = parseInt(searchParams.get("tradesPage") ?? "1");
  const tradesPerPage = 10;
  const since = getRangeDate(range);
  const take = getTakeForRange(range);
  const exchanges = getEnabledExchanges();

  const [
    paraleloRecords,
    bcvRecords,
    recentRecords,
    recentTotal,
    latestParalelo,
    latestBcv,
    latestIntervencion,
    trades,
    tradesTotal,
  ] = await Promise.all([
    prisma.rate.findMany({
      where: { source: "paralelo", exchange: "binance", fetchedAt: { gte: since } },
      orderBy: { fetchedAt: "desc" },
      take,
      select: { price: true, buyVolume: true, sellVolume: true, fetchedAt: true },
    }),
    prisma.rate.findMany({
      where: { source: "bcv", fetchedAt: { gte: since } },
      orderBy: { fetchedAt: "desc" },
      take,
      select: { price: true, fetchedAt: true },
    }),
    prisma.rate.findMany({
      where: { fetchedAt: { gte: since } },
      orderBy: { fetchedAt: "desc" },
      skip: (recordsPage - 1) * recordsPerPage,
      take: recordsPerPage,
      select: {
        source: true,
        exchange: true,
        price: true,
        buyPrice: true,
        sellPrice: true,
        buyVolume: true,
        sellVolume: true,
        fetchedAt: true,
      },
    }),
    prisma.rate.count({
      where: { fetchedAt: { gte: since } },
    }),
    prisma.rate.findFirst({
      where: { source: "paralelo", exchange: "binance" },
      orderBy: { fetchedAt: "desc" },
      select: {
        price: true,
        buyPrice: true,
        sellPrice: true,
        buyVolume: true,
        sellVolume: true,
      },
    }),
    prisma.rate.findFirst({
      where: { source: "bcv" },
      orderBy: { fetchedAt: "desc" },
      select: { price: true },
    }),
    prisma.rate.findFirst({
      where: { source: "intervencion" },
      orderBy: { fetchedAt: "desc" },
      select: { price: true },
    }),
    userId
      ? prisma.trade.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          skip: (tradesPage - 1) * tradesPerPage,
          take: tradesPerPage,
        })
      : Promise.resolve([]),
    userId ? prisma.trade.count({ where: { userId } }) : Promise.resolve(0),
  ]);

  const exchangeHistoryArrays = await Promise.all(
    exchanges.map((exchange) =>
      prisma.rate.findMany({
        where: { source: "paralelo", exchange, fetchedAt: { gte: since } },
        orderBy: { fetchedAt: "desc" },
        take,
        select: { price: true, buyPrice: true, sellPrice: true, fetchedAt: true },
      })
    )
  );

  const latestExchangeArrays = await Promise.all(
    exchanges.map((exchange) =>
      prisma.rate.findFirst({
        where: { source: "paralelo", exchange },
        orderBy: { fetchedAt: "desc" },
        select: {
          price: true,
          buyPrice: true,
          sellPrice: true,
          buyVolume: true,
          sellVolume: true,
        },
      })
    )
  );

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

  const exchangeHistory: Record<string, { price: number; time: string; ts: number }[]> = {};
  exchanges.forEach((exchange, i) => {
    exchangeHistory[exchange] = exchangeHistoryArrays[i].map((r) => ({
      price: r.price,
      time: fmt(r.fetchedAt),
      ts: r.fetchedAt.getTime(),
    }));
  });

  const latestExchanges = exchanges.map((exchange, i) => {
    const r = latestExchangeArrays[i];
    if (!r) return null;
    return {
      exchange,
      price: r.price,
      buyPrice: r.buyPrice ?? null,
      sellPrice: r.sellPrice ?? null,
      buyVolume: r.buyVolume ?? null,
      sellVolume: r.sellVolume ?? null,
    };
  });

  return NextResponse.json({
    paraleloHistory: paraleloRecords.map((r) => ({
      price: r.price,
      buyVolume: r.buyVolume ?? undefined,
      sellVolume: r.sellVolume ?? undefined,
      time: fmt(r.fetchedAt),
      ts: r.fetchedAt.getTime(),
    })),
    bcvHistory: bcvRecords.map((r) => ({
      price: r.price,
      time: fmt(r.fetchedAt),
    })),
    exchangeHistory,
    latestExchanges,
    recentRecords: recentRecords.map((r) => ({
      source: r.source,
      exchange: r.exchange ?? undefined,
      price: r.price,
      buyPrice: r.buyPrice ?? undefined,
      sellPrice: r.sellPrice ?? undefined,
      buyVolume: r.buyVolume ?? undefined,
      sellVolume: r.sellVolume ?? undefined,
      time: fmt(r.fetchedAt),
    })),
    recentTotal,
    recordsPage,
    recordsPerPage,
    totalPages: Math.ceil(recentTotal / recordsPerPage),
    latestMarket: latestParalelo
      ? {
          price: latestParalelo.price,
          buyPrice: latestParalelo.buyPrice,
          sellPrice: latestParalelo.sellPrice,
          buyVolume: latestParalelo.buyVolume,
          sellVolume: latestParalelo.sellVolume,
          bcvPrice: latestBcv?.price ?? null,
          intervencionPrice: latestIntervencion?.price ?? null,
        }
      : null,
    trades: trades.map((t) => ({
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
    })),
    tradesTotal,
    tradesPage,
    tradesPerPage,
    tradesTotalPages: Math.ceil(tradesTotal / tradesPerPage),
  });
}
