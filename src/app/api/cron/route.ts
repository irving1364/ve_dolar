import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEPTH_FETCHERS,
  getEnabledExchanges,
  validateDepth,
} from "@/lib/exchanges";
import type { ExchangeDepth } from "@/lib/exchanges";
import {
  sendTelegram,
  buildTargetReachedMessage,
  buildSellSignalMessage,
  buildBuySignalMessage,
  buildStableStatusMessage,
  buildPriceAlertMessage,
  buildBestHoursSection,
  buildExchangeComparisonSection,
  buildDailySummaryMessage,
} from "@/lib/telegram";
import { computeBestHours } from "@/lib/analysis";
import { fetchTodayAperturas } from "@/lib/aperturas";
import { fetchIntervencionRate } from "@/lib/hdavzla";
import {
  computeMarketStats,
  evaluateSignal,
  dailySignalLabel,
} from "@/lib/signals";

const DOLARFLOW_URLS = {
  bcv: "https://dolarflow.com/api/oficial/",
  paralelo: "https://dolarflow.com/api/paralelo/",
};

interface DolarflowResponse {
  exito: boolean;
  precio: number;
}

async function fetchDolarflowPrice(url: string): Promise<number> {
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

  return data.precio;
}

async function evaluateTradesForUser(
  userId: string,
  currentPrice: number,
  chatId: string
): Promise<void> {
  const openTrades = await prisma.trade.findMany({
    where: { status: "open", userId },
  });

  for (const t of openTrades) {
    if (!t.targetPrice) continue;

    let reached = false;
    if (t.type === "sell" && currentPrice <= t.targetPrice) reached = true;
    if (t.type === "buy" && currentPrice >= t.targetPrice) reached = true;

    if (reached) {
      await sendTelegram(
        chatId,
        buildTargetReachedMessage(t, currentPrice)
      );
    }
  }
}

async function evaluatePriceAlertsForUser(
  userId: string,
  currentPrice: number,
  chatId: string
): Promise<void> {
  const activeAlerts = await prisma.priceAlert.findMany({
    where: { userId, active: true },
  });

  for (const alert of activeAlerts) {
    const direction = alert.direction as "above" | "below";
    const reached =
      direction === "above"
        ? currentPrice >= alert.targetPrice
        : currentPrice <= alert.targetPrice;

    if (!reached) continue;

    await sendTelegram(
      chatId,
      buildPriceAlertMessage(direction, alert.targetPrice, currentPrice)
    );
    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: { active: false, triggeredAt: new Date() },
    });
  }
}

