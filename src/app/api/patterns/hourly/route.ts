import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    const records = await prisma.rate.findMany({
      where: {
        source: "paralelo",
        fetchedAt: { gte: thirtyDaysAgo },
      },
      select: { price: true, buyVolume: true, sellVolume: true, fetchedAt: true },
      orderBy: { fetchedAt: "asc" },
    });

    if (records.length === 0) {
      return NextResponse.json({ hourly: [] });
    }

    const hourlyMap: Record<
      number,
      { prices: number[]; volumes: number[]; count: number }
    > = {};

    for (const r of records) {
      const hour = parseInt(
        new Intl.DateTimeFormat("en", {
          timeZone: "America/Caracas",
          hour: "numeric",
          hour12: false,
        }).format(new Date(r.fetchedAt))
      );

      if (!hourlyMap[hour]) {
        hourlyMap[hour] = { prices: [], volumes: [], count: 0 };
      }

      hourlyMap[hour].prices.push(r.price);
      if (r.buyVolume) hourlyMap[hour].volumes.push(r.buyVolume);
      hourlyMap[hour].count++;
    }

    const hourly = Object.entries(hourlyMap)
      .map(([hour, data]) => {
        const avgPrice =
          data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
        const avgVolume =
          data.volumes.length > 0
            ? data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length
            : 0;
        return {
          hour: parseInt(hour),
          avgPrice: parseFloat(avgPrice.toFixed(2)),
          avgVolume: parseFloat(avgVolume.toFixed(0)),
          count: data.count,
          minPrice: parseFloat(Math.min(...data.prices).toFixed(2)),
          maxPrice: parseFloat(Math.max(...data.prices).toFixed(2)),
        };
      })
      .sort((a, b) => a.hour - b.hour);

    return NextResponse.json({ hourly });
  } catch (err) {
    console.error("Error en /api/patterns/hourly:", err);
    return NextResponse.json(
      { error: "Error al calcular patrones horarios" },
      { status: 500 }
    );
  }
}
