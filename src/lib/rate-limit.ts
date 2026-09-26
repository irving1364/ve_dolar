/**
 * Rate limiter en memoria, por instancia del proceso. Suficiente para frenar
 * abuso accidental/manual en una app de un solo despliegue; no coordina
 * entre múltiples instancias serverless concurrentes.
 */
const lastCallAt = new Map<string, number>();

export function isRateLimited(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = lastCallAt.get(key);
  if (last !== undefined && now - last < windowMs) {
    return true;
  }
  lastCallAt.set(key, now);
  return false;
}
