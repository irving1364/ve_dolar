"use client";

import { useState, useCallback, useEffect } from "react";
import TradePanel from "./TradePanel";
import {
  LineChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface RatePoint {
  price: number;
  time: string;
}

interface Record {
  source: string;
  price: number;
  time: string;
  buyPrice?: number;
  sellPrice?: number;
  buyVolume?: number;
  sellVolume?: number;
}

interface MarketSnapshot {
  price: number;
  buyPrice: number | null;
  sellPrice: number | null;
  buyVolume: number | null;
  sellVolume: number | null;
  bcvPrice: number | null;
}

interface HourlyPattern {
  hour: number;
  avgPrice: number;
  avgVolume: number;
  count: number;
  minPrice: number;
  maxPrice: number;
}

interface TradeData {
  id: number;
  type: string;
  amount: number;
  price: number;
  status: string;
  targetPrice: number | null;
  profit: number | null;
  profitPct: number | null;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
}

interface DashboardProps {
  latestMarket: MarketSnapshot | null;
  paraleloHistory: RatePoint[];
  bcvHistory: RatePoint[];
  recentRecords: Record[];
  trades: TradeData[];
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getHourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

export default function Dashboard({
  latestMarket,
  paraleloHistory,
  bcvHistory,
  recentRecords,
  trades,
}: DashboardProps) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(false);
  const [patterns, setPatterns] = useState<HourlyPattern[]>([]);

  useEffect(() => {
    fetch("/api/patterns/hourly")
      .then((res) => res.json())
      .then((data) => {
        if (data.hourly) setPatterns(data.hourly);
      })
      .catch(() => {});
  }, []);

  const chartData = [...paraleloHistory].reverse();

  const bcvLatest = latestMarket?.bcvPrice ?? null;

  const spreadPct =
    bcvLatest && latestMarket
      ? ((latestMarket.price - bcvLatest) / bcvLatest) * 100
      : null;

  const marketSpread =
    latestMarket?.buyPrice && latestMarket?.sellPrice
      ? latestMarket.sellPrice - latestMarket.buyPrice
      : null;

  const marketSpreadPct =
    marketSpread !== null && latestMarket?.sellPrice
      ? (marketSpread / latestMarket.sellPrice) * 100
      : null;

  const now = new Date();
  const currentHour = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Caracas",
      hour: "numeric",
      hour12: false,
    }).format(now)
  );

  const currentPattern = patterns.find((p) => p.hour === currentHour);
  const trend =
    patterns.length > 0 && currentPattern
      ? currentPattern.avgPrice > (patterns.find((p) => p.hour === (currentHour + 23) % 24)?.avgPrice ?? 0)
        ? "subiendo"
        : "bajando"
      : null;

  let signal: { text: string; color: string; emoji: string } = {
    text: "Esperar",
    color: "text-gray-500",
    emoji: "⏸️",
  };

  if (bcvLatest && latestMarket && marketSpreadPct !== null) {
    const isPeakHour = currentHour >= 7 && currentHour <= 10;
    const isLiquid = marketSpreadPct < 0.3;

    if (spreadPct! > 1.5 && isPeakHour && isLiquid) {
      signal = {
        text: "Fuerte señal — Vende USDT",
        color: "text-emerald-400",
        emoji: "🟢",
      };
    } else if (spreadPct! > 1.5 && isLiquid) {
      signal = {
        text: "Señal de venta — Spread favorable",
        color: "text-emerald-400",
        emoji: "✅",
      };
    } else if (spreadPct! > 1) {
      signal = {
        text: "Observar — Spread moderado",
        color: "text-yellow-400",
        emoji: "👀",
      };
    } else {
      signal = {
        text: "Esperar — Spread bajo",
        color: "text-gray-500",
        emoji: "⏸️",
      };
    }
  }

  const requestAdvice = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);

    try {
      const res = await fetch("/api/advice", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Error desconocido");
      }

      setAdvice(data.advice);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al conectar con la IA"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      {latestMarket && (latestMarket.buyVolume ?? 0) > 0 && (
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Mejor Compra
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {latestMarket.buyPrice
                  ? `${fmtNum(latestMarket.buyPrice)} VES`
                  : "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Vol:{" "}
                {latestMarket.buyVolume
                  ? `${fmtNum(latestMarket.buyVolume, 0)} USDT`
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Mejor Venta
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {latestMarket.sellPrice
                  ? `${fmtNum(latestMarket.sellPrice)} VES`
                  : "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Vol:{" "}
                {latestMarket.sellVolume
                  ? `${fmtNum(latestMarket.sellVolume, 0)} USDT`
                  : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Spread
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {marketSpread !== null
                  ? `${fmtNum(marketSpread)} VES`
                  : "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {marketSpreadPct !== null
                  ? `${marketSpreadPct.toFixed(3)}%`
                  : "—"}
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                signal.text.includes("Vende")
                  ? "border-emerald-800/50 bg-emerald-950/20"
                  : signal.text.includes("Observar")
                    ? "border-yellow-800/50 bg-yellow-950/20"
                    : "border-gray-800 bg-gray-900"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Señal de Arbitraje
              </p>
              <p className={`mt-1 text-lg font-bold ${signal.color}`}>
                {signal.emoji} {signal.text}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {bcvLatest
                  ? `Spread BCV: ${spreadPct?.toFixed(2)}%`
                  : "Esperando datos BCV"}
              </p>
            </div>
          </div>

          {currentPattern && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <p className="text-xs text-gray-500">Hora actual (VET)</p>
                <p className="text-lg font-semibold text-white">
                  {getHourLabel(currentHour)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <p className="text-xs text-gray-500">
                  Precio prom. histórico
                </p>
                <p className="text-lg font-semibold text-white">
                  {fmtNum(currentPattern.avgPrice)} VES
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3">
                <p className="text-xs text-gray-500">Tendencia horaria</p>
                <p className="text-lg font-semibold text-white">
                  {trend === "subiendo"
                    ? "📈 Subiendo"
                    : trend === "bajando"
                      ? "📉 Bajando"
                      : "—"}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">
          Evolución Tasa Paralela
        </h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              No hay datos disponibles. Espera a que el cron job recolecte
              tasas.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "#9CA3AF", fontSize: 11 }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "#9CA3AF", fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    color: "#F9FAFB",
                  }}
                  formatter={(value, name) => [
                    `${Number(value).toFixed(2)} VES`,
                    name === "price" ? "Paralelo" : name,
                  ]}
                />
                {bcvLatest && (
                  <ReferenceLine
                    y={bcvLatest}
                    stroke="#3B82F6"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{
                      value: `BCV ${bcvLatest.toFixed(2)}`,
                      fill: "#3B82F6",
                      fontSize: 11,
                      position: "insideTopLeft",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10B981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Asesoría de Arbitraje IA
          </h2>
          <button
            onClick={requestAdvice}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analizando…" : "Pedir recomendación"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {advice && (
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-5 text-sm leading-relaxed text-gray-200">
            {advice.split("\n").map((line, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {line}
              </p>
            ))}
          </div>
        )}
      </section>

      {patterns.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">
            Patrones por Hora (VET)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-400">
                    Hora
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Precio Prom
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Mínimo
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Máximo
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Vol. Prom (USDT)
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Muestras
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">
                    Señal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {patterns.map((p) => {
                  const isCurrent = p.hour === currentHour;
                  const isDip = p.avgPrice <= (patterns.reduce((min, x) => Math.min(min, x.avgPrice), Infinity));
                  const isPeak = p.avgPrice >= (patterns.reduce((max, x) => Math.max(max, x.avgPrice), -Infinity));
                  return (
                    <tr
                      key={p.hour}
                      className={`transition hover:bg-gray-900/50 ${
                        isCurrent ? "bg-emerald-950/10" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-white">
                        {getHourLabel(p.hour)}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-emerald-400">
                            ← ahora
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-white">
                        {fmtNum(p.avgPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                        {fmtNum(p.minPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-400">
                        {fmtNum(p.maxPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-400">
                        {p.avgVolume > 0
                          ? (p.avgVolume / 1000).toFixed(0) + "K"
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-500">
                        {p.count}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {isDip && p.count > 1
                          ? "🟢"
                          : isPeak && p.count > 1
                            ? "🔴"
                            : "⚪"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <TradePanel currentPrice={latestMarket?.price ?? null} />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Últimos Registros
          </h2>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-400 transition hover:border-gray-600 hover:text-white"
          >
            {showVolume ? "Ocultar volumen" : "Ver volumen"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 bg-gray-900">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-400">Hora</th>
                <th className="px-4 py-3 font-medium text-gray-400">Fuente</th>
                <th className="px-4 py-3 font-medium text-gray-400 text-right">
                  Precio (VES)
                </th>
                {showVolume && (
                  <>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">
                      Compra
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">
                      Venta
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">
                      Vol. Compra (USDT)
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-right">
                      Vol. Venta (USDT)
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentRecords.map((r) => (
                <tr
                  key={`${r.time}-${r.source}`}
                  className="transition hover:bg-gray-900/50"
                >
                  <td className="px-4 py-2.5 text-gray-400">{r.time}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.source === "bcv"
                          ? "bg-blue-950 text-blue-400"
                          : "bg-amber-950 text-amber-400"
                      }`}
                    >
                      {r.source === "bcv" ? "BCV" : "Paralelo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-white">
                    {r.price.toFixed(2)}
                  </td>
                  {showVolume && (
                    <>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                        {r.source === "paralelo" && r.buyPrice
                          ? r.buyPrice.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-400">
                        {r.source === "paralelo" && r.sellPrice
                          ? r.sellPrice.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-400">
                        {r.source === "paralelo" && r.buyVolume
                          ? r.buyVolume.toFixed(0)
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-gray-400">
                        {r.source === "paralelo" && r.sellVolume
                          ? r.sellVolume.toFixed(0)
                          : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {recentRecords.length === 0 && (
                <tr>
                  <td
                    colSpan={showVolume ? 7 : 3}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay registros aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
