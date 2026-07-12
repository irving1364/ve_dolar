import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (action !== "close") {
      return NextResponse.json(
        { error: "Accion no valida. Usa action: 'close'" },
        { status: 400 }
      );
    }

    const trade = await prisma.trade.findUnique({
      where: { id: parseInt(id) },
    });

    if (!trade || trade.status !== "open") {
      return NextResponse.json(
        { error: "Trade no encontrado o ya cerrado" },
        { status: 404 }
      );
    }

    const latestRate = await prisma.rate.findFirst({
      where: { source: "paralelo" },
      orderBy: { fetchedAt: "desc" },
      select: { price: true },
    });

    const currentPrice = latestRate?.price ?? 0;
    let profit: number | null = null;
    let profitPct: number | null = null;

    if (trade.type === "sell" && currentPrice > 0) {
      profit = (trade.price - currentPrice) * trade.amount;
      profitPct = ((trade.price - currentPrice) / trade.price) * 100;
    } else if (trade.type === "buy" && currentPrice > 0) {
      profit = (currentPrice - trade.price) * trade.amount;
      profitPct = ((currentPrice - trade.price) / trade.price) * 100;
    }

    const closed = await prisma.trade.update({
      where: { id: trade.id },
      data: {
        status: "closed",
        closedAt: new Date(),
        profit,
        profitPct,
        targetPrice: currentPrice,
      },
    });

    return NextResponse.json({ trade: closed });
  } catch (err) {
    console.error("Error cerrando trade:", err);
    return NextResponse.json(
      { error: "Error al cerrar trade" },
      { status: 500 }
    );
  }
}
