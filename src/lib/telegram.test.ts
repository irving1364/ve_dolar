import { describe, it, expect } from "vitest";
import {
  fmtNum,
  getHourLabel,
  buildBestHoursSection,
  buildExchangeComparisonSection,
  buildTargetReachedMessage,
  buildSellSignalMessage,
  buildBuySignalMessage,
  buildDailySummaryMessage,
} from "./telegram";
import type { ExchangeDepth } from "./exchanges";

const depths: ExchangeDepth[] = [
  {
    exchange: "binance",
    buyPrice: 845,
    sellPrice: 855,
    buyVolume: 1000,
    sellVolume: 2000,
    avgPrice: 850,
  },
  {
    exchange: "bybit",
    buyPrice: 840,
    sellPrice: 850,
    buyVolume: 100,
    sellVolume: 100,
    avgPrice: 845,
  },
  {
    exchange: "okx",
    buyPrice: 860,
    sellPrice: 870,
    buyVolume: 50,
    sellVolume: 50,
    avgPrice: 865,
  },
];

describe("fmtNum / getHourLabel", () => {
  it("formatea números en es-VE", () => {
    expect(fmtNum(845.5)).toBe("845,50");
  });
  it("formatea horas", () => {
    expect(getHourLabel(6)).toBe("06:00");
    expect(getHourLabel(23)).toBe("23:00");
  });
});

describe("buildExchangeComparisonSection", () => {
  it("resalta dónde comprar más barato y vender más caro", () => {
    const section = buildExchangeComparisonSection(depths);
    expect(section).toContain("Comparativa de Exchanges");
    expect(section).toContain("Binance");
    expect(section).toContain("Bybit");
    expect(section).toContain("OKX");
    expect(section).toContain("Comprar más barato:");
    expect(section).toContain("Bybit"); // 840 es el más barato
    expect(section).toContain("Vender más caro:");
    expect(section).toContain("OKX"); // 870 es la mejor venta
  });

  it("devuelve vacío con menos de 2 exchanges válidos", () => {
    expect(buildExchangeComparisonSection([depths[0]])).toBe("");
    expect(
      buildExchangeComparisonSection([
        { ...depths[0], sellPrice: 0 },
        depths[1],
      ])
    ).toBe("");
  });
});

describe("buildBestHoursSection", () => {
  it("devuelve vacío si no hay horas", () => {
    expect(buildBestHoursSection(null)).toBe("");
    expect(buildBestHoursSection({ sellHours: [], buyHours: [] })).toBe("");
  });

  it("listas las mejores horas", () => {
    const section = buildBestHoursSection({
      sellHours: [{ hour: 9, price: 1100, buyVol: 5000 }],
      buyHours: [{ hour: 18, price: 1000, sellVol: 4000 }],
    });
    expect(section).toContain("Mejores horas del día");
    expect(section).toContain("VENDER USDT");
    expect(section).toContain("09:00");
    expect(section).toContain("COMPRAR USDT");
    expect(section).toContain("18:00");
  });
});

describe("mensajes de señal", () => {
  const stats = {
    currentPrice: 850,
    avgPrice: 800,
    maxPrice: 860,
    minPrice: 780,
    pctAboveAvg: 6.25,
    buyVolume: 6000,
    sellVolume: 4000,
    totalVolume: 10000,
    sellPrice: 855,
    buyPrice: 845,
    isLiquid: true,
  };
  const now = new Date("2026-01-01T12:00:00Z");

  it("buildTargetReachedMessage incluye datos del trade", () => {
    const msg = buildTargetReachedMessage(
      { id: 3, type: "sell", amount: 100, targetPrice: 820 },
      800
    );
    expect(msg).toContain("Objetivo alcanzado");
    expect(msg).toContain("Venta #3");
    expect(msg).toContain("100.00");
  });

  it("buildSellSignalMessage fuerte incluye posible recompra", () => {
    const msg = buildSellSignalMessage(stats, "strong", now, "");
    expect(msg).toContain("SEÑAL FUERTE — VENDE USDT");
    expect(msg).toContain("Posible recompra objetivo");
  });

  it("buildBuySignalMessage suave incluye datos del mercado", () => {
    const msg = buildBuySignalMessage(stats, "soft", now, "");
    expect(msg).toContain("SEÑAL — COMPRA USDT");
    expect(msg).toContain("850");
  });
});

describe("buildDailySummaryMessage", () => {
  const base = {
    currentPrice: 850,
    avg48h: 820,
    max48h: 870,
    min48h: 800,
    pctVsAvg: 3.66,
    buyVolume: 5000,
    sellVolume: 6000,
    totalVolume: 11000,
    buyPrice: 845,
    sellPrice: 855,
    bcvPrice: 40,
    dailySignal: "✅ Vender",
    bestHoursSection: "MEJORES HORAS",
    exchangeSection: "COMPARATIVA",
    dateLabel: "31 JULIO 2026 VET",
  };

  it("arma el resumen completo con comparativa", () => {
    const msg = buildDailySummaryMessage(base);
    expect(msg).toContain("RESUMEN DIARIO");
    expect(msg).toContain("Tasa Paralelo: <b>850,00 VES</b>");
    expect(msg).toContain("BCV: <b>40,00 VES</b>");
    expect(msg).toContain("COMPARATIVA");
    expect(msg).toContain("MEJORES HORAS");
    expect(msg).toContain("Señal del día");
  });

  it("omite la línea BCV si no hay precio", () => {
    const msg = buildDailySummaryMessage({ ...base, bcvPrice: null });
    expect(msg).not.toContain("BCV:");
  });

  it("omite secciones vacías", () => {
    const msg = buildDailySummaryMessage({
      ...base,
      exchangeSection: "",
      bestHoursSection: "",
    });
    expect(msg).not.toContain("COMPARATIVA");
    expect(msg).not.toContain("MEJORES HORAS");
  });
});
