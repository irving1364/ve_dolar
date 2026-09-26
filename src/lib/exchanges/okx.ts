import type { ExchangeDepth } from "./types";
import { summarizeAds, midMarketPrice } from "./stats";
import type { AdEntry } from "./stats";

interface OkxItem {
  price: string;
  availableAmount?: string;
  sellQuantity?: string;
}

interface OkxResponse {
  code?: string;
  data?: {
    buy?: OkxItem[];
    sell?: OkxItem[];
  };
}

const OKX_BASE_URL =
  "https://www.okx.com/v3/c2c/tradingOrders/books?quoteCurrency=VES&baseCurrency=USDT&paymentMethod=all&userType=all&receivingAds=false";

/**
 * Consulta el libro C2C público de OKX para USDT/VES.
 * side "sell" = anunciantes que VENDEN (el usuario compra).
 * side "buy"  = anunciantes que COMPRAN (el usuario vende).
 */
async function getBookRaw(side: "sell" | "buy"): Promise<AdEntry[]> {
  const res = await fetch(`${OKX_BASE_URL}&side=${side}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`OKX HTTP ${res.status}`);
  }

  const json = (await res.json()) as OkxResponse;
  const items = (side === "sell" ? json.data?.sell : json.data?.buy) ?? [];

  return items.map((ad) => ({
    price: parseFloat(ad.price),
    amount: parseFloat(ad.availableAmount ?? ad.sellQuantity ?? ""),
  }));
}

export async function fetchOkxDepth(): Promise<ExchangeDepth> {
  // side "sell" (vendedores) -> buyPrice (el usuario compra).
  // side "buy"  (compradores) -> sellPrice (el usuario vende).
  const [sellRaw, buyRaw] = await Promise.all([
    getBookRaw("sell"),
    getBookRaw("buy"),
  ]);

  const sellers = summarizeAds(sellRaw, "sellers");
  const buyers = summarizeAds(buyRaw, "buyers");

  return {
    exchange: "okx",
    buyPrice: sellers.bestPrice,
    sellPrice: buyers.bestPrice,
    buyVolume: sellers.totalVolume,
    sellVolume: buyers.totalVolume,
    avgPrice: midMarketPrice(sellers.bestPrice, buyers.bestPrice),
  };
}
