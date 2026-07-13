import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Faltan variables de entorno: TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID",
      },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `<b>✅ Prueba exitosa</b>\n\nLas notificaciones Telegram de <b>VE Dólar</b> están funcionando correctamente.\n\nRecibirás alertas cuando un trade alcance su precio objetivo. 🎯`,
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data.description ?? "Error desconocido de Telegram",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Mensaje de prueba enviado con éxito a Telegram 📱✅",
    });
  } catch (err) {
    console.error("Error en test-telegram:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Error al conectar con Telegram",
      },
      { status: 500 }
    );
  }
}
