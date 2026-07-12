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

    const records = await prisma.rate.findMany({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      take: 96,
      select: { price: true, fetchedAt: true },
    });

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

    const prompt = `Eres un analista experto en arbitraje del mercado venezolano. Tu tarea es analizar la evolución reciente de la tasa de cambio paralela USDT/VES (dólar paralelo) y dar una recomendación clara y práctica.

Contexto:
- La tasa BCV (oficial) suele estar por debajo de la tasa paralela.
- Una tasa paralela alta frente al BCV indica que el bolívar se está debilitando en el mercado libre.
- Si la tasa paralela está subiendo, conviene vender USDT pronto porque cada día rinden menos bolívares.
- Si la tasa está estable o bajando, se puede esperar.

Historial reciente de la tasa paralela (últimas ~48 horas, cada 30 min):
${historyData}

Con base en estos datos, responde EXACTAMENTE en este formato sin desviarte:

📊 **Resumen**: (2 líneas máximo describiendo la tendencia actual)
💡 **Recomendación**: (indicar si es buen momento para VENDER USDT o ESPERAR, y por qué)
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
