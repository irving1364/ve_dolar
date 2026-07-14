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
    const status = searchParams.get("status"); // "open" | "closed" | null (all)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") ?? "15")));

    const where = status && status !== "all" ? { status } : {};

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.trade.count({ where }),
    ]);

    return NextResponse.json({
      trades,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error("Error listando trades:", err);
    return NextResponse.json(
      { error: "Error al listar trades" },
      { status: 500 }
    );
  }
}
