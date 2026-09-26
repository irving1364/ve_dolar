import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeCloseProfit } from "@/lib/trades";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    // Verify ownership
    const existing = await prisma.trade.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Trade no encontrado" },
        { status: 404 }
      );
    }

    if (action === "close") {
      if (existing.status !== "open") {
        return NextResponse.json(
          { error: "Trade ya cerrado" },
          { status: 400 }
        );
      }

      const latestRate = await prisma.rate.findFirst({
        where: { source: "paralelo", exchange: "binance" },
        orderBy: { fetchedAt: "desc" },
        select: { price: true },
      });

      const currentPrice = latestRate?.price ?? 0;
      let profit: number | null = null;
      let profitPct: number | null = null;

      if (currentPrice > 0 && existing.amount > 0) {
        const result = computeCloseProfit(
          existing.type as "sell" | "buy",
          existing.price,
          currentPrice,
          existing.amount
        );
        profit = result?.profit ?? null;
        profitPct = result?.profitPct ?? null;
      }

      const closed = await prisma.trade.update({
        where: { id: existing.id },
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
      const {
        type,
        amount,
        price,
        targetPrice,
        notes,
        status,
        profit,
        profitPct,
        closedAt,
      } = body;

      if (status !== undefined && !["open", "closed"].includes(status)) {
        return NextResponse.json(
          { error: "status debe ser 'open' o 'closed'" },
          { status: 400 }
        );
      }

      const updated = await prisma.trade.update({
        where: { id: existing.id },
        data: {
          ...(type !== undefined && { type }),
          ...(amount !== undefined && { amount: parseFloat(amount) }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(targetPrice !== undefined && {
            targetPrice: targetPrice !== null ? parseFloat(targetPrice) : null,
          }),
          ...(notes !== undefined && { notes }),
          ...(status !== undefined && { status }),
          ...(profit !== undefined && {
            profit: profit !== null ? parseFloat(profit) : null,
          }),
          ...(profitPct !== undefined && {
            profitPct: profitPct !== null ? parseFloat(profitPct) : null,
          }),
          ...(closedAt !== undefined && {
            closedAt: closedAt ? new Date(closedAt) : null,
          }),
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const trade = await prisma.trade.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
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
