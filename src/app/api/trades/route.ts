import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { type, amount, price, targetPrice, notes } = body;

    if (!type || !amount || !price) {
      return NextResponse.json(
        { error: "Faltan campos: type, amount, price" },
        { status: 400 }
      );
    }

    if (!["sell", "buy"].includes(type)) {
      return NextResponse.json(
        { error: "type debe ser 'sell' o 'buy'" },
        { status: 400 }
      );
    }

    const trade = await prisma.trade.create({
      data: {
        type,
        amount: parseFloat(amount),
        price: parseFloat(price),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ trade });
  } catch (err) {
    console.error("Error creando trade:", err);
    return NextResponse.json(
      { error: "Error al crear trade" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "open";

    const trades = await prisma.trade.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ trades });
  } catch (err) {
    console.error("Error listando trades:", err);
    return NextResponse.json(
      { error: "Error al listar trades" },
      { status: 500 }
    );
  }
}
