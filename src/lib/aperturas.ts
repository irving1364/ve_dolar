const APERTURAS_URL = "https://hdavzla.com/app/aperturas";

export interface AperturaEntry {
  /** Fecha tal cual aparece en la fuente, formato dd/mm/aaaa. */
  dateStr: string;
  date: Date;
  bank: string;
  mechanism: string;
  time: string;
  duration: string | null;
}

/**
 * Parsea las tarjetas de "apertura" del HTML server-renderizado de
 * hdavzla.com/app/aperturas. El sitio no expone una API publica para este
 * historico, asi que se extrae directo del marcado: cada apertura es un
 * <li> con una <dl> de 5 pares dt/dd (Fecha, Banco, Mecanismo, Hora,
 * Duracion), siempre en ese orden. Si hdavzla cambia su marcado esto puede
 * dejar de encontrar filas; se disenó para fallar en silencio (retorna [])
 * en vez de lanzar, ya que es un dato complementario, no critico.
 */
export function parseAperturasHtml(html: string): AperturaEntry[] {
  const cards = html.match(/<li[^>]*>\s*<dl[^>]*>[\s\S]*?<\/dl>\s*<\/li>/g) ?? [];
  const entries: AperturaEntry[] = [];

  for (const card of cards) {
    const spans = [...card.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) =>
      m[1].trim()
    );
    if (spans.length < 4) continue;

    const [dateStr, bank, mechanism, time, duration] = spans;
    if (!dateStr || !bank || !mechanism || !time) continue;

    const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dateMatch) continue;
    const [, day, month, year] = dateMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    entries.push({
      dateStr,
      date,
      bank,
      mechanism,
      time,
      duration: duration || null,
    });
  }

  return entries;
}

function todayVetDateStr(): string {
  const fmt = new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const parts = fmt.formatToParts(new Date());
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  return `${day}/${month}/${year}`;
}

/** Obtiene las aperturas de HOY (hora de Venezuela) desde hdavzla.com. */
export async function fetchTodayAperturas(): Promise<AperturaEntry[]> {
  const res = await fetch(APERTURAS_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer aperturas`);

  const html = await res.text();
  const all = parseAperturasHtml(html);
  const today = todayVetDateStr();
  return all.filter((e) => e.dateStr === today);
}
