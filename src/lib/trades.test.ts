import { describe, it, expect } from "vitest";
import { computeCloseProfit } from "./trades";

describe("computeCloseProfit", () => {
  it("venta: ganancia = (precioVenta - precioActual) * cantidad", () => {
    const r = computeCloseProfit("sell", 850, 800, 100);
    expect(r).toEqual({ profit: 5000, profitPct: 5.88235294117647 });
  });

  it("compra: ganancia = (precioActual - precioCompra) * cantidad", () => {
    const r = computeCloseProfit("buy", 800, 850, 100);
    expect(r).toEqual({ profit: 5000, profitPct: 6.25 });
  });

  it("venta con pérdida cuando el precio sube", () => {
    const r = computeCloseProfit("sell", 800, 850, 100);
    expect(r!.profit).toBe(-5000);
  });

  it("devuelve null con precios inválidos", () => {
    expect(computeCloseProfit("sell", 0, 850, 100)).toBeNull();
    expect(computeCloseProfit("buy", 800, 0, 100)).toBeNull();
    expect(computeCloseProfit("buy", -1, 850, 100)).toBeNull();
  });
});
