import { fetchBinanceDepth } from "./binance";
import { fetchBybitDepth } from "./bybit";
import { fetchOkxDepth } from "./okx";
import {
  EXCHANGE_LABELS,
  P2P_EXCHANGES,
  getEnabledExchanges,
  isExchangeEnabled,
} from "./types";
import type { ExchangeDepth, P2PExchange } from "./types";

export {
  EXCHANGE_LABELS,
  P2P_EXCHANGES,
  getEnabledExchanges,
  isExchangeEnabled,
};
export type { ExchangeDepth, P2PExchange };
export { fetchBinanceDepth, fetchBybitDepth, fetchOkxDepth };

export const DEPTH_FETCHERS: Record<P2PExchange, () => Promise<ExchangeDepth>> = {
  binance: fetchBinanceDepth,
  bybit: fetchBybitDepth,
  okx: fetchOkxDepth,
};

/** Valida que la profundidad sea plausible: precios > 0 y dentro de ±50% de la referencia dada. */
export function validateDepth(
  depth: ExchangeDepth,
  referencePrice: number
): boolean {
  if (
    !isFinite(depth.buyPrice) ||
    !isFinite(depth.sellPrice) ||
    !isFinite(depth.avgPrice) ||
    depth.buyPrice <= 0 ||
    depth.sellPrice <= 0
  ) {
    return false;
  }
  if (referencePrice > 0) {
    const maxAbs = referencePrice * 1.5;
    const minAbs = referencePrice * 0.5;
    if (
      depth.buyPrice > maxAbs ||
      depth.buyPrice < minAbs ||
      depth.sellPrice > maxAbs ||
      depth.sellPrice < minAbs
    ) {
      return false;
    }
  }
  return true;
}
