export interface SideSummary {
  avgPrice: number;
  totalVolume: number;
  bestPrice: number;
}

export interface AdEntry {
  price: number;
  amount: number;
}

/**
 * Resume un lado del libro P2P descartando ads basura (precios extremos).
 * Calcula la mediana de precios y se queda con los anuncios dentro de ±bandPct
 * de la mediana (default 12%). Esto elimina ads fraudulentos/atípicos.
 *
 * - side "buyers": anunciantes que COMPRAN (el usuario vende) -> best = máximo.
 * - side "sellers": anunciantes que VENDEN (el usuario compra) -> best = mínimo.
 */
export function summarizeAds(
  entries: AdEntry[],
  side: "buyers" | "sellers",
  bandPct = 0.12
): SideSummary {
  const valid = entries.filter(
    (e) =>
      isFinite(e.price) &&
      isFinite(e.amount) &&
      e.price > 0 &&
      e.amount > 0
  );
  if (valid.length === 0) {
    return { avgPrice: 0, totalVolume: 0, bestPrice: 0 };
  }

  const prices = valid.map((e) => e.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const lo = median * (1 - bandPct);
  const hi = median * (1 + bandPct);

  let totalPriceVol = 0;
  let totalVolume = 0;
  let best = side === "buyers" ? 0 : Infinity;

  for (const e of valid) {
    if (e.price < lo || e.price > hi) continue;
    totalPriceVol += e.price * e.amount;
    totalVolume += e.amount;
    if (side === "buyers" && e.price > best) best = e.price;
    if (side === "sellers" && e.price < best) best = e.price;
  }

  return {
    avgPrice: totalVolume > 0 ? totalPriceVol / totalVolume : 0,
    totalVolume,
    bestPrice: best === Infinity ? 0 : best,
  };
}

export function weightedAvg(
  a: { avgPrice: number; totalVolume: number },
  b: { avgPrice: number; totalVolume: number }
): number {
  const total = a.totalVolume + b.totalVolume;
  if (total <= 0) return 0;
  return (a.avgPrice * a.totalVolume + b.avgPrice * b.totalVolume) / total;
}

/** Precio medio de mercado: promedio de la mejor compra y mejor venta. */
export function midMarketPrice(buyPrice: number, sellPrice: number): number {
  if (buyPrice > 0 && sellPrice > 0) return (buyPrice + sellPrice) / 2;
  return buyPrice > 0 ? buyPrice : sellPrice;
}
