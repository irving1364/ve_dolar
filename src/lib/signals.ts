import type { MarketStats } from "./telegram";

export interface RateHistoryPoint {
  price: number;
}

/**
 * Calcula las estadísticas de mercado usadas por las señales.
 * `latest` es el registro de referencia (Binance) y `history` las últimas ~48h.
 */
export function computeMarketStats(
  latest: { price: number; buyPrice?: number | null; sellPrice?: number | null; buyVolume?: number | null; sellVolume?: number | null } | null,
  history: RateHistoryPoint[]
): MarketStats | null {
  if (!latest || history.length < 10) return null;

  const currentPrice = latest.price;
  const avgPrice =
    history.reduce((s, r) => s + r.price, 0) / history.length;
  const maxPrice = Math.max(...history.map((r) => r.price));
  const minPrice = Math.min(...history.map((r) => r.price));
  const pctAboveAvg = ((currentPrice - avgPrice) / avgPrice) * 100;

  const buyVolume = latest.buyVolume ?? 0;
  const sellVolume = latest.sellVolume ?? 0;
  const totalVolume = buyVolume + sellVolume;
  const sellPrice = latest.sellPrice ?? 0;
  const buyPrice = latest.buyPrice ?? 0;
  const marketSpread = sellPrice - buyPrice;
  const marketSpreadPct = sellPrice > 0 ? (marketSpread / sellPrice) * 100 : 100;
  const isLiquid = marketSpreadPct < 0.3;

  return {
    currentPrice,
    avgPrice,
    maxPrice,
    minPrice,
    pctAboveAvg,
    buyVolume,
    sellVolume,
    totalVolume,
    sellPrice,
    buyPrice,
    isLiquid,
  };
}

export type SignalLevel = "strong_sell" | "sell" | "strong_buy" | "buy" | null;

/**
 * Evalúa la señal de mercado con los mismos umbrales de siempre
 * (referencia = Binance). Devuelve el nivel de la señal o null si no hay señal.
 */
export function evaluateSignal(stats: MarketStats): SignalLevel {
  if (
    stats.pctAboveAvg > 0.8 &&
    stats.buyVolume > 5000 &&
    stats.isLiquid &&
    stats.totalVolume > 15000
  ) {
    return "strong_sell";
  }
  if (stats.pctAboveAvg > 0.5 && stats.buyVolume > 3000 && stats.isLiquid) {
    return "sell";
  }
  if (
    stats.pctAboveAvg < -0.5 &&
    stats.sellVolume > 5000 &&
    stats.isLiquid &&
    stats.totalVolume > 15000
  ) {
    return "strong_buy";
  }
  if (stats.pctAboveAvg < -0.3 && stats.sellVolume > 3000 && stats.isLiquid) {
    return "buy";
  }
  return null;
}

/** Señal simple usada en el resumen diario (mismos umbrales base). */
export function dailySignalLabel(stats: MarketStats): string {
  const level = evaluateSignal(stats);
  switch (level) {
    case "strong_sell":
      return "🟢 Vender USDT";
    case "sell":
      return "✅ Vender";
    case "strong_buy":
      return "🟣 Comprar USDT";
    case "buy":
      return "✅ Comprar";
    default:
      return "⏸️ Esperar";
  }
}
