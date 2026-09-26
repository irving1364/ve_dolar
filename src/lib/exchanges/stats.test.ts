import { describe, it, expect } from "vitest";
import {
  summarizeAds,
  weightedAvg,
  midMarketPrice,
} from "./stats";

describe("summarizeAds", () => {
  it("descarta ads basura (fuera de ±12% de la mediana)", () => {
    const entries = [
      { price: 800, amount: 1 },
      { price: 810, amount: 2 },
      { price: 820, amount: 1 },
      { price: 2450, amount: 5 },
      { price: 600, amount: 5 },
    ];

    const sellers = summarizeAds(entries, "sellers");
    expect(sellers.bestPrice).toBe(800);
    expect(sellers.totalVolume).toBe(4);
    expect(sellers.avgPrice).toBe(810);

    const buyers = summarizeAds(entries, "buyers");
    expect(buyers.bestPrice).toBe(820);
    expect(buyers.totalVolume).toBe(4);
  });

  it("devuelve ceros si no hay anuncios válidos", () => {
    const empty = summarizeAds([], "sellers");
    expect(empty).toEqual({ avgPrice: 0, totalVolume: 0, bestPrice: 0 });

    const invalid = summarizeAds(
      [
        { price: 0, amount: 1 },
        { price: NaN, amount: 1 },
        { price: 100, amount: 0 },
      ],
      "buyers"
    );
    expect(invalid).toEqual({ avgPrice: 0, totalVolume: 0, bestPrice: 0 });
  });

  it("mantiene la mediana como centro de la banda", () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({
      price: 800 + i,
      amount: 1,
    }));
    const s = summarizeAds(entries, "sellers");
    expect(s.bestPrice).toBe(800);
    expect(s.totalVolume).toBe(21);
  });

  it("calcula el promedio ponderado por volumen dentro de la banda", () => {
    const entries = [
      { price: 1000, amount: 3 },
      { price: 1100, amount: 1 },
    ];
    const s = summarizeAds(entries, "sellers");
    expect(s.avgPrice).toBe(1025);
    expect(s.totalVolume).toBe(4);
  });
});

describe("weightedAvg", () => {
  it("combina dos lados ponderando por volumen", () => {
    expect(
      weightedAvg(
        { avgPrice: 1000, totalVolume: 300 },
        { avgPrice: 1100, totalVolume: 100 }
      )
    ).toBe(1025);
  });

  it("devuelve 0 si el volumen total es 0", () => {
    expect(
      weightedAvg({ avgPrice: 100, totalVolume: 0 }, { avgPrice: 200, totalVolume: 0 })
    ).toBe(0);
  });
});

describe("midMarketPrice", () => {
  it("promedia mejor compra y mejor venta", () => {
    expect(midMarketPrice(840, 860)).toBe(850);
  });

  it("hace fallback al único precio disponible", () => {
    expect(midMarketPrice(0, 860)).toBe(860);
    expect(midMarketPrice(840, 0)).toBe(840);
    expect(midMarketPrice(0, 0)).toBe(0);
  });
});
