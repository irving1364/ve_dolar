import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const alert = await prisma.priceAlert.findFirst({
    where: { id: parseInt(id), userId: session.user.id },
  });
  if (!alert) {
    return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
  }

  await prisma.priceAlert.delete({ where: { id: alert.id } });

  return NextResponse.json({ success: true });
}
