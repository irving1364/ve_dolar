export interface BestHoursRecord {
  price: number;
  buyVolume: number | null;
  sellVolume: number | null;
  fetchedAt: Date;
}

export interface BestHours {
  sellHours: { hour: number; price: number; buyVol: number }[];
  buyHours: { hour: number; price: number; sellVol: number }[];
}

/** Extrae la hora (VET) de una fecha. */
export function getVetHour(d: Date): number {
  return parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Caracas",
      hour: "numeric",
      hour12: false,
    }).format(d)
  );
}

/**
 * Calcula las mejores horas para comprar/vender USDT a partir del
 * histórico de la tasa paralela (últimos 30 días).
 */
export function computeBestHours(records: BestHoursRecord[]): BestHours | null {
  if (records.length < 24) return null;

  const hourlyMap: Record<
    number,
    { prices: number[]; buyVols: number[]; sellVols: number[]; count: number }
  > = {};

  for (const r of records) {
    const hour = getVetHour(new Date(r.fetchedAt));

    if (!hourlyMap[hour]) {
      hourlyMap[hour] = { prices: [], buyVols: [], sellVols: [], count: 0 };
    }

    hourlyMap[hour].prices.push(r.price);
    if (r.buyVolume) hourlyMap[hour].buyVols.push(r.buyVolume);
    if (r.sellVolume) hourlyMap[hour].sellVols.push(r.sellVolume);
    hourlyMap[hour].count++;
  }

  const hours = Object.entries(hourlyMap).map(([hourStr, data]) => {
    const hour = parseInt(hourStr);
    const avgPrice =
      data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
    const avgBuyVol =
      data.buyVols.length > 0
        ? data.buyVols.reduce((a, b) => a + b, 0) / data.buyVols.length
        : 0;
    const avgSellVol =
      data.sellVols.length > 0
        ? data.sellVols.reduce((a, b) => a + b, 0) / data.sellVols.length
        : 0;
    return { hour, avgPrice, avgBuyVol, avgSellVol };
  });

  const maxBuy = Math.max(...hours.map((h) => h.avgBuyVol), 1);
  const maxSell = Math.max(...hours.map((h) => h.avgSellVol), 1);
  const minPrice = Math.min(...hours.map((h) => h.avgPrice));
  const maxPrice = Math.max(...hours.map((h) => h.avgPrice));
  const priceRange = maxPrice - minPrice || 1;

  const scored = hours.map((h) => ({
    ...h,
    sellScore:
      (h.avgBuyVol / maxBuy) * 0.5 +
      ((h.avgPrice - minPrice) / priceRange) * 0.5,
    buyScore:
      (h.avgSellVol / maxSell) * 0.5 +
      (1 - (h.avgPrice - minPrice) / priceRange) * 0.5,
  }));

  const topSell = scored
    .sort((a, b) => b.sellScore - a.sellScore)
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, price: h.avgPrice, buyVol: h.avgBuyVol }));

  const topBuy = scored
    .sort((a, b) => b.buyScore - a.buyScore)
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, price: h.avgPrice, sellVol: h.avgSellVol }));

  return { sellHours: topSell, buyHours: topBuy };
}
