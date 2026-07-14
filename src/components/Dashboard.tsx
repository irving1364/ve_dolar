"use client";

import { useState, useCallback, useEffect } from "react";
import TradePanel from "./TradePanel";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
  buyVolume?: number;
  sellVolume?: number;
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
  avgBuyVolume: number;
  avgSellVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
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

interface RatesResponse {
  paraleloHistory: RatePoint[];
  bcvHistory: RatePoint[];
  recentRecords: Record[];
  recentTotal: number;
  recordsPage: number;
  recordsPerPage: number;
  totalPages: number;
  latestMarket: MarketSnapshot | null;
  trades: TradeData[];
  tradesTotal: number;
  tradesPage: number;
  tradesPerPage: number;
  tradesTotalPages: number;
}

type TimeRange = "today" | "3d" | "week" | "month";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "3d", label: "3 días" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getHourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

type AdviceType = "sell" | "buy" | "analyze";

const ADVICE_CONFIG: {
  [K in AdviceType]: { label: string; color: string; hoverColor: string; icon: string }
} = {
  sell: {
    label: "Venta",
    color: "bg-amber-600",
    hoverColor: "hover:bg-amber-500",
    icon: "💰",
  },
  buy: {
    label: "Compra",
    color: "bg-emerald-600",
    hoverColor: "hover:bg-emerald-500",
    icon: "🟢",
  },
  analyze: {
    label: "Analizar Trade",
    color: "bg-violet-600",
    hoverColor: "hover:bg-violet-500",
    icon: "🔍",
  },
};

