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
  return `Eres un analista experto en arbitraje del mercado venezolano. Tu tarea es analizar si es un BUEN MOMENTO PARA VENDER USDT (convertir USDT a Bs.).

Contexto del mercado:
- La tasa BCV (oficial) suele estar por debajo de la tasa paralela.
- Cuando el spread (diferencia paralelo vs BCV) es alto (>1.5%), conviene vender USDT porque el mercado paralelo paga más que la tasa oficial.
- En las mañanas (7:00 - 10:00 AM VET) hay mayor volumen de venta de USDT, lo que puede indicar presión bajista.

${ctx.marketDataParts.join("\n\n")}

Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${ctx.historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Análisis de Venta**: (2 líneas máximo sobre si es buen momento para vender USDT)
💡 **Recomendación**: (VENDER AHORA o ESPERAR, con argumentos concretos usando los datos)
💰 **Precio estimado de venta**: (qué precio podrías obtener según los datos actuales)
🎯 **Objetivo de recompra**: (sugerencia de precio al que recomprar USDT después si vendes)
⏰ **Contexto horario**: (cómo influye la hora actual en tu decisión)
⚠️ **Nota**: (consideraciones adicionales relevantes)

Máximo 220 palabras en total. Responde en español.`;
}

function buildBuyPrompt(ctx: Awaited<ReturnType<typeof getMarketContext>>): string {
  return `Eres un analista experto en arbitraje del mercado venezolano. Tu tarea es analizar si es un BUEN MOMENTO PARA COMPRAR USDT (convertir Bs. a USDT).

Contexto del mercado:
- La tasa BCV (oficial) suele estar por debajo de la tasa paralela.
- Cuando el spread (diferencia paralelo vs BCV) es bajo (<1.5%), el USDT está más cerca de su valor "justo" y puede ser buen momento de compra.
- En las mañanas (7:00 - 10:00 AM VET) suele haber mayor volumen de venta de USDT porque la gente vende para comprar dólares en bancos a tasa BCV, lo que tiende a BAJAR el precio del USDT (buen momento para comprar barato).
- Un spread de mercado (diferencia entre mejor compra y mejor venta) angosto indica mercado líquido y eficiente.

${ctx.marketDataParts.join("\n\n")}

Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${ctx.historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Análisis de Compra**: (2 líneas máximo sobre si es buen momento para comprar USDT)
💡 **Recomendación**: (COMPRAR AHORA o ESPERAR, con argumentos concretos)
💰 **Precio estimado de compra**: (qué precio podrías obtener hoy)
📉 **Tendencia**: (el precio está subiendo, bajando o estable en las últimas horas)
⏰ **Contexto horario**: (cómo influye la hora actual en tu decisión)
⚠️ **Nota**: (consideraciones adicionales, ej. volumen disponible)

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

  return `Eres un analista experto en arbitraje del mercado venezolano. Tu tarea es analizar los TRADES ACTIVOS que el usuario tiene actualmente y dar recomendaciones personalizadas.

Contexto del mercado:
- La tasa BCV (oficial) suele estar por debajo de la tasa paralela.
- Para trades de VENTA: vendiste USDT esperando que el baje para recomprar más barato.
- Para trades de COMPRA: compraste USDT esperando que suba para vender más caro.

${ctx.marketDataParts.join("\n\n")}

Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${ctx.historyData}

TRADES ACTIVOS DEL USUARIO:
${tradesText || "No hay trades activos actualmente."}

Con base en los datos de mercado y los trades activos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Análisis de Mercado**: (2 líneas sobre la tendencia actual)
${openTrades.length > 0 ? `
📋 **Evaluación de Trades Activos**:
${openTrades.map((t) => {
  const currentPrice = ctx.latest?.price ?? 0;
  const diff = t.type === "sell"
    ? ((t.price - currentPrice) / t.price) * 100
    : ((currentPrice - t.price) / t.price) * 100;
  return `  • Trade #${t.id} (${t.type === "sell" ? "VENTA" : "COMPRA"}): ${diff >= 0 ? "✅ " : "⚠️ "}Actualmente estás ${diff >= 0 ? "ganando" : "perdiendo"} ~${Math.abs(diff).toFixed(2)}%. ${t.targetPrice ? `Tu objetivo es ${t.targetPrice.toFixed(2)} VES.` : ""}`;
}).join("\n")}
` : ""}
💡 **Recomendación Personalizada**:
${openTrades.length > 0
  ? `• ¿Cerrar algún trade ahora? ¿Esperar? ¿Ajustar objetivos?`
  : "• Consideraciones generales si decides abrir un trade."}
🎯 **Sugerencia de precio objetivo**: (basado en los patrones actuales)
⚠️ **Riesgos**: (factores que podrían afectar negativamente tus trades)
📌 **Próximo movimiento sugerido**: (acción concreta recomendada)

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
