import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

async function getMarketContext() {
  const [records, latest, bcvLatest] = await Promise.all([
    prisma.rate.findMany({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      take: 96,
      select: { price: true, fetchedAt: true },
    }),
    prisma.rate.findFirst({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      select: {
        price: true,
        buyPrice: true,
        sellPrice: true,
        buyVolume: true,
        sellVolume: true,
      },
    }),
    prisma.rate.findFirst({
      where: { source: "bcv" },
      orderBy: { fetchedAt: "desc" },
      select: { price: true },
    }),
  ]);

  const now = new Date();
  const currentHour = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Caracas",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );

  const historyData = records
    .map(
      (r) =>
        `${r.fetchedAt.toISOString().slice(0, 16)} → ${r.price.toFixed(2)} VES`
    )
    .join("\n");

  const bcvPrice = bcvLatest?.price ?? null;
  const spread =
    bcvPrice && latest
      ? ((latest.price - bcvPrice) / bcvPrice) * 100
      : null;

  const marketSpread =
    latest?.buyPrice && latest?.sellPrice
      ? latest.sellPrice - latest.buyPrice
      : null;
  const marketSpreadPct =
    marketSpread !== null && latest?.sellPrice
      ? (marketSpread / latest.sellPrice) * 100
      : null;

  const marketDataParts: string[] = [];

  if (latest?.buyVolume) {
    marketDataParts.push(`📊 Datos de mercado en vivo (Binance P2P):
• Mejor precio compra: ${latest.buyPrice?.toFixed(2)} VES
• Mejor precio venta: ${latest.sellPrice?.toFixed(2)} VES
• Volumen total demanda (compradores): ${latest.buyVolume?.toFixed(0)} USDT
• Volumen total oferta (vendedores): ${latest.sellVolume?.toFixed(0)} USDT
• Spread mercado: ${(latest.sellPrice! - latest.buyPrice!).toFixed(2)} VES
• Precio promedio actual: ${latest.price.toFixed(2)} VES`);
  }

  if (bcvPrice) {
    marketDataParts.push(`🏛️ Tasa BCV oficial: ${bcvPrice.toFixed(2)} VES
• Diferencia paralelo vs BCV: ${spread?.toFixed(2)}%`);
  }

  marketDataParts.push(`🕐 Hora actual en Venezuela: ${currentHour}:00`);

  const isPeakHour = currentHour >= 7 && currentHour <= 10;
  const isLiquid = marketSpreadPct !== null && marketSpreadPct < 0.3;

  return {
    records,
    latest,
    bcvPrice,
    spread,
    marketSpreadPct,
    currentHour,
    isPeakHour,
    isLiquid,
    historyData,
    marketDataParts,
  };
}

function buildSellPrompt(ctx: Awaited<ReturnType<typeof getMarketContext>>): string {
  const avgPrice =
    ctx.records.length > 0
      ? ctx.records.reduce((s, r) => s + r.price, 0) / ctx.records.length
      : 0;
  const maxPrice = ctx.records.length > 0 ? Math.max(...ctx.records.map((r) => r.price)) : 0;
  const minPrice = ctx.records.length > 0 ? Math.min(...ctx.records.map((r) => r.price)) : 0;
  const pctFromAvg = avgPrice > 0 ? ((ctx.latest?.price ?? 0) - avgPrice) / avgPrice * 100 : 0;

  return `Eres un analista experto en trading de USDT/VES en el mercado paralelo venezolano (Binance P2P). Tu tarea es analizar si es un BUEN MOMENTO PARA VENDER USDT (cambiar USDT → Bs.) pensando en vender caro hoy y recomprar barato después.

⚠️ IMPORTANTE: NO te bases en la tasa BCV ni en spreads gubernamentales. Tu análisis debe basarse exclusivamente en:
- El precio actual del USDT en el mercado paralelo
- Los volúmenes de negociación en Binance P2P
- La tendencia del precio en las últimas horas

CONTEXTO DEL MERCADO:
${ctx.marketDataParts.join("\n\n")}

📈 ESTADÍSTICAS DE PRECIO (últimas ~48hs):
• Precio actual: ${ctx.latest?.price.toFixed(2) ?? "?"} VES
• Promedio histórico: ${avgPrice.toFixed(2)} VES
• Máximo reciente: ${maxPrice.toFixed(2)} VES
• Mínimo reciente: ${minPrice.toFixed(2)} VES
• Diferencia vs promedio: ${pctFromAvg >= 0 ? "+" : ""}${pctFromAvg.toFixed(2)}%

Historial detallado:
${ctx.historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Análisis de Venta**: (el precio actual está alto o bajo comparado con el histórico reciente?)
💡 **Recomendación**: (VENDER AHORA o ESPERAR — si el precio está alto vs el promedio, sugiere vender; si está bajo, esperar a que suba)
💰 **Precio estimado de venta**: (a qué precio podrías vender hoy, basado en la mejor oferta de compra disponible)
🎯 **Objetivo de recompra**: (precio estimado al que podrías recomprar los USDT después, basado en el mínimo reciente)
📊 **Volumen de demanda**: (hay suficiente volumen de compradores como para vender rápido?)
⏰ **Contexto horario**: (cómo influye la hora actual — mañanas suele haber más vendedores, tardes más compradores)
⚠️ **Nota**: (consideraciones adicionales relevantes, ej. si el volumen es bajo mejor esperar)

Máximo 220 palabras en total. Responde en español.`;
}

