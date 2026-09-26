import type { ExchangeDepth } from "./types";
import { summarizeAds, midMarketPrice } from "./stats";
import type { AdEntry } from "./stats";

interface BybitItem {
  price: string;
  lastQuantity: string;
  quantity: string;
}

interface BybitResponse {
  ret_code?: number;
  ret_msg?: string;
  result?: {
    count?: number;
    items?: BybitItem[];
  };
}

const BYBIT_URL = "https://api2.bybit.com/fiat/otc/item/online";

/**
 * Consulta anuncios online de Bybit P2P (endpoint público, sin auth).
 *
 * side: "0" = el anunciante COMPRA (el usuario vende); "1" = el anunciante VENDE.
 */
async function getAdsRaw(side: "0" | "1"): Promise<AdEntry[]> {
  const res = await fetch(BYBIT_URL, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tokenId: "USDT",
      currencyId: "VES",
      payment: [],
      side,
      size: "300",
      page: "1",
      amount: "",
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Bybit HTTP ${res.status}`);
  }

  const json = (await res.json()) as BybitResponse;
  const items = json.result?.items ?? [];

  return items.map((ad) => ({
    price: parseFloat(ad.price),
    amount: parseFloat(ad.lastQuantity || ad.quantity),
  }));
}

export async function fetchBybitDepth(): Promise<ExchangeDepth> {
  // Lado "0" = compradores (el usuario vende) -> best = máximo.
  // Lado "1" = vendedores (el usuario compra) -> best = mínimo.
  const [buyRaw, sellRaw] = await Promise.all([
    getAdsRaw("0"),
    getAdsRaw("1"),
  ]);

  const buyers = summarizeAds(buyRaw, "buyers");
  const sellers = summarizeAds(sellRaw, "sellers");

  return {
    exchange: "bybit",
    buyPrice: sellers.bestPrice,
    sellPrice: buyers.bestPrice,
    buyVolume: sellers.totalVolume,
    sellVolume: buyers.totalVolume,
    avgPrice: midMarketPrice(sellers.bestPrice, buyers.bestPrice),
  };
}
