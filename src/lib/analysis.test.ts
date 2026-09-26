import { describe, it, expect } from "vitest";
import { getVetHour, computeBestHours } from "./analysis";
import type { BestHoursRecord } from "./analysis";

function record(vetHour: number, price: number, buyVol = 100, sellVol = 100): BestHoursRecord {
  // VET = UTC-4: la hora VET `h` corresponde a UTC h+4.
  return {
    price,
    buyVolume: buyVol,
    sellVolume: sellVol,
    fetchedAt: new Date(Date.UTC(2026, 0, 1, vetHour + 4, 0, 0)),
  };
}

describe("getVetHour", () => {
  it("convierte UTC a hora VET", () => {
    expect(getVetHour(new Date(Date.UTC(2026, 0, 1, 10, 0, 0)))).toBe(6);
    expect(getVetHour(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe(20);
  });
});

describe("computeBestHours", () => {
  it("devuelve null con menos de 24 registros", () => {
    expect(computeBestHours([])).toBeNull();
    expect(computeBestHours([record(0, 1000)])).toBeNull();
  });

  it("encuentra horas caras con demanda para vender y baratas con oferta para comprar", () => {
    const records: BestHoursRecord[] = [];
    for (let h = 0; h < 24; h++) {
      const isExpensive = h >= 12;
      records.push(
        record(
          h,
          isExpensive ? 1100 : 1000,
          h >= 6 && h < 10 ? 5000 : 100,
          h >= 14 && h < 18 ? 5000 : 100
        )
      );
    }

    const best = computeBestHours(records)!;
    expect(best.sellHours).toHaveLength(3);
    expect(best.buyHours).toHaveLength(3);

    best.sellHours.forEach((h) => expect(h.price).toBe(1100));
    best.buyHours.forEach((h) => expect(h.price).toBe(1000));

    expect(best.sellHours[0].hour).toBeGreaterThanOrEqual(12);
    expect(best.buyHours[0].hour).toBeLessThan(12);
  });
});
