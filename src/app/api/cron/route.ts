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

function getHourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

async function computeBestHours(): Promise<{
  sellHours: { hour: number; price: number; buyVol: number }[];
  buyHours: { hour: number; price: number; sellVol: number }[];
} | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const records = await prisma.rate.findMany({
    where: {
      source: "paralelo",
      fetchedAt: { gte: thirtyDaysAgo },
    },
    select: { price: true, buyVolume: true, sellVolume: true, fetchedAt: true },
    orderBy: { fetchedAt: "asc" },
  });

  if (records.length < 24) return null;

  const hourlyMap: Record<
    number,
    { prices: number[]; buyVols: number[]; sellVols: number[]; count: number }
  > = {};

  for (const r of records) {
    const hour = parseInt(
      new Intl.DateTimeFormat("en", {
        timeZone: "America/Caracas",
        hour: "numeric",
        hour12: false,
      }).format(new Date(r.fetchedAt))
    );

    if (!hourlyMap[hour]) {
      hourlyMap[hour] = { prices: [], buyVols: [], sellVols: [], count: 0 };
    }

    hourlyMap[hour].prices.push(r.price);
    if (r.buyVolume) hourlyMap[hour].buyVols.push(r.buyVolume);
    if (r.sellVolume) hourlyMap[hour].sellVols.push(r.sellVolume);
    hourlyMap[hour].count++;
  }

  const hours = Object.entries(hourlyMap).map(([hourStr, data]) => {
    const hour = parseInt(hourStr);
    const avgPrice =
      data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
    const avgBuyVol =
      data.buyVols.length > 0
        ? data.buyVols.reduce((a, b) => a + b, 0) / data.buyVols.length
        : 0;
    const avgSellVol =
      data.sellVols.length > 0
        ? data.sellVols.reduce((a, b) => a + b, 0) / data.sellVols.length
        : 0;
    return { hour, avgPrice, avgBuyVol, avgSellVol };
  });

  const maxBuy = Math.max(...hours.map((h) => h.avgBuyVol), 1);
  const maxSell = Math.max(...hours.map((h) => h.avgSellVol), 1);
  const minPrice = Math.min(...hours.map((h) => h.avgPrice));
  const maxPrice = Math.max(...hours.map((h) => h.avgPrice));
  const priceRange = maxPrice - minPrice || 1;

  const scored = hours.map((h) => ({
    ...h,
    sellScore:
      (h.avgBuyVol / maxBuy) * 0.5 +
      ((h.avgPrice - minPrice) / priceRange) * 0.5,
    buyScore:
      (h.avgSellVol / maxSell) * 0.5 +
      (1 - (h.avgPrice - minPrice) / priceRange) * 0.5,
  }));

  const topSell = scored
    .sort((a, b) => b.sellScore - a.sellScore)
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, price: h.avgPrice, buyVol: h.avgBuyVol }));

  const topBuy = scored
    .sort((a, b) => b.buyScore - a.buyScore)
    .slice(0, 3)
    .map((h) => ({ hour: h.hour, price: h.avgPrice, sellVol: h.avgSellVol }));

  return { sellHours: topSell, buyHours: topBuy };
}

function buildBestHoursSection(
  bestHours: {
    sellHours: { hour: number; price: number; buyVol: number }[];
    buyHours: { hour: number; price: number; sellVol: number }[];
  } | null
): string {
  if (
    !bestHours ||
    (bestHours.sellHours.length === 0 && bestHours.buyHours.length === 0)
  ) {
    return "";
  }

  const lines: string[] = [
    "",
    "━━━━━━━━━━━━━━━",
    "⏰ <b>Mejores horas del día</b>",
  ];

  if (bestHours.sellHours.length > 0) {
    lines.push("");
    lines.push("💰 <b>VENDER USDT:</b>");
    bestHours.sellHours.forEach((h, i) => {
      lines.push(
        `  ${i + 1}. ${getHourLabel(h.hour)} → ${fmtNum(h.price)} VES (Vol. compra: ${(h.buyVol / 1000).toFixed(0)}K)`
      );
    });
  }

  if (bestHours.buyHours.length > 0) {
    lines.push("");
    lines.push("🟢 <b>COMPRAR USDT:</b>");
    bestHours.buyHours.forEach((h, i) => {
      lines.push(
        `  ${i + 1}. ${getHourLabel(h.hour)} → ${fmtNum(h.price)} VES (Vol. venta: ${(h.sellVol / 1000).toFixed(0)}K)`
      );
    });
  }

  return lines.join("\n");
}

