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
      { prices: number[]; buyVolumes: number[]; sellVolumes: number[]; count: number }
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
        hourlyMap[hour] = { prices: [], buyVolumes: [], sellVolumes: [], count: 0 };
      }

      hourlyMap[hour].prices.push(r.price);
      if (r.buyVolume) hourlyMap[hour].buyVolumes.push(r.buyVolume);
      if (r.sellVolume) hourlyMap[hour].sellVolumes.push(r.sellVolume);
      hourlyMap[hour].count++;
    }

    const hourly = Object.entries(hourlyMap)
      .map(([hour, data]) => {
        const avgPrice =
          data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
        const avgBuyVolume =
          data.buyVolumes.length > 0
            ? data.buyVolumes.reduce((a, b) => a + b, 0) /
              data.buyVolumes.length
            : 0;
        const avgSellVolume =
          data.sellVolumes.length > 0
            ? data.sellVolumes.reduce((a, b) => a + b, 0) /
              data.sellVolumes.length
            : 0;
        const totalBuyVolume = data.buyVolumes.reduce(
          (a, b) => a + b,
          0
        );
        const totalSellVolume = data.sellVolumes.reduce(
          (a, b) => a + b,
          0
        );
        return {
          hour: parseInt(hour),
          avgPrice: parseFloat(avgPrice.toFixed(2)),
          avgVolume: parseFloat(avgBuyVolume.toFixed(0)),
          avgBuyVolume: parseFloat(avgBuyVolume.toFixed(0)),
          avgSellVolume: parseFloat(avgSellVolume.toFixed(0)),
          totalBuyVolume: parseFloat(totalBuyVolume.toFixed(0)),
          totalSellVolume: parseFloat(totalSellVolume.toFixed(0)),
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
