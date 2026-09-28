import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [userCount, telegramConnectedCount, tradeCount, openTradeCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.userSettings.count({ where: { telegramChatId: { not: null } } }),
      prisma.trade.count(),
      prisma.trade.count({ where: { status: "open" } }),
    ]);

  return NextResponse.json({
    userCount,
    telegramConnectedCount,
    tradeCount,
    openTradeCount,
  });
}
