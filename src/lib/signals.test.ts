import { describe, it, expect } from "vitest";
import {
  computeMarketStats,
  evaluateSignal,
  dailySignalLabel,
} from "./signals";
import type { MarketStats } from "./telegram";

const history = Array.from({ length: 10 }, (_, i) => ({ price: 1000 + i }));

function makeLatest(overrides: Partial<MarketStats> = {}): MarketStats {
  return {
    currentPrice: 1010,
    avgPrice: 1004.5,
    maxPrice: 1009,
    minPrice: 1000,
    pctAboveAvg: 0.55,
    buyVolume: 4000,
    sellVolume: 4000,
    totalVolume: 8000,
    sellPrice: 1005.5,
    buyPrice: 1005,
    isLiquid: true,
    ...overrides,
  };
}

describe("computeMarketStats", () => {
  it("devuelve null sin histórico suficiente", () => {
    expect(computeMarketStats(null, history)).toBeNull();
    expect(computeMarketStats({ price: 1000 }, [])).toBeNull();
  });

  it("calcula pctAboveAvg y volumenes", () => {
    const stats = computeMarketStats({ price: 1010 }, history)!;
    expect(stats.pctAboveAvg).toBeCloseTo(0.55);
    expect(stats.avgPrice).toBeCloseTo(1004.5);
    expect(stats.minPrice).toBe(1000);
    expect(stats.maxPrice).toBe(1009);
  });

  it("marca mercado ilíquido cuando el spread es grande", () => {
    const stats = computeMarketStats(
      { price: 1000, buyPrice: 900, sellPrice: 1000, buyVolume: 100, sellVolume: 100 },
      history
    )!;
    expect(stats.isLiquid).toBe(false);
  });
});

describe("evaluateSignal", () => {
  it("strong_sell cuando está muy por encima del promedio con demanda", () => {
    const stats = makeLatest({
      pctAboveAvg: 1.0,
      buyVolume: 6000,
      totalVolume: 20000,
    });
    expect(evaluateSignal(stats)).toBe("strong_sell");
    expect(dailySignalLabel(stats)).toBe("🟢 Vender USDT");
  });

  it("sell cuando sube moderadamente", () => {
    const stats = makeLatest({ pctAboveAvg: 0.6, buyVolume: 4000 });
    expect(evaluateSignal(stats)).toBe("sell");
    expect(dailySignalLabel(stats)).toBe("✅ Vender");
  });

  it("strong_buy cuando está muy por debajo del promedio con oferta", () => {
    const stats = makeLatest({
      pctAboveAvg: -1.0,
      sellVolume: 6000,
      totalVolume: 20000,
    });
    expect(evaluateSignal(stats)).toBe("strong_buy");
    expect(dailySignalLabel(stats)).toBe("🟣 Comprar USDT");
  });

  it("buy cuando baja moderadamente", () => {
    const stats = makeLatest({ pctAboveAvg: -0.4, sellVolume: 4000 });
    expect(evaluateSignal(stats)).toBe("buy");
    expect(dailySignalLabel(stats)).toBe("✅ Comprar");
  });

  it("null cuando el mercado está estable", () => {
    const stats = makeLatest({ pctAboveAvg: 0.1 });
    expect(evaluateSignal(stats)).toBeNull();
    expect(dailySignalLabel(stats)).toBe("⏸️ Esperar");
  });

  it("no emite señal si el mercado es ilíquido", () => {
    const stats = makeLatest({ pctAboveAvg: 1.0, buyVolume: 6000, isLiquid: false });
    expect(evaluateSignal(stats)).toBeNull();
  });
});
