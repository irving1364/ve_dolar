import { EXCHANGE_LABELS } from "./exchanges";
import type { ExchangeDepth } from "./exchanges";

export function getHourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

export function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export async function sendTelegram(
  chatId: string,
  message: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    console.warn(`Telegram notification failed for chat ${chatId}`);
  }
}

export function buildBestHoursSection(
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

/**
 * Sección de comparativa entre exchanges para el resumen diario.
 * Devuelve "" si no hay al menos 2 exchanges con datos válidos.
 */
export function buildExchangeComparisonSection(
  depths: ExchangeDepth[]
): string {
  const valid = depths.filter(
    (d) => d.buyPrice > 0 && d.sellPrice > 0
  );
  if (valid.length < 2) return "";

  const cheapestBuy = [...valid].sort((a, b) => a.buyPrice - b.buyPrice)[0];
  const bestSell = [...valid].sort((a, b) => b.sellPrice - a.sellPrice)[0];

  const lines: string[] = [
    "",
    "━━━━━━━━━━━━━━━",
    "💱 <b>Comparativa de Exchanges</b>",
    "",
  ];

  valid.forEach((d) => {
    const buy = fmtNum(d.buyPrice);
    const sell = fmtNum(d.sellPrice);
    lines.push(
      `• <b>${EXCHANGE_LABELS[d.exchange]}</b>: Comprar ${buy} VES | Vender ${sell} VES`
    );
  });

  lines.push(
    "",
    `🟢 <b>Comprar más barato:</b> ${EXCHANGE_LABELS[cheapestBuy.exchange]} (${fmtNum(cheapestBuy.buyPrice)} VES)`,
    `💰 <b>Vender más caro:</b> ${EXCHANGE_LABELS[bestSell.exchange]} (${fmtNum(bestSell.sellPrice)} VES)`
  );

  return lines.join("\n");
}

export function buildTargetReachedMessage(
  trade: { id: number; type: string; amount: number; targetPrice: number | null },
  currentPrice: number
): string {
  return (
    `<b>🎯 Objetivo alcanzado</b>\n` +
    `Trade: ${trade.type === "sell" ? "Venta" : "Compra"} #${trade.id}\n` +
    `Precio actual: ${currentPrice.toFixed(2)} VES\n` +
    `Objetivo: ${trade.targetPrice?.toFixed(2) ?? "—"} VES\n` +
    `Cantidad: ${trade.amount.toFixed(2)} USDT\n` +
    `Cierra el trade desde el dashboard.`
  );
}

export interface MarketStats {
  currentPrice: number;
  avgPrice: number;
  maxPrice: number;
  minPrice: number;
  pctAboveAvg: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  sellPrice: number;
  buyPrice: number;
  isLiquid: boolean;
}

export function buildStableStatusMessage(
  stats: MarketStats,
  now: Date,
  bestHoursSection: string
): string {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    `<b>⚖️ Mercado estable</b>\n\n` +
    `💰 Precio actual: <b>${stats.currentPrice.toFixed(2)} VES</b>\n` +
    `📊 Precio promedio (48h): <b>${stats.avgPrice.toFixed(2)} VES</b>\n` +
    `📈 Diferencia vs promedio: <b>${stats.pctAboveAvg >= 0 ? "+" : ""}${stats.pctAboveAvg.toFixed(2)}%</b>\n\n` +
    `Sin señal clara de compra o venta por ahora. Este es un aviso de estado (máximo uno por hora) para confirmar que el monitoreo sigue activo.\n\n` +
    `⏰ ${fmt.format(now)} VET` +
    bestHoursSection
  );
}

export function buildSellSignalMessage(
  stats: MarketStats,
  level: "strong" | "soft",
  now: Date,
  bestHoursSection: string
): string {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (level === "strong") {
    return (
      `<b>🟢 SEÑAL FUERTE — VENDE USDT</b>\n\n` +
      `💰 Precio actual: <b>${stats.currentPrice.toFixed(2)} VES</b>\n` +
      `📊 Precio promedio (48h): <b>${stats.avgPrice.toFixed(2)} VES</b>\n` +
      `📈 Estás <b>${stats.pctAboveAvg.toFixed(2)}%</b> POR ENCIMA del promedio\n` +
      `🔺 Máximo reciente: <b>${stats.maxPrice.toFixed(2)} VES</b>\n` +
      `🔻 Mínimo reciente: <b>${stats.minPrice.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra (tu venta): <b>${stats.buyPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta (tu recompra): <b>${stats.sellPrice.toFixed(2)} VES</b>\n` +
      `📈 Vol. demanda (compradores): <b>${stats.buyVolume.toFixed(0)} USDT</b>\n` +
      `📉 Vol. oferta (vendedores): <b>${stats.sellVolume.toFixed(0)} USDT</b>\n\n` +
      `💡 El precio está alto vs el promedio de las últimas 48h. Hay buena demanda. ` +
      `Considera vender USDT ahora y recomprar cuando baje.\n\n` +
      `🎯 Posible recompra objetivo: <b>${(stats.avgPrice * 0.98).toFixed(2)}</b> - <b>${stats.avgPrice.toFixed(2)} VES</b>\n` +
      `⏰ ${fmt.format(now)} VET` +
      bestHoursSection
    );
  }

  return (
    `<b>✅ SEÑAL — VENDE USDT</b>\n\n` +
    `💰 Precio actual: <b>${stats.currentPrice.toFixed(2)} VES</b>\n` +
    `📊 Precio promedio (48h): <b>${stats.avgPrice.toFixed(2)} VES</b>\n` +
    `📈 Estás <b>${stats.pctAboveAvg.toFixed(2)}%</b> arriba del promedio\n` +
    `💵 Mejor compra: <b>${stats.buyPrice.toFixed(2)} VES</b>\n` +
    `📈 Vol. demanda: <b>${stats.buyVolume.toFixed(0)} USDT</b>\n` +
    `📉 Vol. oferta: <b>${stats.sellVolume.toFixed(0)} USDT</b>\n\n` +
    `💡 El precio está por encima del promedio. Buen momento para vender si necesitas liquidez.\n` +
    `⏰ ${fmt.format(now)} VET` +
    bestHoursSection
  );
}

