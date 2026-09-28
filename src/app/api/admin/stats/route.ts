import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Unico correo con permiso para ver este endpoint (incluye la lista de
// usuarios registrados). Cambialo si tu cuenta de owner es otra.
const ADMIN_EMAIL = "irving1364@gmail.com";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }

  const [userCount, telegramConnectedCount, tradeCount, openTradeCount, users] =
    await Promise.all([
      prisma.user.count(),
      prisma.userSettings.count({ where: { telegramChatId: { not: null } } }),
      prisma.trade.count(),
      prisma.trade.count({ where: { status: "open" } }),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          settings: { select: { telegramChatId: true, notifications: true } },
          _count: { select: { trades: true } },
        },
      }),
    ]);

  return NextResponse.json({
    userCount,
    telegramConnectedCount,
    tradeCount,
    openTradeCount,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      telegramConnected: !!u.settings?.telegramChatId,
      notifications: u.settings?.notifications ?? null,
      tradeCount: u._count.trades,
    })),
  });
}
