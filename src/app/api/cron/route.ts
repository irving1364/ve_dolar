import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOLARFLOW_URLS = {
  bcv: "https://dolarflow.com/api/oficial/",
  paralelo: "https://dolarflow.com/api/paralelo/",
};

interface DolarflowResponse {
  exito: boolean;
  precio: number;
  compra?: number;
  venta?: number;
}

interface BinanceAd {
  adv: {
    price: string;
    surplusAmount: string;
    maxSingleTransAmount: string;
    minSingleTransAmount: string;
  };
}

interface BinanceResponse {
  success: boolean;
  data: BinanceAd[];
}

async function fetchBinanceDepth(): Promise<{
  buyPrice: number;
  sellPrice: number;
  buyVolume: number;
  sellVolume: number;
}> {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/json",
  };

  async function getAds(
    tradeType: "BUY" | "SELL",
    maxPages = 10
  ): Promise<{ avgPrice: number; totalVolume: number; bestPrice: number }> {
    let totalPriceVol = 0;
    let totalVolume = 0;
    let bestPrice = tradeType === "BUY" ? Infinity : 0;

    for (let page = 1; page <= maxPages; page++) {
      const res = await fetch(
        "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            asset: "USDT",
            fiat: "VES",
            tradeType,
            page,
            rows: 20,
            publisherType: "merchant",
          }),
          signal: AbortSignal.timeout(15000),
        }
      );

      if (!res.ok) break;

      const json: BinanceResponse = await res.json();
      const ads = json.data ?? [];

      if (ads.length === 0) break;

      for (const ad of ads) {
        const price = parseFloat(ad.adv.price);
        const amount = parseFloat(ad.adv.surplusAmount);

        if (isNaN(price) || isNaN(amount)) continue;

        totalPriceVol += price * amount;
        totalVolume += amount;

        if (tradeType === "BUY" && price < bestPrice) bestPrice = price;
        if (tradeType === "SELL" && price > bestPrice) bestPrice = price;
      }

      if (page < maxPages) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    return {
      avgPrice: totalVolume > 0 ? totalPriceVol / totalVolume : 0,
      totalVolume,
      bestPrice: bestPrice === Infinity || bestPrice === 0 ? 0 : bestPrice,
    };
  }

  const [sellers, buyers] = await Promise.all([getAds("BUY"), getAds("SELL")]);

  return {
    sellPrice: sellers.bestPrice,
    buyPrice: buyers.bestPrice,
    sellVolume: sellers.totalVolume,
    buyVolume: buyers.totalVolume,
  };
}

async function fetchRate(
  source: string,
  url: string,
  extra?: { buyPrice?: number; sellPrice?: number; buyVolume?: number; sellVolume?: number }
): Promise<void> {
  const res = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  const data: DolarflowResponse = await res.json();

  if (!data.exito || typeof data.precio !== "number") {
    throw new Error(`Unexpected response from ${url}: ${JSON.stringify(data)}`);
  }

  await prisma.rate.create({
    data: {
      source,
      price: data.precio,
      buyPrice: extra?.buyPrice ?? null,
      sellPrice: extra?.sellPrice ?? null,
      buyVolume: extra?.buyVolume ?? null,
      sellVolume: extra?.sellVolume ?? null,
    },
  });
}

export async function GET(): Promise<NextResponse> {
  const results: { source: string; status: string }[] = [];

  for (const [source, url] of Object.entries(DOLARFLOW_URLS)) {
    try {
      if (source === "paralelo") {
        const depth = await fetchBinanceDepth();
        await fetchRate(source, url, depth);
      } else {
        await fetchRate(source, url);
      }
      results.push({ source, status: "ok" });
    } catch (err) {
      console.error(`Failed to fetch ${source}:`, err);
      results.push({ source, status: "error" });
    }
  }

  return NextResponse.json({
    ok: results.every((r) => r.status === "ok"),
    results,
    timestamp: new Date().toISOString(),
  });
}
