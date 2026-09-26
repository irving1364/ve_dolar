import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";

const TEST_TELEGRAM_RATE_LIMIT_MS = 30_000;

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    if (isRateLimited(`test-telegram:${session.user.id}`, TEST_TELEGRAM_RATE_LIMIT_MS)) {
      return NextResponse.json(
        { ok: false, error: "Espera unos segundos antes de probar de nuevo" },
        { status: 429 }
      );
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!settings?.telegramChatId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No has configurado tu Chat ID de Telegram. Ve a Configuración para hacerlo.",
        },
        { status: 400 }
      );
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "TELEGRAM_BOT_TOKEN no configurado en el servidor",
        },
        { status: 500 }
      );
    }

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: `<b>✅ Prueba exitosa</b>\n\nLas notificaciones Telegram de <b>VE Dólar</b> están funcionando correctamente.\n\nRecibirás alertas cuando un trade alcance su precio objetivo y señales de mercado personalizadas 🎯`,
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
          err instanceof Error ? err.message : "Error al conectar con Telegram",
      },
      { status: 500 }
    );
  }
}
