import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7")));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [entries, byBank] = await Promise.all([
    prisma.bankOpening.findMany({
      where: { date: { gte: since } },
      orderBy: [{ date: "desc" }, { time: "desc" }],
      take: 300,
    }),
    prisma.bankOpening.groupBy({
      by: ["bank"],
      where: { date: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { bank: "desc" } },
    }),
  ]);

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      bank: e.bank,
      mechanism: e.mechanism,
      time: e.time,
      duration: e.duration,
    })),
    summary: byBank.map((b) => ({ bank: b.bank, count: b._count._all })),
    days,
  });
}
