const TASAS_ACTUAL_URL = "https://hdavzla.com/api/portal/tasas/actual";

interface TasaActual {
  moneda: string;
  valor: number;
  timestamp: string | null;
}

/**
 * Lee la tasa de INTERVENCION real publicada por hdavzla.com. Retorna null
 * si la API no responde o no incluye ese renglon (best-effort, no critico).
 */
export async function fetchIntervencionRate(): Promise<number | null> {
  const res = await fetch(TASAS_ACTUAL_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al leer tasas/actual`);

  const data: { data?: TasaActual[] } = await res.json();
  const row = data.data?.find((d) => d.moneda === "INTERVENCION");
  return row && isFinite(row.valor) && row.valor > 0 ? row.valor : null;
}
