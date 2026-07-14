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

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
  } catch {
    console.warn("Telegram notification failed");
  }
}

async function evaluateTrades(currentPrice: number): Promise<void> {
  const openTrades = await prisma.trade.findMany({
    where: { status: "open" },
  });

  for (const t of openTrades) {
    if (!t.targetPrice) continue;

    let reached = false;
    if (t.type === "sell" && currentPrice <= t.targetPrice) reached = true;
    if (t.type === "buy" && currentPrice >= t.targetPrice) reached = true;

    if (reached) {
      const msg =
        `<b>🎯 Objetivo alcanzado</b>\n` +
        `Trade: ${t.type === "sell" ? "Venta" : "Compra"} #${t.id}\n` +
        `Precio actual: ${currentPrice.toFixed(2)} VES\n` +
        `Objetivo: ${t.targetPrice.toFixed(2)} VES\n` +
        `Cantidad: ${t.amount.toFixed(2)} USDT\n` +
        `Cierra el trade desde el dashboard.`;

      await sendTelegram(msg);
    }
  }
}

async function evaluateSignal(): Promise<void> {
  const [latestParalelo, latestBcv] = await Promise.all([
    prisma.rate.findFirst({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findFirst({
      where: { source: "bcv" },
      orderBy: { fetchedAt: "desc" },
    }),
  ]);

  if (!latestParalelo || !latestBcv) return;

  const spreadPct =
    ((latestParalelo.price - latestBcv.price) / latestBcv.price) * 100;

  const now = new Date();
  const currentHour = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Caracas",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );

  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const sellPrice = latestParalelo.sellPrice ?? 0;
  const buyPrice = latestParalelo.buyPrice ?? 0;
  const marketSpread = sellPrice - buyPrice;
  const marketSpreadPct = sellPrice > 0 ? (marketSpread / sellPrice) * 100 : 100;
  const isLiquid = marketSpreadPct < 0.3;
  const isPeakHour = currentHour >= 7 && currentHour <= 10;
  const isAfternoonDip = currentHour >= 13 && currentHour <= 15;

  // === SELL SIGNAL: buen momento para vender USDT (spread alto, hora pico, líquido) ===
  if (spreadPct > 1.5 && isPeakHour && isLiquid) {
    const msg =
      `<b>🟢 SEÑAL FUERTE — VENDE USDT</b>\n\n` +
      `📊 Spread vs BCV: <b>${spreadPct.toFixed(2)}%</b>\n` +
      `💰 Paralelo: <b>${latestParalelo.price.toFixed(2)} VES</b>\n` +
      `🏛️ BCV: <b>${latestBcv.price.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra: <b>${buyPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta: <b>${sellPrice.toFixed(2)} VES</b>\n` +
      `📈 Vol. demanda: ${(latestParalelo.buyVolume ?? 0).toFixed(0)} USDT\n` +
      `📉 Vol. oferta: ${(latestParalelo.sellVolume ?? 0).toFixed(0)} USDT\n\n` +
      `⏰ ${fmt.format(now)} VET — Hora pico matutina con spread favorable y mercado líquido.\n\n` +
      `👉 Es momento de vender USDT si tienes disponible.`;

    await sendTelegram(msg);
    return;
  }

  // === SELL SIGNAL (sin hora pico, pero spread alto y líquido) ===
  if (spreadPct > 1.5 && isLiquid) {
    const msg =
      `<b>✅ SEÑAL — VENDE USDT</b>\n\n` +
      `📊 Spread vs BCV: <b>${spreadPct.toFixed(2)}%</b>\n` +
      `💰 Paralelo: <b>${latestParalelo.price.toFixed(2)} VES</b>\n` +
      `🏛️ BCV: <b>${latestBcv.price.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra: <b>${buyPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta: <b>${sellPrice.toFixed(2)} VES</b>\n` +
      `📈 Vol. demanda: ${(latestParalelo.buyVolume ?? 0).toFixed(0)} USDT\n` +
      `📉 Vol. oferta: ${(latestParalelo.sellVolume ?? 0).toFixed(0)} USDT\n\n` +
      `⏰ ${fmt.format(now)} VET — Spread favorable con mercado líquido.\n\n` +
      `👉 Considera vender USDT.`;

    await sendTelegram(msg);
    return;
  }

  // === BUY SIGNAL: buen momento para comprar USDT (spread bajo, precio cerca de BCV, o dip vespertino) ===
  const trendingDown =
    spreadPct < 1.2 && (isAfternoonDip || spreadPct < 0.8);

  if (trendingDown && isLiquid) {
    const msg =
      `<b>🟣 SEÑAL — COMPRA USDT</b>\n\n` +
      `📊 Spread vs BCV: <b>${spreadPct.toFixed(2)}%</b> (bajo — USDT cerca de su valor justo)\n` +
      `💰 Paralelo: <b>${latestParalelo.price.toFixed(2)} VES</b>\n` +
      `🏛️ BCV: <b>${latestBcv.price.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra: <b>${buyPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta: <b>${sellPrice.toFixed(2)} VES</b>\n` +
      `📈 Vol. demanda: ${(latestParalelo.buyVolume ?? 0).toFixed(0)} USDT\n` +
      `📉 Vol. oferta: ${(latestParalelo.sellVolume ?? 0).toFixed(0)} USDT\n\n` +
      `⏰ ${fmt.format(now)} VET — Spread bajo, Bs. fuerte vs USDT.\n\n` +
      `👉 Es momento de comprar USDT si necesitas.`;

    await sendTelegram(msg);
  }
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

  const [sellers, buyers] = await Promise.all([
    getAds("BUY"),
    getAds("SELL"),
  ]);

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
  extra?: {
    buyPrice?: number;
    sellPrice?: number;
    buyVolume?: number;
    sellVolume?: number;
  }
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
    throw new Error(
      `Unexpected response from ${url}: ${JSON.stringify(data)}`
    );
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
  let paraleloPrice = 0;

  for (const [source, url] of Object.entries(DOLARFLOW_URLS)) {
    try {
      if (source === "paralelo") {
        const depth = await fetchBinanceDepth();
        await fetchRate(source, url, depth);
        paraleloPrice = depth.sellPrice || depth.buyPrice || 0;
      } else {
        await fetchRate(source, url);
      }
      results.push({ source, status: "ok" });
    } catch (err) {
      console.error(`Failed to fetch ${source}:`, err);
      results.push({ source, status: "error" });
    }
  }

  if (paraleloPrice > 0) {
    try {
      await evaluateTrades(paraleloPrice);
    } catch {
      console.warn("Trade evaluation failed");
    }
  }

  // Evaluate market signal for buy/sell alerts
  try {
    await evaluateSignal();
  } catch {
    console.warn("Signal evaluation failed");
  }

  return NextResponse.json({
    ok: results.every((r) => r.status === "ok"),
    results,
    timestamp: new Date().toISOString(),
  });
}
