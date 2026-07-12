import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export async function POST(): Promise<NextResponse> {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY no configurada" },
        { status: 500 }
      );
    }

    const groq = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    });

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

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No hay datos históricos disponibles" },
        { status: 404 }
      );
    }

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

    const prompt = `Eres un analista experto en arbitraje del mercado venezolano. Tu tarea es analizar la evolución reciente de la tasa de cambio paralela USDT/VES (dólar paralelo) y dar una recomendación clara y práctica.

Contexto del mercado:
- La tasa BCV (oficial) suele estar por debajo de la tasa paralela.
- El mercado en Venezuela tiene patrones horarios predecibles.
- En las mañanas (7:00 - 10:00 AM VET) suele haber mayor volumen de venta de USDT porque la gente vende para comprar dólares en bancos a tasa BCV, lo que tiende a bajar el precio del USDT (buen momento para comprar USDT barato).
- Si la tasa paralela está subiendo sostenidamente, conviene vender USDT pronto.
- Si la tasa está estable o bajando, se puede esperar.

${marketDataParts.join("\n\n")}

Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Resumen**: (2 líneas máximo describiendo la tendencia actual, considerando la hora del día y el spread)
💡 **Recomendación**: (indicar si es buen momento para VENDER USDT o ESPERAR, y por qué, mencionando la hora si es relevante)
🎯 **Soporte/Resistencia**: (mencionar niveles clave si se pueden inferir)
⏰ **Contexto horario**: (mencionar si la hora actual favorece o no la operación, según patrones típicos del mercado venezolano)
⚠️ **Nota**: (cualquier consideración adicional relevante)

Máximo 220 palabras en total. Responde en español.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const advice = completion.choices[0]?.message?.content ?? null;

    return NextResponse.json({
      advice,
      recordsAnalyzed: records.length,
      lastDate: records[0]?.fetchedAt.toISOString(),
    });
  } catch (err) {
    console.error("Error en /api/advice:", err);
    return NextResponse.json(
      { error: "Error al obtener recomendación de la IA" },
      { status: 500 }
    );
  }
}
