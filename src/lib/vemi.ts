import type { AperturaEntry } from "./aperturas";

const CHANNEL_URL = "https://t.me/s/vemioficial";

// Nombres reconocidos de bancos, con sus variantes/abreviaturas comunes en
// el canal. La clave es como se guarda en nuestra tabla; el valor es la
// lista de patrones que, si aparecen en el texto, se mapean a esa clave.
const BANK_PATTERNS: [string, RegExp][] = [
  ["Banco de Venezuela", /\bBDV\b|\bBanco de Venezuela\b/i],
  ["Banco del Tesoro", /\bBT\b|\bBanco del Tesoro\b/i],
  ["BNC", /\bBNC\b|\bBanco Nacional de Cr[eé]dito\b/i],
  ["Provincial", /\bProvincial\b/i],
  ["Banesco", /\bBanesco\b/i],
  ["Mercantil", /\bMercantil\b/i],
  ["Bancaribe", /\bBancaribe\b/i],
  ["Banco Activo", /\bBanco Activo\b/i],
  ["100%Banco", /\b100%\s*Banco\b/i],
  ["Banplus", /\bBanplus\b/i],
  ["Sofitasa", /\bSofitasa\b/i],
  ["Bicentenario", /\bBicentenario\b/i],
  ["Banco Caroní", /\bBanco Caron[ií]\b/i],
  ["Banco Exterior", /\bBanco Exterior\b/i],
  ["Banco Plaza", /\bBanco Plaza\b/i],
];

// Ojo: sin \b al final de las alternativas que terminan en vocal acentuada
// (ó) — en JS, \b se basa en \w/\W ASCII, y una vocal con tilde no cuenta
// como \w, asi que "\bactiv[oó]\b" nunca haria match seguido de espacio.
const ACTION_KEYWORDS =
  /\b(abri[oó]|abre|abriendo|abiert[oa]|activ[oó]|activa|habilit[oó]|aprob[oó]|aprobando|aprobad[oa]|liberando|liber[oó])/i;

const EXCLUDE_KEYWORDS = /estafa|fraude/i;

const MECHANISM_PATTERNS: [string, RegExp][] = [
  ["Intervencion Electronica", /intervenci[oó]n\s+electr[oó]nica/i],
  ["Mesa de Cambio", /mesa\s+de\s+cambio/i],
  ["Menudeo", /menudeo/i],
];

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0*36;/g, "$")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTimeOfDay(text: string): string | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.?m\.?|p\.?m\.?)?\b/i);
  if (!m) return null;
  const hour = m[1].padStart(2, "0");
  const minute = m[2];
  const meridiem = m[3] ? (m[3].toLowerCase().startsWith("p") ? "PM" : "AM") : null;
  return meridiem ? `${hour}:${minute} ${meridiem}` : `${hour}:${minute}`;
}

function formatTimeFromDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

interface TelegramMessage {
  text: string;
  timestamp: Date;
}

function parseChannelHtml(html: string): TelegramMessage[] {
  const blocks = html.split(/<div class="tgme_widget_message [^"]*" data-post="/).slice(1);
  const messages: TelegramMessage[] = [];

  for (const block of blocks) {
    const timeMatch = block.match(/<time datetime="([^"]+)"/);
    if (!timeMatch) continue;
    const timestamp = new Date(timeMatch[1]);
    if (isNaN(timestamp.getTime())) continue;

    const textMatch = block.match(
      /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/
    );
    if (!textMatch) continue;

    const text = stripHtml(textMatch[1]);
    if (!text) continue;

    messages.push({ text, timestamp });
  }

  return messages;
}

/**
 * Intenta reconocer "aperturas" de bancos a partir de texto libre publicado
 * en el canal de Telegram @vemioficial. A diferencia del parser de
 * hdavzla.com (marcado fijo), esto es heuristico: requiere que el mensaje
 * mencione un banco conocido Y una palabra de accion (abrio/activo/etc).
 * Puede perder mensajes con redaccion distinta, o no capturar mecanismo/
 * duracion si el texto no los menciona explicitamente — es best-effort.
 */
export function parseVemiMessages(messages: TelegramMessage[]): AperturaEntry[] {
  const entries: AperturaEntry[] = [];

  for (const msg of messages) {
    if (EXCLUDE_KEYWORDS.test(msg.text)) continue;
    if (!ACTION_KEYWORDS.test(msg.text)) continue;

    const bank = BANK_PATTERNS.find(([, re]) => re.test(msg.text))?.[0];
    if (!bank) continue;

    const mechanism =
      MECHANISM_PATTERNS.find(([, re]) => re.test(msg.text))?.[0] ?? "Intervencion";

    const time = extractTimeOfDay(msg.text) ?? formatTimeFromDate(msg.timestamp);

    const dateStr = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(msg.timestamp);

    const [day, month, year] = dateStr.split("/");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    entries.push({ dateStr, date, bank, mechanism, time, duration: null });
  }

  return entries;
}

function todayVetDateStr(): string {
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export async function fetchTodayVemiAperturas(): Promise<AperturaEntry[]> {
  const res = await fetch(CHANNEL_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer canal de Telegram`);

  const html = await res.text();
  const messages = parseChannelHtml(html);
  const entries = parseVemiMessages(messages);
  const today = todayVetDateStr();
  return entries.filter((e) => e.dateStr === today);
}
