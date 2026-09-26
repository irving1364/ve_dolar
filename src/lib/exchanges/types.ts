export const P2P_EXCHANGES = ["binance", "bybit", "okx"] as const;

export type P2PExchange = (typeof P2P_EXCHANGES)[number];

export const EXCHANGE_LABELS: Record<P2PExchange, string> = {
  binance: "Binance",
  bybit: "Bybit",
  okx: "OKX",
};

/**
 * Profundidad normalizada de un exchange P2P (USDT/VES).
 *
 * Convención de precios (conservadora, igual para todos los exchanges):
 * - buyPrice: mejor (MENOR) precio de un vendedor de USDT => lo que pagas al COMPRAR USDT.
 * - sellPrice: mejor (MAYOR) precio de un comprador de USDT => lo que recibes al VENDER USDT.
 * - buyVolume / sellVolume: volumen USDT del lado de vendedores / compradores.
 * - avgPrice: precio promedio ponderado por volumen (ambos lados).
 */
export interface ExchangeDepth {
  exchange: P2PExchange;
  buyPrice: number;
  sellPrice: number;
  buyVolume: number;
  sellVolume: number;
  avgPrice: number;
}

export function getEnabledExchanges(): P2PExchange[] {
  const raw = process.env.P2P_EXCHANGES;
  if (!raw) return [...P2P_EXCHANGES];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is P2PExchange =>
      (P2P_EXCHANGES as readonly string[]).includes(s)
    );
}

export function isExchangeEnabled(exchange: P2PExchange): boolean {
  return getEnabledExchanges().includes(exchange);
}