function buildBuyPrompt(ctx: Awaited<ReturnType<typeof getMarketContext>>): string {
  const avgPrice =
    ctx.records.length > 0
      ? ctx.records.reduce((s, r) => s + r.price, 0) / ctx.records.length
      : 0;
  const maxPrice = ctx.records.length > 0 ? Math.max(...ctx.records.map((r) => r.price)) : 0;
  const minPrice = ctx.records.length > 0 ? Math.min(...ctx.records.map((r) => r.price)) : 0;
  const pctFromAvg = avgPrice > 0 ? ((ctx.latest?.price ?? 0) - avgPrice) / avgPrice * 100 : 0;

  return `Eres un analista experto en trading de USDT/VES en el mercado paralelo venezolano (Binance P2P). Tu tarea es analizar si es un BUEN MOMENTO PARA COMPRAR USDT (cambiar Bs. → USDT) pensando en comprar barato hoy y vender más caro después.

⚠️ IMPORTANTE: NO te bases en la tasa BCV ni en spreads gubernamentales. Tu análisis debe basarse exclusivamente en:
- El precio actual del USDT en el mercado paralelo
- Los volúmenes de negociación en Binance P2P
- La tendencia del precio en las últimas horas

CONTEXTO DEL MERCADO:
${ctx.marketDataParts.join("\n\n")}

📈 ESTADÍSTICAS DE PRECIO (últimas ~48hs):
• Precio actual: ${ctx.latest?.price.toFixed(2) ?? "?"} VES
• Promedio histórico: ${avgPrice.toFixed(2)} VES
• Máximo reciente: ${maxPrice.toFixed(2)} VES
• Mínimo reciente: ${minPrice.toFixed(2)} VES
• Diferencia vs promedio: ${pctFromAvg >= 0 ? "+" : ""}${pctFromAvg.toFixed(2)}%

Historial detallado:
${ctx.historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Análisis de Compra**: (el precio actual está barato o caro comparado con el histórico reciente?)
💡 **Recomendación**: (COMPRAR AHORA o ESPERAR — si el precio está bajo vs el promedio, sugiere comprar; si está alto, esperar a que baje)
💰 **Precio estimado de compra**: (a qué precio podrías comprar hoy, basado en la mejor oferta de venta disponible)
🎯 **Objetivo de venta futura**: (precio estimado al que podrías vender después, basado en el máximo reciente)
📊 **Volumen de oferta**: (hay suficiente volumen de vendedores como para comprar rápido?)
📉 **Tendencia**: (el precio está subiendo, bajando o estable en las últimas horas — si sube, compra pronto; si baja, espera)
⏰ **Contexto horario**: (cómo influye la hora actual — mañanas suele haber más vendedores = mejor para comprar barato)
⚠️ **Nota**: (consideraciones adicionales, ej. si el volumen de oferta es bajo mejor esperar)

Máximo 220 palabras en total. Responde en español.`;
}

