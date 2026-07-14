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

    if (action === "close") {
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
    }

    if (action === "edit") {
      const trade = await prisma.trade.findUnique({
        where: { id: parseInt(id) },
      });

      if (!trade) {
        return NextResponse.json(
          { error: "Trade no encontrado" },
          { status: 404 }
        );
      }

      const { type, amount, price, targetPrice, notes, status, profit, profitPct, closedAt } = body;

      const updated = await prisma.trade.update({
        where: { id: trade.id },
        data: {
          ...(type !== undefined && { type }),
          ...(amount !== undefined && { amount: parseFloat(amount) }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(targetPrice !== undefined && { targetPrice: targetPrice !== null ? parseFloat(targetPrice) : null }),
          ...(notes !== undefined && { notes }),
          ...(status !== undefined && { status }),
          ...(profit !== undefined && { profit: profit !== null ? parseFloat(profit) : null }),
          ...(profitPct !== undefined && { profitPct: profitPct !== null ? parseFloat(profitPct) : null }),
          ...(closedAt !== undefined && { closedAt: closedAt ? new Date(closedAt) : null }),
        },
      });

      return NextResponse.json({ trade: updated });
    }

    return NextResponse.json(
      { error: "Accion no valida. Usa action: 'close' o 'edit'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Error actualizando trade:", err);
    return NextResponse.json(
      { error: "Error al actualizar trade" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const trade = await prisma.trade.findUnique({
      where: { id: parseInt(id) },
    });

    if (!trade) {
      return NextResponse.json(
        { error: "Trade no encontrado" },
        { status: 404 }
      );
    }

    await prisma.trade.delete({
      where: { id: trade.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error eliminando trade:", err);
    return NextResponse.json(
      { error: "Error al eliminar trade" },
      { status: 500 }
    );
  }
}
