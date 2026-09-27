import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limit";

const CODE_TTL_MS = 10 * 60 * 1000;
const START_RATE_LIMIT_MS = 5_000;
const CHECK_RATE_LIMIT_MS = 1_500;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number };
  };
}

async function fetchTelegramUpdates(token: string): Promise<TelegramUpdate[]> {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?limit=100`,
    { signal: AbortSignal.timeout(10000) }
  );
  const data = await res.json();
  return data.ok ? data.result : [];
}

async function ackTelegramUpdates(token: string, updates: TelegramUpdate[]): Promise<void> {
  if (updates.length === 0) return;
  const maxId = Math.max(...updates.map((u) => u.update_id));
  await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?offset=${maxId + 1}&limit=1`,
    { signal: AbortSignal.timeout(10000) }
  ).catch(() => {});
}

/**
 * Procesa todos los mensajes pendientes del bot y los cruza contra CUALQUIER
 * codigo de vinculacion activo (no solo el del usuario que consulta), porque
 * el mismo lote de updates de Telegram es compartido entre todos los usuarios
 * que esten vinculando su cuenta al mismo tiempo.
 */
async function processPendingLinks(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const pending = await prisma.userSettings.findMany({
    where: {
      linkCode: { not: null },
      linkCodeExpiresAt: { gt: new Date() },
    },
    select: { userId: true, linkCode: true },
  });

  const updates = await fetchTelegramUpdates(token);
  if (updates.length === 0) return;

  if (pending.length > 0) {
    const byCode = new Map(pending.map((p) => [p.linkCode, p.userId]));

    for (const update of updates) {
      const text = update.message?.text?.trim();
      const chatId = update.message?.chat?.id;
      if (!text || chatId === undefined) continue;

      const userId = byCode.get(text);
      if (!userId) continue;

      await prisma.userSettings.update({
        where: { userId },
        data: {
          telegramChatId: String(chatId),
          linkCode: null,
          linkCodeExpiresAt: null,
        },
      });
      byCode.delete(text);
    }
  }

  await ackTelegramUpdates(token, updates);
}

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isRateLimited(`telegram-link-start:${session.user.id}`, START_RATE_LIMIT_MS)) {
    return NextResponse.json(
      { error: "Espera unos segundos antes de generar otro código" },
      { status: 429 }
    );
  }

  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.userSettings.findUnique({ where: { linkCode: code } });
    if (!clash) break;
    code = generateCode();
  }

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      linkCode: code,
      linkCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
    update: {
      linkCode: code,
      linkCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  return NextResponse.json({
    code,
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    botUsername: "vedolar_alertas_bot",
  });
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isRateLimited(`telegram-link-check:${session.user.id}`, CHECK_RATE_LIMIT_MS)) {
    return NextResponse.json(
      { error: "Espera un momento antes de volver a verificar" },
      { status: 429 }
    );
  }

  try {
    await processPendingLinks();
  } catch (err) {
    console.error("Error procesando vinculacion de Telegram:", err);
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  if (settings?.telegramChatId && !settings.linkCode) {
    return NextResponse.json({ linked: true, telegramChatId: settings.telegramChatId });
  }

  const expired =
    !settings?.linkCode ||
    (settings.linkCodeExpiresAt !== null && settings.linkCodeExpiresAt < new Date());

  return NextResponse.json({ linked: false, expired });
}
