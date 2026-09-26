export interface CloseProfit {
  profit: number;
  profitPct: number;
}

/**
 * Calcula ganancia al cerrar un trade usando el precio de mercado actual.
 * Venta: vendiste caro y recompras barato => profit = (precioVenta - precioActual) * cantidad.
 * Compra: compraste barato y vendes caro => profit = (precioActual - precioCompra) * cantidad.
 */
export function computeCloseProfit(
  type: "sell" | "buy",
  entryPrice: number,
  currentPrice: number,
  amount: number
): CloseProfit | null {
  if (currentPrice <= 0 || entryPrice <= 0) return null;

  if (type === "sell") {
    return {
      profit: (entryPrice - currentPrice) * amount,
      profitPct: ((entryPrice - currentPrice) / entryPrice) * 100,
    };
  }

  return {
    profit: (currentPrice - entryPrice) * amount,
    profitPct: ((currentPrice - entryPrice) / entryPrice) * 100,
  };
}
