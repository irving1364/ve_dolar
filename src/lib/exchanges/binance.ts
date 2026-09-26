import type { ExchangeDepth } from "./types";
import { summarizeAds, midMarketPrice } from "./stats";
import type { AdEntry } from "./stats";

export interface BinanceAd {
  adv: {
    price: string;
    surplusAmount: string;
  };
}

export interface BinanceResponse {
  success: boolean;
  data: BinanceAd[];
}

const BINANCE_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

function getHeaders(): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/json",
  };
}

/**
 * Consulta anuncios P2P de Binance USDT/VES.
 *
 * tradeType "BUY": anunciantes que COMPRAN USDT (el usuario vende).
 * tradeType "SELL": anunciantes que VENDEN USDT (el usuario compra).
 */
async function getAdsRaw(
  tradeType: "BUY" | "SELL",
  maxPages = 10
): Promise<AdEntry[]> {
  const entries: AdEntry[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(BINANCE_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        asset: "USDT",
        fiat: "VES",
        tradeType,
        page,
        rows: 20,
        publisherType: "merchant",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) break;

    const json = (await res.json()) as BinanceResponse;
    const ads = json.data ?? [];

    if (ads.length === 0) break;

    for (const ad of ads) {
      entries.push({
        price: parseFloat(ad.adv.price),
        amount: parseFloat(ad.adv.surplusAmount),
      });
    }

    if (page < maxPages) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return entries;
}

export async function fetchBinanceDepth(): Promise<ExchangeDepth> {
  const [buyRaw, sellRaw] = await Promise.all([
    getAdsRaw("BUY"),
    getAdsRaw("SELL"),
  ]);

  // Lado comprador (el usuario vende) -> best = máximo.
  const buyers = summarizeAds(buyRaw, "buyers");
  // Lado vendedor (el usuario compra) -> best = mínimo.
  const sellers = summarizeAds(sellRaw, "sellers");

  return {
    exchange: "binance",
    buyPrice: sellers.bestPrice,
    sellPrice: buyers.bestPrice,
    buyVolume: sellers.totalVolume,
    sellVolume: buyers.totalVolume,
    avgPrice: midMarketPrice(sellers.bestPrice, buyers.bestPrice),
  };
}