export function buildBuySignalMessage(
  stats: MarketStats,
  level: "strong" | "soft",
  now: Date,
  bestHoursSection: string
): string {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (level === "strong") {
    return (
      `<b>🟣 SEÑAL — COMPRA USDT</b>\n\n` +
      `💰 Precio actual: <b>${stats.currentPrice.toFixed(2)} VES</b>\n` +
      `📊 Precio promedio (48h): <b>${stats.avgPrice.toFixed(2)} VES</b>\n` +
      `📉 Estás <b>${Math.abs(stats.pctAboveAvg).toFixed(2)}%</b> POR DEBAJO del promedio\n` +
      `🔻 Mínimo reciente: <b>${stats.minPrice.toFixed(2)} VES</b>\n` +
      `🔺 Máximo reciente: <b>${stats.maxPrice.toFixed(2)} VES</b>\n` +
      `💶 Mejor venta (tu compra): <b>${stats.sellPrice.toFixed(2)} VES</b>\n` +
      `💵 Mejor compra (tu venta futura): <b>${stats.buyPrice.toFixed(2)} VES</b>\n` +
      `📉 Vol. oferta (vendedores): <b>${stats.sellVolume.toFixed(0)} USDT</b>\n` +
      `📈 Vol. demanda (compradores): <b>${stats.buyVolume.toFixed(0)} USDT</b>\n\n` +
      `💡 El precio está bajo vs el promedio de las últimas 48h. Hay buena oferta. ` +
      `Considera comprar USDT ahora y vender cuando suba.\n\n` +
      `🎯 Posible venta objetivo: <b>${stats.avgPrice.toFixed(2)}</b> - <b>${(stats.avgPrice * 1.02).toFixed(2)} VES</b>\n` +
      `⏰ ${fmt.format(now)} VET` +
      bestHoursSection
    );
  }

  return (
    `<b>✅ SEÑAL — COMPRA USDT</b>\n\n` +
    `💰 Precio actual: <b>${stats.currentPrice.toFixed(2)} VES</b>\n` +
    `📊 Precio promedio (48h): <b>${stats.avgPrice.toFixed(2)} VES</b>\n` +
    `📉 Estás <b>${Math.abs(stats.pctAboveAvg).toFixed(2)}%</b> abajo del promedio\n` +
    `💶 Mejor venta: <b>${stats.sellPrice.toFixed(2)} VES</b>\n` +
    `📉 Vol. oferta: <b>${stats.sellVolume.toFixed(0)} USDT</b>\n` +
    `📈 Vol. demanda: <b>${stats.buyVolume.toFixed(0)} USDT</b>\n\n` +
    `💡 El precio está por debajo del promedio. Buen momento para comprar USDT.\n` +
    `⏰ ${fmt.format(now)} VET` +
    bestHoursSection
  );
}

export interface DailySummaryParams {
  currentPrice: number;
  avg48h: number;
  max48h: number;
  min48h: number;
  pctVsAvg: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  buyPrice: number | null;
  sellPrice: number | null;
  bcvPrice: number | null;
  dailySignal: string;
  bestHoursSection: string;
  exchangeSection: string;
  dateLabel: string;
}

export function buildDailySummaryMessage(params: DailySummaryParams): string {
  const lines: string[] = [
    `<b>📊 RESUMEN DIARIO — ${params.dateLabel}</b>`,
    "",
    "━━━━━━━━━━━━━━━",
    "<b>💱 Mercado Actual</b>",
    "",
    `💰 Tasa Paralelo: <b>${fmtNum(params.currentPrice)} VES</b>`,
    params.bcvPrice
      ? `🏛️ BCV: <b>${fmtNum(params.bcvPrice)} VES</b>`
      : null,
    `📊 Prom. 48h: <b>${fmtNum(params.avg48h)} VES</b> (${params.pctVsAvg >= 0 ? "+" : ""}${params.pctVsAvg.toFixed(2)}%)`,
    `🔺 Máx 48h: <b>${fmtNum(params.max48h)} VES</b> | 🔻 Mín: <b>${fmtNum(params.min48h)} VES</b>`,
    "",
    `💵 Mejor compra: <b>${params.buyPrice ? fmtNum(params.buyPrice) + " VES" : "—"}</b>`,
    `💶 Mejor venta: <b>${params.sellPrice ? fmtNum(params.sellPrice) + " VES" : "—"}</b>`,
    `📈 Vol. compra: <b>${fmtNum(params.buyVolume, 0)} USDT</b> | Vol. venta: <b>${fmtNum(params.sellVolume, 0)} USDT</b>`,
    params.totalVolume > 0
      ? `📊 Vol. total: <b>${fmtNum(params.totalVolume, 0)} USDT</b>`
      : null,
    "",
    `🔮 Señal del día: <b>${params.dailySignal}</b>`,
  ].filter(Boolean) as string[];

  if (params.exchangeSection) {
    lines.push("");
    lines.push(params.exchangeSection);
  }

  if (params.bestHoursSection) {
    lines.push("");
    lines.push(params.bestHoursSection);
  }

  return lines.join("\n");
}
