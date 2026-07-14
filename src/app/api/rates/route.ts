import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "week";
  const recordsPage = parseInt(searchParams.get("recordsPage") ?? "1");
  const recordsPerPage = 20;
  const tradesPage = parseInt(searchParams.get("tradesPage") ?? "1");
  const tradesPerPage = 10;
  const since = getRangeDate(range);
  const take = getTakeForRange(range);

  const [
    paraleloRecords,
    bcvRecords,
    recentRecords,
    recentTotal,
    latestParalelo,
    latestBcv,
    trades,
    tradesTotal,
  ] = await Promise.all([
    prisma.rate.findMany({
      where: { source: "paralelo", fetchedAt: { gte: since } },
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
      where: { source: "paralelo" },
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
    prisma.trade.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      skip: (tradesPage - 1) * tradesPerPage,
      take: tradesPerPage,
    }),
    prisma.trade.count({
      where: { status: "open" },
    }),
  ]);

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

  return NextResponse.json({
    paraleloHistory: paraleloRecords.map((r) => ({
      price: r.price,
      buyVolume: r.buyVolume ?? undefined,
      sellVolume: r.sellVolume ?? undefined,
      time: fmt(r.fetchedAt),
    })),
    bcvHistory: bcvRecords.map((r) => ({
      price: r.price,
      time: fmt(r.fetchedAt),
    })),
    recentRecords: recentRecords.map((r) => ({
      source: r.source,
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
