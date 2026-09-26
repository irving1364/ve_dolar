import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: session.user.id },
      });
    }

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Error getting settings:", err);
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { telegramChatId, notifications } = body;

    if (
      telegramChatId !== undefined &&
      telegramChatId !== null &&
      !/^-?\d+$/.test(String(telegramChatId).trim())
    ) {
      return NextResponse.json(
        { error: "telegramChatId debe ser un identificador numérico de Telegram" },
        { status: 400 }
      );
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        telegramChatId: telegramChatId ?? null,
        notifications: notifications ?? true,
      },
      update: {
        ...(telegramChatId !== undefined && {
          telegramChatId: telegramChatId ?? null,
        }),
        ...(notifications !== undefined && { notifications }),
      },
    });

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Error updating settings:", err);
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}
