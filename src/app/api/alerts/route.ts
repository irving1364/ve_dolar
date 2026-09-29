import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { direction, targetPrice } = body;

  if (direction !== "above" && direction !== "below") {
    return NextResponse.json(
      { error: "direction debe ser 'above' o 'below'" },
      { status: 400 }
    );
  }

  const price = parseFloat(targetPrice);
  if (!isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "targetPrice debe ser un numero mayor a 0" },
      { status: 400 }
    );
  }

  const activeCount = await prisma.priceAlert.count({
    where: { userId: session.user.id, active: true },
  });
  if (activeCount >= 10) {
    return NextResponse.json(
      { error: "Ya tienes el maximo de 10 alertas activas" },
      { status: 400 }
    );
  }

  const alert = await prisma.priceAlert.create({
    data: { userId: session.user.id, direction, targetPrice: price },
  });

  return NextResponse.json({ alert });
}