export default function Dashboard({
  latestMarket: initialMarket,
  paraleloHistory: initialParalelo,
  bcvHistory: initialBcv,
  recentRecords: initialRecords,
  trades: initialTrades,
}: DashboardProps) {
  const [adviceState, setAdviceState] = useState<{
    [K in AdviceType]: {
      advice: string | null;
      loading: boolean;
      error: string | null;
    };
  }>({
    sell: { advice: null, loading: false, error: null },
    buy: { advice: null, loading: false, error: null },
    analyze: { advice: null, loading: false, error: null },
  });
  const [showVolume, setShowVolume] = useState(false);
  const [patterns, setPatterns] = useState<HourlyPattern[]>([]);

  // Time range & pagination state
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [isFetching, setIsFetching] = useState(false);
  const [latestMarket, setLatestMarket] = useState<MarketSnapshot | null>(
    initialMarket
  );
  const [paraleloHistory, setParaleloHistory] =
    useState<RatePoint[]>(initialParalelo);
  const [bcvHistory, setBcvHistory] = useState<RatePoint[]>(initialBcv);
  const [recentRecords, setRecentRecords] =
    useState<Record[]>(initialRecords);
  const [recordsPage, setRecordsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [trades, setTrades] = useState<TradeData[]>(initialTrades);
  const [tradesPage, setTradesPage] = useState(1);
  const [tradesTotalPages, setTradesTotalPages] = useState(1);

  // Fetch data based on range and pagination
  const fetchRates = useCallback(
    async (range: TimeRange, rPage: number, tPage: number) => {
      setIsFetching(true);
      try {
        const res = await fetch(
          `/api/rates?range=${range}&recordsPage=${rPage}&tradesPage=${tPage}`
        );
        const data: RatesResponse = await res.json();
        setLatestMarket(data.latestMarket);
        setParaleloHistory(data.paraleloHistory);
        setBcvHistory(data.bcvHistory);
        setRecentRecords(data.recentRecords);
        setTotalPages(data.totalPages);
        setTrades(data.trades);
        setTradesTotalPages(data.tradesTotalPages);
      } catch {
        // Keep existing data on error
      } finally {
        setIsFetching(false);
      }
    },
    []
  );

  // Fetch data when timeRange, recordsPage, or tradesPage changes
  useEffect(() => {
    fetchRates(timeRange, recordsPage, tradesPage);
  }, [timeRange, recordsPage, tradesPage, fetchRates]);

  const handleRangeChange = (range: TimeRange) => {
    setRecordsPage(1);
    setTradesPage(1);
    setTimeRange(range);
  };

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
      ? currentPattern.avgPrice >
        (patterns.find((p) => p.hour === (currentHour + 23) % 24)
          ?.avgPrice ?? 0)
        ? "subiendo"
        : "bajando"
      : null;

  // ── Mejores horas para comprar/vender basado en perfil de volumen ──
  const bestHours = patterns.length > 0
    ? (() => {
        const maxBuy = Math.max(...patterns.map(p => p.avgBuyVolume), 1);
        const maxSell = Math.max(...patterns.map(p => p.avgSellVolume), 1);
        const minPriceAll = Math.min(...patterns.map(p => p.avgPrice));
        const maxPriceAll = Math.max(...patterns.map(p => p.avgPrice));
        const priceRange = maxPriceAll - minPriceAll || 1;

        const scored = patterns.map(p => {
          const buyVolRatio = p.avgBuyVolume / maxBuy;
          const sellVolRatio = p.avgSellVolume / maxSell;
          const priceHighRatio = (p.avgPrice - minPriceAll) / priceRange;
          const priceLowRatio = 1 - priceHighRatio;

          // Sell score: high demand (buy volume) + price near top
          const sellScore = buyVolRatio * 0.5 + priceHighRatio * 0.5;
          // Buy score: high supply (sell volume) + price near bottom
          const buyScore = sellVolRatio * 0.5 + priceLowRatio * 0.5;

          return { ...p, sellScore, buyScore };
        });

        const bestSell = [...scored]
          .sort((a, b) => b.sellScore - a.sellScore)
          .slice(0, 3)
          .map(h => h.hour);
        const bestBuy = [...scored]
          .sort((a, b) => b.buyScore - a.buyScore)
          .slice(0, 3)
          .map(h => h.hour);

        return { scored, bestSell: new Set(bestSell), bestBuy: new Set(bestBuy) };
      })()
    : null;

  const bestSellSet = bestHours?.bestSell ?? new Set<number>();
  const bestBuySet = bestHours?.bestBuy ?? new Set<number>();
  const scoredPatterns = bestHours?.scored ?? [];

  // Compute average price from history for signal generation
  const avgParaleloPrice =
    paraleloHistory.length > 0
      ? paraleloHistory.reduce((s, p) => s + p.price, 0) /
        paraleloHistory.length
      : 0;
  const pctAboveAvg =
    avgParaleloPrice > 0 && latestMarket
      ? ((latestMarket.price - avgParaleloPrice) / avgParaleloPrice) * 100
      : 0;
  const buyVol = latestMarket?.buyVolume ?? 0;
  const sellVol = latestMarket?.sellVolume ?? 0;
  const isLiquid =
    marketSpreadPct !== null ? marketSpreadPct < 0.3 : false;

  let signal: { text: string; color: string; emoji: string } = {
    text: "Esperar",
    color: "text-gray-500",
    emoji: "⏸️",
  };

  if (latestMarket && paraleloHistory.length > 10) {
    // Sell signal: price significantly above average + good demand
    if (pctAboveAvg > 0.8 && buyVol > 5000 && isLiquid) {
      signal = {
        text: "🟢 VENDE USDT — Precio alto vs promedio",
        color: "text-emerald-400",
        emoji: "🟢",
      };
    } else if (pctAboveAvg > 0.5 && buyVol > 3000) {
      signal = {
        text: "✅ Vende — Precio por encima del promedio",
        color: "text-emerald-400",
        emoji: "✅",
      };
    }
    // Buy signal: price significantly below average + good supply
    else if (pctAboveAvg < -0.5 && sellVol > 5000 && isLiquid) {
      signal = {
        text: "🟣 COMPRA USDT — Precio bajo vs promedio",
        color: "text-violet-400",
        emoji: "🟣",
      };
    } else if (pctAboveAvg < -0.3 && sellVol > 3000) {
      signal = {
        text: "✅ Compra — Precio por debajo del promedio",
        color: "text-violet-400",
        emoji: "✅",
      };
    }
    // Neutral/moderate signals
    else if (Math.abs(pctAboveAvg) < 0.3) {
      signal = {
        text: "Estable — Precio cerca del promedio",
        color: "text-yellow-400",
        emoji: "⚖️",
      };
    } else {
      signal = {
        text: "Esperar — Sin señal clara",
        color: "text-gray-500",
        emoji: "⏸️",
      };
    }
  }

  const requestAdvice = useCallback(async (type: AdviceType) => {
    setAdviceState((prev) => ({
      ...prev,
      [type]: { advice: null, loading: true, error: null },
    }));

    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Error desconocido");
      }

      setAdviceState((prev) => ({
        ...prev,
        [type]: { advice: data.advice, loading: false, error: null },
      }));
    } catch (err) {
      setAdviceState((prev) => ({
        ...prev,
        [type]: {
          advice: null,
          loading: false,
          error:
            err instanceof Error ? err.message : "Error al conectar con la IA",
        },
      }));
    }
  }, []);

  // Pagination helpers
  const goToPage = (page: number, setter: (p: number) => void) => {
    if (page >= 1) setter(page);
  };

  const renderPagination = (
    current: number,
    total: number,
    setter: (p: number) => void
  ) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-3">
        <button
          onClick={() => goToPage(current - 1, setter)}
          disabled={current <= 1}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Anterior
        </button>
        <span className="text-xs text-gray-500">
          Pág. {current} de {total}
        </span>
        <button
          onClick={() => goToPage(current + 1, setter)}
          disabled={current >= total}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:border-gray-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    );
  };

  // Chart height based on data volume
  const chartHeight = paraleloHistory.length > 200 ? 400 : 300;



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
                signal.emoji === "🟢"
                  ? "border-emerald-800/50 bg-emerald-950/20"
                  : signal.emoji === "🟣"
                    ? "border-violet-800/50 bg-violet-950/20"
                    : signal.emoji === "⚖️"
                      ? "border-yellow-800/50 bg-yellow-950/20"
                      : "border-gray-800 bg-gray-900"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Señal de Trading
              </p>
              <p className={`mt-1 text-lg font-bold ${signal.color}`}>
                {signal.emoji} {signal.text}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {avgParaleloPrice > 0
                  ? `Prom. 48h: ${fmtNum(avgParaleloPrice)} VES · Actual: ${fmtNum(latestMarket?.price ?? 0)} VES`
                  : "Calculando promedio…"}
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

      {/* ═══ CHART SECTION ═══ */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">
            Evolución Tasa Paralela
          </h2>
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            {isFetching && (
              <span className="animate-pulse text-xs text-gray-500">
                Cargando…
              </span>
            )}
            <div className="flex overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleRangeChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    timeRange === opt.value
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              No hay datos disponibles. Espera a que el cron job recolecte
              tasas.
            </p>
          ) : (
            <>
              {/* ═══ PRICE CHART ═══ */}
              <ResponsiveContainer width="100%" height={chartHeight}>
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
                    formatter={(value) => [
                      `${Number(value).toFixed(2)} VES`,
                      "Paralelo",
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

              {/* ═══ VOLUME CHART ═══ */}
              <div className="mt-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/70" />
                      Vol. Compra (demanda)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/70" />
                      Vol. Venta (oferta)
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#9CA3AF", fontSize: 10 }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "#9CA3AF", fontSize: 10 }}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v.toFixed(0)}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        color: "#F9FAFB",
                        fontSize: 12,
                      }}
                      formatter={(value, name) => {
                        const vol = typeof value === "number" ? value : 0;
                        return [
                          `${vol.toLocaleString("es-VE", { minimumFractionDigits: 0 })} USDT`,
                          name === "buyVolume" ? "Vol. Compra" : "Vol. Venta",
                        ];
                      }}
                    />
                    <Bar
                      dataKey="buyVolume"
                      fill="#10B981"
                      fillOpacity={0.6}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={8}
                    />
                    <Bar
                      dataKey="sellVolume"
                      fill="#F59E0B"
                      fillOpacity={0.6}
                      radius={[2, 2, 0, 0]}
                      maxBarSize={8}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ═══ ASESORÍA IA — 3 BOTONES ═══ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Asesoría de Arbitraje IA
          </h2>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(ADVICE_CONFIG) as [AdviceType, typeof ADVICE_CONFIG.sell][]).map(
              ([type, cfg]) => {
                const state = adviceState[type];
                return (
                  <button
                    key={type}
                    onClick={() => requestAdvice(type)}
                    disabled={state.loading}
                    className={`rounded-lg ${cfg.color} px-4 py-2 text-sm font-medium text-white transition ${cfg.hoverColor} disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5`}
                  >
                    {state.loading ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <span>{cfg.icon}</span>
                    )}
                    {state.loading
                      ? "Analizando…"
                      : cfg.label}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Advice results container */}
        <div className="space-y-4">
          {(Object.entries(adviceState) as [AdviceType, typeof adviceState.sell][]).map(
            ([type, state]) => {
              if (!state.advice && !state.error && !state.loading)
                return null;

              const cfg = ADVICE_CONFIG[type];
              const borderColor =
                type === "sell"
                  ? "border-amber-800/50"
                  : type === "buy"
                    ? "border-emerald-800/50"
                    : "border-violet-800/50";
              const bgColor =
                type === "sell"
                  ? "bg-amber-950/20"
                  : type === "buy"
                    ? "bg-emerald-950/20"
                    : "bg-violet-950/20";

              return (
                <div key={type}>
                  {state.error && (
                    <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-400">
                      {state.error}
                    </div>
                  )}

                  {state.loading && (
                    <div
                      className={`animate-pulse rounded-xl border ${borderColor} ${bgColor} p-5`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="text-sm font-medium text-gray-300">
                          {cfg.label} — Analizando datos de mercado…
                        </span>
                      </div>
                    </div>
                  )}

                  {state.advice && (
                    <div
                      className={`rounded-xl border ${borderColor} ${bgColor} p-5 text-sm leading-relaxed text-gray-200`}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="text-sm font-semibold text-white">
                          {cfg.label === "Venta"
                            ? "💡 ¿Vender USDT?"
                            : cfg.label === "Compra"
                              ? "💡 ¿Comprar USDT?"
                              : "💡 Análisis de tus trades"}
                        </span>
                      </div>
                      {state.advice.split("\n").map((line, i) => (
                        <p key={i} className={i > 0 ? "mt-2" : ""}>
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* ═══ NEW TRADE PANEL ═══ */}
      <TradePanel currentPrice={latestMarket?.price ?? null} />

      {/* ═══ MEJORES HORAS ═══ */}
      {scoredPatterns.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">
            ⏰ Mejores Horas para Operar
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Top horas para VENDER */}
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h3 className="text-sm font-semibold text-emerald-400">
                  Mejores horas para VENDER USDT
                </h3>
              </div>
              <div className="space-y-2">
                {[...scoredPatterns]
                  .sort((a, b) => b.sellScore - a.sellScore)
                  .slice(0, 3)
                  .map((h, i) => (
                    <div
                      key={h.hour}
                      className="flex items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          #{i + 1}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {getHourLabel(h.hour)}
                        </span>
                        {h.hour === currentHour && (
                          <span className="text-xs text-emerald-400">
                            ← ahora
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">
                          {fmtNum(h.avgPrice)} VES
                        </p>
                        <p className="text-xs text-gray-500">
                          Vol. Compra: {(h.avgBuyVolume / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top horas para COMPRAR */}
            <div className="rounded-xl border border-amber-800/50 bg-amber-950/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">🟢</span>
                <h3 className="text-sm font-semibold text-amber-400">
                  Mejores horas para COMPRAR USDT
                </h3>
              </div>
              <div className="space-y-2">
                {[...scoredPatterns]
                  .sort((a, b) => b.buyScore - a.buyScore)
                  .slice(0, 3)
                  .map((h, i) => (
                    <div
                      key={h.hour}
                      className="flex items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          #{i + 1}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {getHourLabel(h.hour)}
                        </span>
                        {h.hour === currentHour && (
                          <span className="text-xs text-amber-400">
                            ← ahora
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-400">
                          {fmtNum(h.avgPrice)} VES
                        </p>
                        <p className="text-xs text-gray-500">
                          Vol. Venta: {(h.avgSellVolume / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ HOURLY PATTERNS TABLE ═══ */}
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
                    Vol. Compra
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Vol. Venta
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">
                    Perfil
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Mín
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-right">
                    Máx
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">
                    Señal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {patterns.map((p) => {
                  const isCurrent = p.hour === currentHour;
                  const minAvg = Math.min(...patterns.map((x) => x.avgPrice));
                  const maxAvg = Math.max(...patterns.map((x) => x.avgPrice));
                  const isDip = p.avgPrice <= minAvg;
                  const isPeak = p.avgPrice >= maxAvg;

                  // Find scored pattern for detail
                  const sp = scoredPatterns.find(s => s.hour === p.hour);
                  const maxBuyLocal = Math.max(
                    ...patterns.map((x) => x.avgBuyVolume),
                    1
                  );
                  const maxSellLocal = Math.max(
                    ...patterns.map((x) => x.avgSellVolume),
                    1
                  );
                  const buyBarPct = (p.avgBuyVolume / maxBuyLocal) * 100;
                  const sellBarPct = (p.avgSellVolume / maxSellLocal) * 100;
                  const dominant =
                    p.avgBuyVolume > p.avgSellVolume
                      ? "compra"
                      : p.avgSellVolume > p.avgBuyVolume
                        ? "venta"
                        : "igual";
                  const isBestSell = bestSellSet.has(p.hour);
                  const isBestBuy = bestBuySet.has(p.hour);

                  let rowSignal: string;
                  if (isBestSell) {
                    rowSignal = "💰";
                  } else if (isBestBuy) {
                    rowSignal = "🟢";
                  } else if (isDip && p.count > 1) {
                    rowSignal = "🔵";
                  } else if (isPeak && p.count > 1) {
                    rowSignal = "🔴";
                  } else {
                    rowSignal = "⚪";
                  }

                  return (
                    <tr
                      key={p.hour}
                      className={`transition hover:bg-gray-900/50 ${
                        isCurrent ? "bg-emerald-950/10" : ""
                      } ${isBestSell ? "bg-emerald-950/20" : isBestBuy ? "bg-amber-950/20" : ""}`}
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
                        {p.avgBuyVolume > 0
                          ? (p.avgBuyVolume / 1000).toFixed(0) + "K"
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-400">
                        {p.avgSellVolume > 0
                          ? (p.avgSellVolume / 1000).toFixed(0) + "K"
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {/* Buy bar */}
                          <div className="h-2 w-10 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className="h-full rounded-full bg-emerald-500/60 transition-all"
                              style={{ width: `${Math.min(buyBarPct, 100)}%` }}
                            />
                          </div>
                          {/* Sell bar */}
                          <div className="h-2 w-10 overflow-hidden rounded-full bg-gray-800">
                            <div
                              className="h-full rounded-full bg-amber-500/60 transition-all"
                              style={{ width: `${Math.min(sellBarPct, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`ml-1 text-xs font-medium ${
                              dominant === "compra"
                                ? "text-emerald-400"
                                : dominant === "venta"
                                  ? "text-amber-400"
                                  : "text-gray-500"
                            }`}
                          >
                            {dominant === "compra"
                              ? "🚀"
                              : dominant === "venta"
                                ? "💰"
                                : "⚖️"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                        {fmtNum(p.minPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-400">
                        {fmtNum(p.maxPrice)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span title={isBestSell ? `${(sp?.sellScore ?? 0).toFixed(1)}%` : isBestBuy ? `${(sp?.buyScore ?? 0).toFixed(1)}%` : ""}>
                          {rowSignal}
                        </span>
                        <br />
                        {isBestSell && (
                          <span className="text-[10px] font-medium text-emerald-500">
                            Vender
                          </span>
                        )}
                        {isBestBuy && (
                          <span className="text-[10px] font-medium text-amber-500">
                            Comprar
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ RECENT RECORDS TABLE ═══ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Últimos Registros
          </h2>
          <div className="flex items-center gap-2">
            {isFetching && (
              <span className="animate-pulse text-xs text-gray-500">
                Cargando…
              </span>
            )}
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="rounded-lg border border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-400 transition hover:border-gray-600 hover:text-white"
            >
              {showVolume ? "Ocultar volumen" : "Ver volumen"}
            </button>
          </div>
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
        {renderPagination(recordsPage, totalPages, setRecordsPage)}
      </section>
    </div>
  );
}