function buildAnalyzePrompt(
  ctx: Awaited<ReturnType<typeof getMarketContext>>,
  openTrades: {
    id: number;
    type: string;
    amount: number;
    price: number;
    targetPrice: number | null;
    notes: string | null;
    createdAt: Date;
  }[]
): string {
  const tradesText = openTrades
    .map(
      (t) =>
        `• Trade #${t.id} | ${t.type === "sell" ? "VENTA" : "COMPRA"} | ${t.amount} USDT a ${t.price.toFixed(2)} VES | Creado: ${t.createdAt.toISOString().slice(0, 16)}${t.targetPrice ? ` | Objetivo: ${t.targetPrice.toFixed(2)} VES` : ""}${t.notes ? ` | Nota: ${t.notes}` : ""}`
    )
    .join("\n");

  return `Eres un analista experto en trading de USDT/VES en el mercado paralelo venezolano (Binance P2P). Tu tarea es analizar los TRADES ACTIVOS del usuario y dar recomendaciones personalizadas basadas en el precio del paralelo y los volúmenes.

⚠️ IMPORTANTE: NO uses la tasa BCV ni spreads oficiales como referencia. El análisis debe basarse en el precio del USDT en el mercado paralelo y los volúmenes de negociación.

Contexto del mercado:
- Para trades de VENTA: el usuario vendió USDT esperando que el precio baje para recomprar más barato.
- Para trades de COMPRA: el usuario compró USDT esperando que suba para vender más caro.
- La idea es COMPRAR BARATO y VENDER CARO en el mercado paralelo.

CONTEXTO DEL MERCADO:
${ctx.marketDataParts.join("\n\n")}

Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${ctx.historyData}

TRADES ACTIVOS DEL USUARIO:
${tradesText || "No hay trades activos actualmente."}

Con base en los datos de mercado y los trades activos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Análisis de Mercado**: (2 líneas sobre la tendencia actual del precio paralelo y los volúmenes)
${openTrades.length > 0 ? `
📋 **Evaluación de Trades Activos**:
${openTrades.map((t) => {
  const currentPrice = ctx.latest?.price ?? 0;
  const avg = ctx.records.reduce((s, r) => s + r.price, 0) / ctx.records.length;
  const diff = t.type === "sell"
    ? ((t.price - currentPrice) / t.price) * 100
    : ((currentPrice - t.price) / t.price) * 100;
  const priceContext = currentPrice > t.price ? "el precio está más arriba que cuando operaste" : "el precio está más abajo que cuando operaste";
  return `  • Trade #${t.id} (${t.type === "sell" ? "VENTA" : "COMPRA"}): ${diff >= 0 ? "✅ " : "⚠️ "}Actualmente estás ${diff >= 0 ? "ganando" : "perdiendo"} ~${Math.abs(diff).toFixed(2)}%. ${priceContext}. ${t.targetPrice ? `Tu objetivo es ${t.targetPrice.toFixed(2)} VES (promedio actual: ${avg.toFixed(2)} VES).` : ""}`;
}).join("\n")}
` : ""}
💡 **Recomendación Personalizada**:
${openTrades.length > 0
  ? `• Para cada trade: ¿cerrar ahora (take profit / stop loss), ajustar objetivo, o esperar? Justifica con el precio actual vs el histórico.`
  : "• Consideraciones sobre si deberías abrir un trade ahora, basado en si el precio está alto o bajo."}
🎯 **Sugerencia de precio objetivo**: (basado en los máximos/mínimos recientes del mercado paralelo)
⚠️ **Riesgos**: (factores como baja liquidez, alta volatilidad, o tendencia contraria)
📌 **Próximo movimiento sugerido**: (acción concreta: cerrar, esperar, ajustar, o abrir nuevo trade)

Máximo 280 palabras en total. Responde en español.`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const type = body.type ?? "sell"; // "sell" | "buy" | "analyze"

    if (!["sell", "buy", "analyze"].includes(type)) {
      return NextResponse.json(
        { error: "Tipo inválido. Usa: sell, buy, o analyze" },
        { status: 400 }
      );
    }

    const groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });

    const ctx = await getMarketContext();

    if (ctx.records.length === 0) {
      return NextResponse.json(
        { error: "No hay datos históricos disponibles" },
        { status: 404 }
      );
    }

    let prompt: string;

    if (type === "sell") {
      prompt = buildSellPrompt(ctx);
    } else if (type === "buy") {
      prompt = buildBuyPrompt(ctx);
    } else {
      const openTrades = await prisma.trade.findMany({
        where: { status: "open" },
        orderBy: { createdAt: "desc" },
      });
      prompt = buildAnalyzePrompt(ctx, openTrades);
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 600,
    });

    const advice = completion.choices[0]?.message?.content ?? null;

    return NextResponse.json({
      advice,
      type,
      recordsAnalyzed: ctx.records.length,
      lastDate: ctx.records[0]?.fetchedAt.toISOString(),
    });
  } catch (err) {
    console.error("Error en /api/advice:", err);
    return NextResponse.json(
      { error: "Error al obtener recomendación de la IA" },
      { status: 500 }
    );
  }
}