async function evaluateSignalForUser(
  userId: string,
  chatId: string
): Promise<void> {
  const [latestParalelo, history, bestHours] = await Promise.all([
    prisma.rate.findFirst({
      where: { source: "paralelo", exchange: "binance" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findMany({
      where: { source: "paralelo", exchange: "binance" },
      orderBy: { fetchedAt: "desc" },
      take: 96,
      select: { price: true },
    }),
    prisma.rate
      .findMany({
        where: {
          source: "paralelo",
          exchange: "binance",
          fetchedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { price: true, buyVolume: true, sellVolume: true, fetchedAt: true },
        orderBy: { fetchedAt: "asc" },
      })
      .then(computeBestHours),
  ]);

  const stats = computeMarketStats(latestParalelo, history);
  if (!stats) return;

  const level = evaluateSignal(stats);
  const now = new Date();
  const bestHoursSection = buildBestHoursSection(bestHours);

  if (!level) {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const lastNotified = settings?.lastStableNotifiedAt;
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (lastNotified && lastNotified > hourAgo) return;

    await sendTelegram(chatId, buildStableStatusMessage(stats, now, bestHoursSection));
    await prisma.userSettings.update({
      where: { userId },
      data: { lastStableNotifiedAt: now },
    });
    return;
  }

  let msg: string;
  if (level === "strong_sell" || level === "sell") {
    msg = buildSellSignalMessage(
      stats,
      level === "strong_sell" ? "strong" : "soft",
      now,
      bestHoursSection
    );
  } else {
    msg = buildBuySignalMessage(
      stats,
      level === "strong_buy" ? "strong" : "soft",
      now,
      bestHoursSection
    );
  }

  await sendTelegram(chatId, msg);
}

async function sendDailySummaryToUser(
  userId: string,
  chatId: string,
  exchangeDepths: ExchangeDepth[]
): Promise<void> {
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

  // Send once per day at ~06:00 VET
  if (vetHour !== 6 || vetMinute >= 30) return;

  const fmtDate = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const [latestParalelo, latestBcv, history, bestHours] = await Promise.all([
    prisma.rate.findFirst({
      where: { source: "paralelo", exchange: "binance" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findFirst({
      where: { source: "bcv" },
      orderBy: { fetchedAt: "desc" },
    }),
    prisma.rate.findMany({
      where: { source: "paralelo", exchange: "binance" },
      orderBy: { fetchedAt: "desc" },
      take: 96,
      select: { price: true, fetchedAt: true },
    }),
    prisma.rate
      .findMany({
        where: {
          source: "paralelo",
          exchange: "binance",
          fetchedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { price: true, buyVolume: true, sellVolume: true, fetchedAt: true },
        orderBy: { fetchedAt: "asc" },
      })
      .then(computeBestHours),
  ]);

  const stats = computeMarketStats(latestParalelo, history);
  if (!stats) return;

  const bcvPrice = latestBcv?.price ?? null;
  const exchangeSection = buildExchangeComparisonSection(exchangeDepths);

  const msg = buildDailySummaryMessage({
    currentPrice: stats.currentPrice,
    avg48h: stats.avgPrice,
    max48h: stats.maxPrice,
    min48h: stats.minPrice,
    pctVsAvg: stats.pctAboveAvg,
    buyVolume: stats.buyVolume,
    sellVolume: stats.sellVolume,
    totalVolume: stats.totalVolume,
    buyPrice: stats.buyPrice || null,
    sellPrice: stats.sellPrice || null,
    bcvPrice,
    dailySignal: dailySignalLabel(stats),
    bestHoursSection: buildBestHoursSection(bestHours),
    exchangeSection,
    dateLabel: fmtDate.format(now).toUpperCase() + " VET",
  });

  await sendTelegram(chatId, msg);
}

// TEMPORAL: en true mientras se depura por que FastCron no llega autorizado.
// Poner en false (o borrar esta constante y el "&&" de abajo) para volver a
// exigir el header Authorization correcto.
const CRON_AUTH_DISABLED = true;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const authorized = !cronSecret ? false : authHeader === `Bearer ${cronSecret}`;

  if (!authorized) {
    console.warn("cron: llamada sin autorizacion valida", { hasHeader: !!authHeader });
  }

  if (!CRON_AUTH_DISABLED && !authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results: { source: string; status: string }[] = [];
  const exchangeDepths: ExchangeDepth[] = [];
  let paraleloPrice = 0;

  // Step 1: Tasas oficiales (BCV)
  try {
    const bcvPrice = await fetchDolarflowPrice(DOLARFLOW_URLS.bcv);
    await prisma.rate.create({
      data: { source: "bcv", price: bcvPrice },
    });
    results.push({ source: "bcv", status: "ok" });
  } catch (err) {
    console.error("Failed to fetch bcv:", err);
    results.push({ source: "bcv", status: "error" });
  }

  // Step 2: Referencia paralela (dolarflow) + profundidad de cada exchange P2P
  let referencePrice = 0;
  try {
    referencePrice = await fetchDolarflowPrice(DOLARFLOW_URLS.paralelo);
    results.push({ source: "paralelo", status: "ok" });
  } catch (err) {
    console.error("Failed to fetch paralelo reference:", err);
    results.push({ source: "paralelo", status: "error" });
  }

  const enabledExchanges = getEnabledExchanges();
  for (const exchange of enabledExchanges) {
    try {
      const depth = await DEPTH_FETCHERS[exchange]();
      const ref = referencePrice > 0 ? referencePrice : depth.avgPrice;
      if (!validateDepth(depth, ref)) {
        throw new Error(`Depth inválida para ${exchange}`);
      }

      await prisma.rate.create({
        data: {
          source: "paralelo",
          exchange,
          // Binance conserva el precio de referencia (dolarflow) como siempre.
          price: exchange === "binance" ? referencePrice : depth.avgPrice,
          buyPrice: depth.buyPrice,
          sellPrice: depth.sellPrice,
          buyVolume: depth.buyVolume,
          sellVolume: depth.sellVolume,
        },
      });

      exchangeDepths.push(depth);
      if (exchange === "binance") {
        paraleloPrice = depth.sellPrice || depth.buyPrice || 0;
      }
      results.push({ source: `paralelo-${exchange}`, status: "ok" });
    } catch (err) {
      console.error(`Failed to fetch ${exchange}:`, err);
      results.push({ source: `paralelo-${exchange}`, status: "error" });
    }
  }

  // Step 2.5: Aperturas de bancos (hdavzla.com) — best-effort, no bloquea el cron.
  try {
    const todayAperturas = await fetchTodayAperturas();
    for (const entry of todayAperturas) {
      await prisma.bankOpening.upsert({
        where: {
          date_bank_mechanism_time: {
            date: entry.date,
            bank: entry.bank,
            mechanism: entry.mechanism,
            time: entry.time,
          },
        },
        create: {
          date: entry.date,
          bank: entry.bank,
          mechanism: entry.mechanism,
          time: entry.time,
          duration: entry.duration,
        },
        update: { duration: entry.duration },
      });
    }
    results.push({ source: "aperturas", status: "ok" });
  } catch (err) {
    console.warn("Failed to fetch/save aperturas:", err);
    results.push({ source: "aperturas", status: "error" });
  }

  // Step 2.6: Tasa de intervencion real (hdavzla.com) — best-effort.
  try {
    const intervencionRate = await fetchIntervencionRate();
    if (intervencionRate) {
      await prisma.rate.create({
        data: { source: "intervencion", price: intervencionRate },
      });
      results.push({ source: "intervencion", status: "ok" });
    } else {
      results.push({ source: "intervencion", status: "error" });
    }
  } catch (err) {
    console.warn("Failed to fetch intervencion rate:", err);
    results.push({ source: "intervencion", status: "error" });
  }

  // Step 3: Send per-user notifications
  if (paraleloPrice > 0) {
    try {
      const usersWithTelegram = await prisma.userSettings.findMany({
        where: {
          telegramChatId: { not: null },
          notifications: true,
        },
        select: {
          userId: true,
          telegramChatId: true,
        },
      });

      for (const userSettings of usersWithTelegram) {
        const chatId = userSettings.telegramChatId!;

        try {
          await evaluateTradesForUser(
            userSettings.userId,
            paraleloPrice,
            chatId
          );
        } catch {
          console.warn(
            `Trade evaluation failed for user ${userSettings.userId}`
          );
        }

        try {
          await evaluatePriceAlertsForUser(
            userSettings.userId,
            paraleloPrice,
            chatId
          );
        } catch {
          console.warn(
            `Price alert evaluation failed for user ${userSettings.userId}`
          );
        }

        try {
          await evaluateSignalForUser(userSettings.userId, chatId);
        } catch {
          console.warn(
            `Signal evaluation failed for user ${userSettings.userId}`
          );
        }

        try {
          await sendDailySummaryToUser(
            userSettings.userId,
            chatId,
            exchangeDepths
          );
        } catch {
          console.warn(
            `Daily summary failed for user ${userSettings.userId}`
          );
        }
      }
    } catch {
      console.warn("Per-user notification processing failed");
    }
  }

  return NextResponse.json({
    ok: results.every((r) => r.status === "ok"),
    results,
    exchanges: exchangeDepths.map((d) => ({
      exchange: d.exchange,
      buyPrice: d.buyPrice,
      sellPrice: d.sellPrice,
      buyVolume: d.buyVolume,
      sellVolume: d.sellVolume,
    })),
    timestamp: new Date().toISOString(),
  });
}