async function evaluateSignal(): Promise<void> {
  const [latestParalelo, history, bestHours] = await Promise.all([
    prisma.rate.findFirst({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findMany({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      take: 96, // últimas ~48 horas
      select: { price: true },
    }),
    computeBestHours(),
  ]);

  if (!latestParalelo || history.length < 10) return;

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

  const currentPrice = latestParalelo.price;
  const avgPrice = history.reduce((s, r) => s + r.price, 0) / history.length;
  const maxPrice = Math.max(...history.map((r) => r.price));
  const minPrice = Math.min(...history.map((r) => r.price));
  const pctAboveAvg = ((currentPrice - avgPrice) / avgPrice) * 100;

  const buyVolume = latestParalelo.buyVolume ?? 0;
  const sellVolume = latestParalelo.sellVolume ?? 0;
  const totalVolume = buyVolume + sellVolume;
  const sellPrice = latestParalelo.sellPrice ?? 0;
  const buyPrice = latestParalelo.buyPrice ?? 0;
  const marketSpread = sellPrice - buyPrice;
  const marketSpreadPct = sellPrice > 0 ? (marketSpread / sellPrice) * 100 : 100;
  const isLiquid = marketSpreadPct < 0.3;

  const isMorning = currentHour >= 7 && currentHour <= 10;
  const isAfternoon = currentHour >= 13 && currentHour <= 15;

  const bestHoursSection = buildBestHoursSection(bestHours);

  // === SELL SIGNAL: precio alto vs histórico + buena demanda (volumen compra) + líquido ===
  // Si el precio está >0.8% arriba del promedio y hay buena demanda, es buen momento para vender
  if (pctAboveAvg > 0.8 && buyVolume > 5000 && isLiquid && totalVolume > 15000) {
    const msg =
      `<b>🟢 SEÑAL FUERTE — VENDE USDT</b>\n\n` +
      `💰 Precio actual: <b>${currentPrice.toFixed(2)} VES</b>\n` +
      `📊 Precio promedio (48h): <b>${avgPrice.toFixed(2)} VES</b>\n` +
      `📈 Estás <b>${pctAboveAvg.toFixed(2)}%</b> POR ENCIMA del promedio\n` +
      `🔺 Máximo reciente: <b>${maxPrice.toFixed(2)} VES</b>\n` +
      `🔻 Mínimo reciente: <b>${minPrice.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra (tu venta): <b>${buyPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta (tu recompra): <b>${sellPrice.toFixed(2)} VES</b>\n` +
      `📈 Vol. demanda (compradores): <b>${buyVolume.toFixed(0)} USDT</b>\n` +
      `📉 Vol. oferta (vendedores): <b>${sellVolume.toFixed(0)} USDT</b>\n\n` +
      `💡 El precio está alto vs el promedio de las últimas 48h. Hay buena demanda. ` +
      `Considera vender USDT ahora y recomprar cuando baje.\n\n` +
      `🎯 Posible recompra objetivo: <b>${(avgPrice * 0.98).toFixed(2)}</b> - <b>${avgPrice.toFixed(2)} VES</b>\n` +
      `⏰ ${fmt.format(now)} VET` +
      bestHoursSection;

    await sendTelegram(msg);
    return;
  }

  // Sell signal (más suave) - precio arriba del promedio pero menos volumen
  if (pctAboveAvg > 0.5 && buyVolume > 3000 && isLiquid) {
    const msg =
      `<b>✅ SEÑAL — VENDE USDT</b>\n\n` +
      `💰 Precio actual: <b>${currentPrice.toFixed(2)} VES</b>\n` +
      `📊 Precio promedio (48h): <b>${avgPrice.toFixed(2)} VES</b>\n` +
      `📈 Estás <b>${pctAboveAvg.toFixed(2)}%</b> arriba del promedio\n` +
      `💵 Mejor compra: <b>${buyPrice.toFixed(2)} VES</b>\n` +
      `📈 Vol. demanda: <b>${buyVolume.toFixed(0)} USDT</b>\n` +
      `📉 Vol. oferta: <b>${sellVolume.toFixed(0)} USDT</b>\n\n` +
      `💡 El precio está por encima del promedio. Buen momento para vender si necesitas liquidez.\n` +
      `⏰ ${fmt.format(now)} VET` +
      bestHoursSection;

    await sendTelegram(msg);
    return;
  }

  // === BUY SIGNAL: precio bajo vs histórico + buena oferta (volumen venta) + líquido ===
  // Si el precio está >0.5% abajo del promedio y hay buena oferta, es buen momento para comprar
  if (pctAboveAvg < -0.5 && sellVolume > 5000 && isLiquid && totalVolume > 15000) {
    const msg =
      `<b>🟣 SEÑAL — COMPRA USDT</b>\n\n` +
      `💰 Precio actual: <b>${currentPrice.toFixed(2)} VES</b>\n` +
      `📊 Precio promedio (48h): <b>${avgPrice.toFixed(2)} VES</b>\n` +
      `📉 Estás <b>${Math.abs(pctAboveAvg).toFixed(2)}%</b> POR DEBAJO del promedio\n` +
      `🔻 Mínimo reciente: <b>${minPrice.toFixed(2)} VES</b>\n` +
      `🔺 Máximo reciente: <b>${maxPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta (tu compra): <b>${sellPrice.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra (tu venta futura): <b>${buyPrice.toFixed(2)} VES</b>\n` +
      `📉 Vol. oferta (vendedores): <b>${sellVolume.toFixed(0)} USDT</b>\n` +
      `📈 Vol. demanda (compradores): <b>${buyVolume.toFixed(0)} USDT</b>\n\n` +
      `💡 El precio está bajo vs el promedio de las últimas 48h. Hay buena oferta. ` +
      `Considera comprar USDT ahora y vender cuando suba.\n\n` +
      `🎯 Posible venta objetivo: <b>${avgPrice.toFixed(2)}</b> - <b>${(avgPrice * 1.02).toFixed(2)} VES</b>\n` +
      `⏰ ${fmt.format(now)} VET` +
      bestHoursSection;

    await sendTelegram(msg);
    return;
  }

  // Buy signal (más suave)
  if (pctAboveAvg < -0.3 && sellVolume > 3000 && isLiquid) {
    const msg =
      `<b>✅ SEÑAL — COMPRA USDT</b>\n\n` +
      `💰 Precio actual: <b>${currentPrice.toFixed(2)} VES</b>\n` +
      `📊 Precio promedio (48h): <b>${avgPrice.toFixed(2)} VES</b>\n` +
      `📉 Estás <b>${Math.abs(pctAboveAvg).toFixed(2)}%</b> abajo del promedio\n` +
      `💶 Mejor venta: <b>${sellPrice.toFixed(2)} VES</b>\n` +
      `📉 Vol. oferta: <b>${sellVolume.toFixed(0)} USDT</b>\n` +
      `📈 Vol. demanda: <b>${buyVolume.toFixed(0)} USDT</b>\n\n` +
      `💡 El precio está por debajo del promedio. Buen momento para comprar USDT.\n` +
      `⏰ ${fmt.format(now)} VET` +
      bestHoursSection;

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

async function sendDailySummary(): Promise<void> {
  const now = new Date();
  const vetHour = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Caracas",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  const vetMinute = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Caracas",
      minute: "numeric",
    }).format(now)
  );

  // Send once per day at ~06:00 VET (first cron run of the morning)
  if (vetHour !== 6 || vetMinute >= 30) return;

  const fmtDate = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const [latestParalelo, latestBcv, history, bestHours] = await Promise.all([
    prisma.rate.findFirst({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findFirst({
      where: { source: "bcv" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findMany({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      take: 96,
      select: { price: true, fetchedAt: true },
    }),
    computeBestHours(),
  ]);

  if (!latestParalelo || history.length < 10) return;

  const currentPrice = latestParalelo.price;
  const avg48h = history.reduce((s, r) => s + r.price, 0) / history.length;
  const max48h = Math.max(...history.map((r) => r.price));
  const min48h = Math.min(...history.map((r) => r.price));
  const pctVsAvg = ((currentPrice - avg48h) / avg48h) * 100;
  const buyVolume = latestParalelo.buyVolume ?? 0;
  const sellVolume = latestParalelo.sellVolume ?? 0;
  const totalVolume = buyVolume + sellVolume;
  const bcvPrice = latestBcv?.price ?? null;

  let dailySignal = "⏸️ Esperar";
  if (pctVsAvg > 0.8 && buyVolume > 5000) {
    dailySignal = "🟢 Vender USDT";
  } else if (pctVsAvg > 0.5 && buyVolume > 3000) {
    dailySignal = "✅ Vender";
  } else if (pctVsAvg < -0.5 && sellVolume > 5000) {
    dailySignal = "🟣 Comprar USDT";
  } else if (pctVsAvg < -0.3 && sellVolume > 3000) {
    dailySignal = "✅ Comprar";
  }

  const lines: string[] = [
    `<b>📊 RESUMEN DIARIO — ${fmtDate.format(now).toUpperCase()} VET</b>`,
    "",
    "━━━━━━━━━━━━━━━",
    "<b>💱 Mercado Actual</b>",
    "",
    `💰 Tasa Paralelo: <b>${fmtNum(currentPrice)} VES</b>`,
    bcvPrice ? `🏛️ BCV: <b>${fmtNum(bcvPrice)} VES</b>` : null,
    `📊 Prom. 48h: <b>${fmtNum(avg48h)} VES</b> (${pctVsAvg >= 0 ? "+" : ""}${pctVsAvg.toFixed(2)}%)`,
    `🔺 Máx 48h: <b>${fmtNum(max48h)} VES</b> | 🔻 Mín: <b>${fmtNum(min48h)} VES</b>`,
    "",
    `💵 Mejor compra: <b>${latestParalelo.buyPrice ? fmtNum(latestParalelo.buyPrice) + " VES" : "—"}</b>`,
    `💶 Mejor venta: <b>${latestParalelo.sellPrice ? fmtNum(latestParalelo.sellPrice) + " VES" : "—"}</b>`,
    `📈 Vol. compra: <b>${fmtNum(buyVolume, 0)} USDT</b> | Vol. venta: <b>${fmtNum(sellVolume, 0)} USDT</b>`,
    totalVolume > 0 ? `📊 Vol. total: <b>${fmtNum(totalVolume, 0)} USDT</b>` : null,
    "",
    `🔮 Señal del día: <b>${dailySignal}</b>`,
  ].filter(Boolean) as string[];

  const bestSection = buildBestHoursSection(bestHours);
  if (bestSection) {
    lines.push("");
    lines.push(bestSection);
  }

  await sendTelegram(lines.join("\n"));
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

  // Send daily summary at 06:00 VET
  try {
    await sendDailySummary();
  } catch {
    console.warn("Daily summary failed");
  }

  return NextResponse.json({
    ok: results.every((r) => r.status === "ok"),
    results,
    timestamp: new Date().toISOString(),
  });
}
