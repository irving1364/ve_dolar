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

    const [records, latest] = await Promise.all([
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
    ]);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No hay datos históricos disponibles" },
        { status: 404 }
      );
    }

    const historyData = records
      .map(
        (r) =>
          `${r.fetchedAt.toISOString().slice(0, 16)} → ${r.price.toFixed(2)} VES`
      )
      .join("\n");

    const marketData = latest?.buyVolume
      ? `
📊 Datos de mercado en vivo (Binance P2P):
• Mejor precio compra: ${latest.buyPrice?.toFixed(2)} VES
• Mejor precio venta: ${latest.sellPrice?.toFixed(2)} VES
• Volumen total demanda (compradores): ${latest.buyVolume?.toFixed(0)} USDT
• Volumen total oferta (vendedores): ${latest.sellVolume?.toFixed(0)} USDT
• Spread: ${(latest.sellPrice! - latest.buyPrice!).toFixed(2)} VES (${(((latest.sellPrice! - latest.buyPrice!) / latest.sellPrice!) * 100).toFixed(3)}%)
• Precio promedio actual: ${latest.price.toFixed(2)} VES
`
      : "";

    const prompt = `Eres un analista experto en arbitraje del mercado venezolano. Tu tarea es analizar la evolución reciente de la tasa de cambio paralela USDT/VES (dólar paralelo) y dar una recomendación clara y práctica.

Contexto:
- La tasa BCV (oficial) suele estar por debajo de la tasa paralela.
- Una tasa paralela alta frente al BCV indica que el bolívar se está debilitando en el mercado libre.
- Si la tasa paralela está subiendo, conviene vender USDT pronto porque cada día rinden menos bolívares.
- Si la tasa está estable o bajando, se puede esperar.
- El volumen de compra/venta indica la profundidad del mercado: alto volumen = mercado líquido, bajo volumen = mercado seco con posible volatilidad.
- Un spread (diferencia compra/venta) estrecho indica mercado eficiente; spread amplio indica iliquidez.

${marketData}
Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Resumen**: (2 líneas máximo describiendo la tendencia actual, incluyendo contexto de volumen si está disponible)
💡 **Recomendación**: (indicar si es buen momento para VENDER USDT o ESPERAR, y por qué, considerando la liquidez)
🎯 **Soporte/Resistencia**: (mencionar niveles clave si se pueden inferir)
⚠️ **Nota**: (cualquier consideración adicional relevante)

Máximo 200 palabras en total. Responde en español.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
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
