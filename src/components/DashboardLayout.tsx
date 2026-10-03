"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import { useTheme } from "./ThemeProvider";
import UserMenu from "./UserMenu";
import SettingsView from "./SettingsView";
import { computeMarketStats, evaluateSignal } from "@/lib/signals";
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

// ── Types ───────────────────────────────────────────
interface RatePoint {
  price: number;
  time: string;
  ts?: number;
  buyVolume?: number;
  sellVolume?: number;
}

interface RateRecord {
  source: string;
  exchange?: string;
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
  intervencionPrice: number | null;
}

interface ExchangeSnapshot {
  exchange: string;
  price: number;
  buyPrice: number | null;
  sellPrice: number | null;
  buyVolume: number | null;
  sellVolume: number | null;
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

interface DashboardLayoutProps {
  latestMarket: MarketSnapshot | null;
  paraleloHistory: RatePoint[];
  exchangeHistory: Record<string, RatePoint[]>;
  latestExchanges: (ExchangeSnapshot | null)[];
  recentRecords: RateRecord[];
  trades: TradeData[];
  isAuthenticated: boolean;
}

interface RatesResponse {
  paraleloHistory: RatePoint[];
  bcvHistory: RatePoint[];
  exchangeHistory: Record<string, RatePoint[]>;
  latestExchanges: (ExchangeSnapshot | null)[];
  recentRecords: RateRecord[];
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

type ViewType = "market" | "trades" | "ia" | "patterns" | "aperturas" | "intervencion" | "alerts" | "settings";
type TimeRange = "today" | "3d" | "week" | "month";
type AdviceType = "sell" | "buy" | "analyze";

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "3d", label: "3 días" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

const ADVICE_CONFIG: {
  [K in AdviceType]: { label: string; color: string; hoverColor: string; textColor: string };
} = {
  sell: { label: "Venta", color: "bg-brand-yellow", hoverColor: "hover:bg-brand-yellow/90", textColor: "text-brand-cream" },
  buy: { label: "Compra", color: "bg-brand-green", hoverColor: "hover:bg-brand-green/90", textColor: "text-brand-cream" },
  analyze: { label: "Analizar Trade", color: "bg-brand-green/80", hoverColor: "hover:bg-brand-green", textColor: "text-brand-cream" },
};

const NAV_ITEMS: { id: ViewType; label: string }[] = [
  { id: "market", label: "Mercado" },
  { id: "trades", label: "Trades" },
  { id: "ia", label: "IA" },
  { id: "patterns", label: "Patrones" },
  { id: "aperturas", label: "Aperturas" },
  { id: "intervencion", label: "Intervención" },
  { id: "alerts", label: "Alertas" },
  { id: "settings", label: "Ajustes" },
];

interface PriceAlertData {
  id: number;
  direction: string;
  targetPrice: number;
  active: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

const INTERVENCION_AMOUNTS = [100, 200, 300, 400, 500];
const INTERVENCION_MARKUP = 0.005;

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getHourLabel(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

const EXCHANGE_COLORS: Record<string, string> = {
  binance: "var(--chart-green, #2d3a35)",
  bybit: "var(--chart-yellow, #c5a870)",
  okx: "var(--chart-blue, #7c93a8)",
};

const EXCHANGE_NAMES: Record<string, string> = {
  binance: "Binance",
  bybit: "Bybit",
  okx: "OKX",
};

/**
 * Une el histórico de los exchanges en una sola serie para el gráfico,
 * alineando por timestamp. Binance es la serie principal.
 */
function mergeExchangeSeries(
  primary: RatePoint[],
  extra: Record<string, RatePoint[]>
): Record<string, number | string>[] {
  const byTime: Record<string, Record<string, number | string>> = {};

  for (const p of primary) {
    byTime[p.time] = { time: p.time, binance: p.price, ts: p.ts ?? 0 };
  }
  for (const [ex, series] of Object.entries(extra)) {
    for (const p of series) {
      const bucket = (byTime[p.time] ??= { time: p.time, ts: p.ts ?? 0 });
      // Un punto que se aleja mas de 3% de la referencia es ruido del libro P2P
      // (una orden suelta), no mercado: se omite para no aplastar la escala.
      const ref = bucket.binance;
      if (typeof ref === "number" && Math.abs(p.price - ref) / ref > 0.03) continue;
      bucket[ex] = p.price;
      if (p.ts !== undefined && (bucket.ts as number) < p.ts) bucket.ts = p.ts;
    }
  }

  return Object.values(byTime).sort((a, b) => (a.ts as number) - (b.ts as number));
}

type SignalTone = "sell" | "buy" | "stable" | "wait";

const SIGNAL_TONE_TEXT: Record<SignalTone, string> = {
  sell: "text-brand-yellow",
  buy: "text-brand-up",
  stable: "text-brand-green",
  wait: "text-brand-green/50",
};

const SIGNAL_TONE_DOT: Record<SignalTone, string> = {
  sell: "bg-brand-yellow",
  buy: "bg-brand-up",
  stable: "bg-brand-green/60",
  wait: "bg-brand-green/30",
};

function StatCell({ label, value, hint, valueClass = "text-brand-green" }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="border-b border-r border-brand-green/10 px-4 py-4 sm:px-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-brand-green/40">{label}</p>
      <p className={`mt-1.5 font-mono text-lg font-medium tabular-nums ${valueClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-brand-green/40">{hint}</p>}
    </div>
  );
}

// ── Login Prompt component ──
function LoginPrompt() {
  return (
    <div className="relative">
      <div className="flex items-center justify-center rounded-none bg-brand-green/5 p-12">
        <div className="text-center">
          <p className="mb-4 text-lg font-semibold text-brand-green">Inicia sesión para acceder</p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="inline-flex items-center gap-2 rounded-none bg-brand-green px-5 py-2.5 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Theme Toggle ──
function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-none border border-brand-green/10 text-brand-green/50 transition-all hover:border-brand-green/20 hover:text-brand-green"
      aria-label="Cambiar tema"
    >
      {theme === "light" ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
    </button>
  );
}

// ── Market View ──
function MarketView({
  latestMarket,
  paraleloHistory,
  exchangeHistory,
  latestExchanges,
  patterns,
  currentHour,
  timeRange,
  isFetching,
  onRangeChange,
  chartData,
  recentRecords,
}: {
  latestMarket: MarketSnapshot | null;
  paraleloHistory: RatePoint[];
  exchangeHistory: Record<string, RatePoint[]>;
  latestExchanges: (ExchangeSnapshot | null)[];
  patterns: HourlyPattern[];
  currentHour: number;
  timeRange: TimeRange;
  isFetching: boolean;
  onRangeChange: (range: TimeRange) => void;
  chartData: RatePoint[];
  recentRecords: RateRecord[];
}) {
  const bcvLatest = latestMarket?.bcvPrice ?? null;
  const marketSpread =
    latestMarket?.buyPrice && latestMarket?.sellPrice ? latestMarket.sellPrice - latestMarket.buyPrice : null;
  const marketSpreadPct = marketSpread !== null && latestMarket?.sellPrice ? (marketSpread / latestMarket.sellPrice) * 100 : null;

  const currentPattern = patterns.find((p) => p.hour === currentHour);
  const trend =
    patterns.length > 0 && currentPattern
      ? currentPattern.avgPrice > (patterns.find((p) => p.hour === (currentHour + 23) % 24)?.avgPrice ?? 0)
        ? "subiendo"
        : "bajando"
      : null;

  const avgParaleloPrice =
    paraleloHistory.length > 0
      ? paraleloHistory.reduce((s, p) => s + p.price, 0) / paraleloHistory.length
      : 0;

  // Mismos umbrales que el cron/Telegram (src/lib/signals.ts) para que la web y las
  // notificaciones nunca queden desincronizadas.
  const marketStats = latestMarket ? computeMarketStats(latestMarket, paraleloHistory) : null;
  const signalLevel = marketStats ? evaluateSignal(marketStats) : null;

  let signal: { title: string; detail: string; tone: SignalTone } = { title: "Esperar", detail: "Sin señal clara", tone: "wait" };
  if (marketStats) {
    if (signalLevel === "strong_sell") signal = { title: "Vender USDT", detail: "Precio alto frente al promedio de 48h", tone: "sell" };
    else if (signalLevel === "sell") signal = { title: "Vender", detail: "Precio por encima del promedio", tone: "sell" };
    else if (signalLevel === "strong_buy") signal = { title: "Comprar USDT", detail: "Precio bajo frente al promedio de 48h", tone: "buy" };
    else if (signalLevel === "buy") signal = { title: "Comprar", detail: "Precio por debajo del promedio", tone: "buy" };
    else if (Math.abs(marketStats.pctAboveAvg) < 0.3) signal = { title: "Estable", detail: "Precio cerca del promedio de 48h", tone: "stable" };
    else signal = { title: "Esperar", detail: "Sin señal clara todavía", tone: "wait" };
  }

  const pctVsAvg = marketStats?.pctAboveAvg ?? null;
  const chartHeight = paraleloHistory.length > 200 ? 400 : 300;
  const mergedChartData = mergeExchangeSeries(chartData, exchangeHistory);
  const extraExchanges = Object.keys(exchangeHistory).filter((k) => k !== "binance");

  return (
    <div className="space-y-8">
      {/* Precio actual + señal */}
      {latestMarket && (
        <section className="border-t border-brand-green/10">
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
            <div className="border-b border-brand-green/10 px-4 py-7 sm:px-6 lg:border-r">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-green/40">Tasa paralela · Binance P2P</p>
              <p className="mt-3 font-mono text-5xl font-medium tracking-tight text-brand-green sm:text-6xl">
                {fmtNum(latestMarket.price)}
                <span className="ml-2 text-xl text-brand-green/40">VES</span>
              </p>
              <p className="mt-3 text-sm text-brand-green/50">
                {avgParaleloPrice > 0 ? (
                  <>
                    Promedio 48h <span className="font-mono text-brand-green/70">{fmtNum(avgParaleloPrice)}</span>
                    {pctVsAvg !== null && (
                      <span className={`ml-2 font-mono ${pctVsAvg > 0 ? "text-brand-up" : pctVsAvg < 0 ? "text-brand-down" : "text-brand-green/50"}`}>
                        {pctVsAvg > 0 ? "+" : ""}{pctVsAvg.toFixed(2)}%
                      </span>
                    )}
                  </>
                ) : (
                  "Calculando promedio…"
                )}
                {bcvLatest && (
                  <>
                    <span className="mx-2 text-brand-green/20">·</span>
                    BCV <span className="font-mono text-brand-green/70">{fmtNum(bcvLatest)}</span>
                  </>
                )}
              </p>
            </div>
            <div className="border-b border-brand-green/10 px-4 py-7 sm:px-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-brand-green/40">Señal de trading</p>
              <p className={`mt-3 flex items-center gap-3 text-3xl font-bold ${SIGNAL_TONE_TEXT[signal.tone]}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${SIGNAL_TONE_DOT[signal.tone]}`} />
                {signal.title}
              </p>
              <p className="mt-3 text-sm text-brand-green/50">{signal.detail}</p>
            </div>
          </div>

          <div className="-mr-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCell label="Mejor compra" value={latestMarket.buyPrice ? fmtNum(latestMarket.buyPrice) : "—"} hint={latestMarket.buyVolume ? `Vol. ${fmtNum(latestMarket.buyVolume, 0)} USDT` : undefined} />
            <StatCell label="Mejor venta" value={latestMarket.sellPrice ? fmtNum(latestMarket.sellPrice) : "—"} hint={latestMarket.sellVolume ? `Vol. ${fmtNum(latestMarket.sellVolume, 0)} USDT` : undefined} />
            <StatCell label="Spread" value={marketSpread !== null ? fmtNum(marketSpread) : "—"} hint={marketSpreadPct !== null ? `${marketSpreadPct.toFixed(3)}%` : undefined} />
            <StatCell label="Hora actual (VET)" value={getHourLabel(currentHour)} />
            <StatCell label="Prom. de la hora" value={currentPattern ? fmtNum(currentPattern.avgPrice) : "—"} />
            <StatCell
              label="Tendencia horaria"
              value={trend === "subiendo" ? "Subiendo ↑" : trend === "bajando" ? "Bajando ↓" : "—"}
              valueClass={trend === "subiendo" ? "text-brand-up" : trend === "bajando" ? "text-brand-down" : "text-brand-green"}
            />
          </div>
        </section>
      )}

      {/* Exchange Comparison */}
      {latestExchanges.some((e) => e && e.buyPrice && e.sellPrice) && (() => {
        const valid = latestExchanges.filter((e): e is ExchangeSnapshot => !!e && (e.buyPrice ?? 0) > 0 && (e.sellPrice ?? 0) > 0);
        const cheapestBuy = valid.length >= 2 ? [...valid].sort((a, b) => (a.buyPrice ?? 0) - (b.buyPrice ?? 0))[0] : null;
        const bestSell = valid.length >= 2 ? [...valid].sort((a, b) => (b.sellPrice ?? 0) - (a.sellPrice ?? 0))[0] : null;
        return (
          <section>
            <h3 className="mb-3 text-lg font-semibold text-brand-green">Comparativa de exchanges</h3>
            <div className="grid grid-cols-1 border-y border-brand-green/10 sm:grid-cols-3">
              {valid.map((e, i) => (
                <div key={e.exchange} className={`px-4 py-4 sm:px-5 ${i > 0 ? "border-t border-brand-green/10 sm:border-l sm:border-t-0" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-green">{EXCHANGE_NAMES[e.exchange] ?? e.exchange}</p>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXCHANGE_COLORS[e.exchange] ?? "#2d3a35" }} />
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-baseline justify-between">
                      <dt className="text-brand-green/40">Comprar</dt>
                      <dd className="font-mono tabular-nums text-brand-green">{e.buyPrice ? fmtNum(e.buyPrice) : "—"}</dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-brand-green/40">Vender</dt>
                      <dd className="font-mono tabular-nums text-brand-green">{e.sellPrice ? fmtNum(e.sellPrice) : "—"}</dd>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <dt className="text-brand-green/40">Vol. compra / venta</dt>
                      <dd className="font-mono text-xs tabular-nums text-brand-green/50">
                        {e.buyVolume ? `${(e.buyVolume / 1000).toFixed(0)}K` : "—"} / {e.sellVolume ? `${(e.sellVolume / 1000).toFixed(0)}K` : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            {cheapestBuy && bestSell && (
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
                <p>
                  <span className="font-medium text-brand-up">Comprar más barato</span>
                  <span className="text-brand-green/40"> en </span>
                  <span className="font-semibold text-brand-green">{EXCHANGE_NAMES[cheapestBuy.exchange] ?? cheapestBuy.exchange}</span>
                  <span className="ml-2 font-mono tabular-nums text-brand-green">{cheapestBuy.buyPrice ? fmtNum(cheapestBuy.buyPrice) : "—"}</span>
                </p>
                <p>
                  <span className="font-medium text-brand-yellow">Vender más caro</span>
                  <span className="text-brand-green/40"> en </span>
                  <span className="font-semibold text-brand-green">{EXCHANGE_NAMES[bestSell.exchange] ?? bestSell.exchange}</span>
                  <span className="ml-2 font-mono tabular-nums text-brand-green">{bestSell.sellPrice ? fmtNum(bestSell.sellPrice) : "—"}</span>
                </p>
              </div>
            )}
          </section>
        );
      })()}

      {/* Recent Records */}
      {recentRecords.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-brand-green">Registros recientes</h3>
          <div className="overflow-x-auto border-y border-brand-green/10">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-green/10 text-brand-green/40">
                  <th className="pb-2 pr-3 font-medium">Fuente</th>
                  <th className="pb-2 pr-3 text-right font-medium">Precio</th>
                  <th className="pb-2 pr-3 text-right font-medium">Compra</th>
                  <th className="pb-2 pr-3 text-right font-medium">Venta</th>
                  <th className="pb-2 text-right font-medium">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-green/10">
                {recentRecords.slice(0, 10).map((r, i) => (
                  <tr key={i} className="hover:bg-brand-green/5">
                    <td className="py-1.5 pr-3 font-medium text-brand-green">
                      {r.source === "paralelo" && r.exchange
                        ? EXCHANGE_NAMES[r.exchange] ?? r.exchange
                        : r.source === "paralelo"
                          ? "Paralelo"
                          : r.source.toUpperCase()}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-brand-green">{fmtNum(r.price)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-brand-green/70">{r.buyPrice ? fmtNum(r.buyPrice) : "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-brand-green/70">{r.sellPrice ? fmtNum(r.sellPrice) : "—"}</td>
                    <td className="py-1.5 text-right text-brand-green/40">{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Chart Section */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-brand-green">Evolución de la tasa paralela</h2>
          <div className="flex items-center gap-2">
            {isFetching && <span className="animate-pulse text-xs text-brand-green/40">Cargando…</span>}
            <div className="flex overflow-hidden rounded-none border border-brand-green/10">
              {TIME_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onRangeChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    timeRange === opt.value ? "bg-brand-green text-brand-cream" : "text-brand-green/50 hover:bg-brand-green/5 hover:text-brand-green"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-y border-brand-green/10 py-4">
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-brand-green/40">No hay datos disponibles. Espera a que el cron job recolecte tasas.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-brand-green/40">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: EXCHANGE_COLORS.binance }} /> Binance (referencia)</span>
                {extraExchanges.map((ex) => (
                  <span key={ex} className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full opacity-70" style={{ backgroundColor: EXCHANGE_COLORS[ex] ?? "#9A9484" }} /> {EXCHANGE_NAMES[ex] ?? ex}</span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={mergedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #ECE7DD)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "var(--chart-axis, #9A9484)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={48} />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "var(--chart-axis, #9A9484)", fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v.toFixed(0)}`} />
                  <Tooltip contentStyle={{ backgroundColor: "var(--chart-tooltip-bg, #FFFFFF)", border: "1px solid var(--chart-tooltip-border, #E8E3D9)", borderRadius: 0, color: "var(--chart-green, #2d3a35)", boxShadow: "var(--chart-shadow, 0 4px 12px rgba(45,58,53,0.08))" }} formatter={(value, name) => [`${Number(value).toFixed(2)} VES`, EXCHANGE_NAMES[String(name)] ?? String(name)]} />
                  {bcvLatest && (
                    <ReferenceLine y={bcvLatest} stroke="var(--chart-green, #2d3a35)" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `BCV ${bcvLatest.toFixed(2)}`, fill: "var(--chart-green, #2d3a35)", fontSize: 11, position: "insideTopLeft" }} />
                  )}
                  <Line type="monotone" dataKey="binance" stroke={EXCHANGE_COLORS.binance} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: EXCHANGE_COLORS.binance }} />
                  {extraExchanges.map((ex) => (
                    <Line key={ex} type="monotone" dataKey={ex} stroke={EXCHANGE_COLORS[ex] ?? "#9A9484"} strokeWidth={1.25} strokeOpacity={0.65} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              {/* Volume Chart */}
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-4 text-xs text-brand-green/40">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 bg-brand-green/50" /> Vol. compra</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 bg-brand-yellow/60" /> Vol. venta</span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #ECE7DD)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "var(--chart-axis, #9A9484)", fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={48} />
                    <YAxis tick={{ fill: "var(--chart-axis, #9A9484)", fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v.toFixed(0)}`} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--chart-tooltip-bg, #FFFFFF)", border: "1px solid var(--chart-tooltip-border, #E8E3D9)", borderRadius: 0, color: "var(--chart-green, #2d3a35)", fontSize: 12, boxShadow: "var(--chart-shadow, 0 4px 12px rgba(45,58,53,0.08))" }} formatter={(value, name) => { const vol = typeof value === "number" ? value : 0; return [`${vol.toLocaleString("es-VE", { minimumFractionDigits: 0 })} USDT`, name === "buyVolume" ? "Vol. Compra" : "Vol. Venta"]; }} />
                    <Bar dataKey="buyVolume" fill="var(--chart-green, #2d3a35)" fillOpacity={0.35} maxBarSize={8} />
                    <Bar dataKey="sellVolume" fill="var(--chart-yellow, #c5a870)" fillOpacity={0.55} maxBarSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ── IA View ──
function IaView({
  isAuthenticated,
  adviceState,
  onRequestAdvice,
}: {
  isAuthenticated: boolean;
  adviceState: { [K in AdviceType]: { advice: string | null; loading: boolean; error: string | null } };
  onRequestAdvice: (type: AdviceType) => void;
}) {
  const renderAdvice = (type: AdviceType) => {
    const state = adviceState[type];
    if (!state.advice && !state.error && !state.loading) return null;
    const cfg = ADVICE_CONFIG[type];
    const borderColor = type === "sell" ? "border-brand-yellow/30" : type === "buy" ? "border-brand-green/20" : "border-brand-green/15";
    const bgColor = type === "sell" ? "bg-brand-yellow/5" : type === "buy" ? "bg-brand-green/5" : "";

    return (
      <div key={type}>
        {state.error && <div className="rounded-none border border-brand-down/30 bg-brand-down/5 p-4 text-sm text-brand-down">{state.error}</div>}
        {state.loading && (
          <div className={`animate-pulse rounded-none border ${borderColor} ${bgColor} p-5`}>
            <div className="flex items-center gap-2">
              
              <span className="text-sm font-medium text-brand-green/60">{cfg.label} — Analizando datos de mercado…</span>
            </div>
          </div>
        )}
        {state.advice && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`rounded-none border ${borderColor} ${bgColor} p-5 text-sm leading-relaxed text-brand-green/80`}
          >
            <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-brand-green/40">
              {cfg.label === "Venta" ? "¿Vender USDT?" : cfg.label === "Compra" ? "¿Comprar USDT?" : "Análisis de tus trades"}
            </p>
            {state.advice.split("\n").map((line, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
            ))}
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-brand-green">Asesoría de Arbitraje IA</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(ADVICE_CONFIG) as [AdviceType, typeof ADVICE_CONFIG.sell][]).map(([type, cfg]) => {
            const state = adviceState[type];
            return (
              <button
                key={type}
                onClick={() => onRequestAdvice(type)}
                disabled={state.loading}
                className={`rounded-none ${cfg.color} px-4 py-2 text-sm font-medium ${cfg.textColor} transition ${cfg.hoverColor} disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5`}
              >
                {state.loading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-cream/30 border-t-brand-cream" />
                )}
                {state.loading ? "Analizando…" : cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isAuthenticated ? (
        <LoginPrompt />
      ) : (
        <div className="space-y-4">
          {(Object.entries(ADVICE_CONFIG) as [AdviceType, typeof ADVICE_CONFIG.sell][]).map(([type]) => renderAdvice(type))}
        </div>
      )}
    </div>
  );
}

// ── Patterns View ──
function PatternsView({
  patterns,
  currentHour,
}: {
  patterns: HourlyPattern[];
  currentHour: number;
}) {
  if (patterns.length === 0) {
    return (
      <div className="rounded-none border border-brand-green/10 p-8 text-center text-brand-green/40">
        No hay suficientes datos para mostrar patrones horarios. Los patrones se generan automáticamente con datos históricos.
      </div>
    );
  }

  const maxBuy = Math.max(...patterns.map((p) => p.avgBuyVolume), 1);
  const maxSell = Math.max(...patterns.map((p) => p.avgSellVolume), 1);
  const minPriceAll = Math.min(...patterns.map((p) => p.avgPrice));
  const maxPriceAll = Math.max(...patterns.map((p) => p.avgPrice));
  const priceRange = maxPriceAll - minPriceAll || 1;

  const scored = patterns.map((p) => {
    const buyVolRatio = p.avgBuyVolume / maxBuy;
    const sellVolRatio = p.avgSellVolume / maxSell;
    const priceHighRatio = (p.avgPrice - minPriceAll) / priceRange;
    const priceLowRatio = 1 - priceHighRatio;
    const sellScore = buyVolRatio * 0.5 + priceHighRatio * 0.5;
    const buyScore = sellVolRatio * 0.5 + priceLowRatio * 0.5;
    return { ...p, sellScore, buyScore };
  });

  const bestSell = new Set(
    [...scored].sort((a, b) => b.sellScore - a.sellScore).slice(0, 3).map((h) => h.hour)
  );
  const bestBuy = new Set(
    [...scored].sort((a, b) => b.buyScore - a.buyScore).slice(0, 3).map((h) => h.hour)
  );

  return (
    <div className="space-y-6">
      {/* Best hours cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-t border-brand-green/10 pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-brand-yellow">Mejores horas para vender USDT</p>
          <div className="divide-y divide-brand-green/10">
            {[...scored].sort((a, b) => b.sellScore - a.sellScore).slice(0, 3).map((h, i) => (
              <div key={h.hour} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 font-mono text-xs text-brand-green/40">{i + 1}</span>
                  <span className="text-sm font-medium text-brand-green">{getHourLabel(h.hour)}</span>
                  {h.hour === currentHour && <span className="text-xs text-brand-green/50">← ahora</span>}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium tabular-nums text-brand-green">{fmtNum(h.avgPrice)}</p>
                  <p className="text-xs text-brand-green/40">Vol. compra {(h.avgBuyVolume / 1000).toFixed(0)}K</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-brand-green/10 pt-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-brand-up">Mejores horas para comprar USDT</p>
          <div className="divide-y divide-brand-green/10">
            {[...scored].sort((a, b) => b.buyScore - a.buyScore).slice(0, 3).map((h, i) => (
              <div key={h.hour} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 font-mono text-xs text-brand-green/40">{i + 1}</span>
                  <span className="text-sm font-medium text-brand-green">{getHourLabel(h.hour)}</span>
                  {h.hour === currentHour && <span className="text-xs text-brand-green/50">← ahora</span>}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium tabular-nums text-brand-green">{fmtNum(h.avgPrice)}</p>
                  <p className="text-xs text-brand-green/40">Vol. venta {(h.avgSellVolume / 1000).toFixed(0)}K</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patterns table */}
      <div className="overflow-x-auto border-y border-brand-green/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-brand-green/10">
            <tr>
              <th className="px-4 py-3 font-medium text-brand-green/50">Hora</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Precio Prom</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Vol. Compra</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Vol. Venta</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-center">Perfil</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Mín</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Máx</th>
              <th className="px-4 py-3 font-medium text-brand-green/50 text-center">Señal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-green/10">
            {patterns.map((p) => {
              const isCurrent = p.hour === currentHour;
              const minAvg = Math.min(...patterns.map((x) => x.avgPrice));
              const maxAvg = Math.max(...patterns.map((x) => x.avgPrice));
              const isDip = p.avgPrice <= minAvg;
              const isPeak = p.avgPrice >= maxAvg;
              const sp = scored.find((s) => s.hour === p.hour);
              const maxBuyLocal = Math.max(...patterns.map((x) => x.avgBuyVolume), 1);
              const maxSellLocal = Math.max(...patterns.map((x) => x.avgSellVolume), 1);
              const buyBarPct = (p.avgBuyVolume / maxBuyLocal) * 100;
              const sellBarPct = (p.avgSellVolume / maxSellLocal) * 100;
              const dominant = p.avgBuyVolume > p.avgSellVolume ? "compra" : p.avgSellVolume > p.avgBuyVolume ? "venta" : "igual";
              const isBestSell = bestSell.has(p.hour);
              const isBestBuy = bestBuy.has(p.hour);

              let rowSignal: { dot: string; label: string; cls: string } | null = null;
              if (isBestSell) rowSignal = { dot: "bg-brand-yellow", label: "Vender", cls: "text-brand-yellow" };
              else if (isBestBuy) rowSignal = { dot: "bg-brand-up", label: "Comprar", cls: "text-brand-up" };
              else if (isDip && p.count > 1) rowSignal = { dot: "bg-brand-green/30", label: "Mínimo", cls: "text-brand-green/50" };
              else if (isPeak && p.count > 1) rowSignal = { dot: "bg-brand-green/30", label: "Máximo", cls: "text-brand-green/50" };

              return (
                <tr
                  key={p.hour}
                  className={`transition hover:bg-brand-green/5 ${isCurrent ? "bg-brand-green/5" : isBestSell ? "bg-brand-yellow/5" : isBestBuy ? "bg-brand-up/5" : ""}`}
                >
                  <td className="px-4 py-2.5 font-medium text-brand-green">
                    {getHourLabel(p.hour)}
                    {isCurrent && <span className="ml-2 text-xs text-brand-green/50">← ahora</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">{fmtNum(p.avgPrice)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">
                    {p.avgBuyVolume > 0 ? (p.avgBuyVolume / 1000).toFixed(0) + "K" : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">
                    {p.avgSellVolume > 0 ? (p.avgSellVolume / 1000).toFixed(0) + "K" : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-10 overflow-hidden rounded-full bg-brand-green/10">
                        <div className="h-full rounded-full bg-brand-green/50 transition-all" style={{ width: `${Math.min(buyBarPct, 100)}%` }} />
                      </div>
                      <div className="h-2 w-10 overflow-hidden rounded-full bg-brand-yellow/10">
                        <div className="h-full rounded-full bg-brand-yellow/50 transition-all" style={{ width: `${Math.min(sellBarPct, 100)}%` }} />
                      </div>
                      <span className={`ml-1.5 text-[11px] font-medium uppercase tracking-wide ${dominant === "compra" ? "text-brand-up" : dominant === "venta" ? "text-brand-yellow" : "text-brand-green/40"}`}>
                        {dominant === "compra" ? "Compra" : dominant === "venta" ? "Venta" : "Par"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">{fmtNum(p.minPrice)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">{fmtNum(p.maxPrice)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {rowSignal ? (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${rowSignal.cls}`}
                        title={isBestSell ? `${(sp?.sellScore ?? 0).toFixed(1)}%` : isBestBuy ? `${(sp?.buyScore ?? 0).toFixed(1)}%` : undefined}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${rowSignal.dot}`} />
                        {rowSignal.label}
                      </span>
                    ) : (
                      <span className="text-brand-green/20">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Intervención View ──
function IntervencionView({
  bcvPrice,
  intervencionPrice,
}: {
  bcvPrice: number | null;
  intervencionPrice: number | null;
}) {
  if (!bcvPrice) {
    return (
      <div className="rounded-none border border-brand-green/10 p-8 text-center text-brand-green/40">
        No hay tasa BCV disponible todavía. Espera a que el cron job recolecte tasas.
      </div>
    );
  }

  const usingRealRate = !!intervencionPrice;
  const appliedRate = intervencionPrice ?? bcvPrice * (1 + INTERVENCION_MARKUP);

  return (
    <div className="space-y-6">
      <div className="flex divide-x divide-brand-green/10 border-y border-brand-green/10">
        <div className="flex-1 px-4 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-brand-green/40">Tasa BCV</p>
          <p className="mt-1 font-mono text-2xl font-medium text-brand-green">{fmtNum(bcvPrice, 4)}</p>
        </div>
        <div className="flex-1 px-4 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-wider text-brand-green/40">
            Tasa aplicada {usingRealRate ? "(intervención real)" : `(+${(INTERVENCION_MARKUP * 100).toFixed(1)}% estimado)`}
          </p>
          <p className="mt-1 font-mono text-2xl font-medium text-brand-yellow">{fmtNum(appliedRate, 4)}</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-brand-green/10">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-green/10 text-xs uppercase tracking-wider text-brand-green/40">
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 text-right font-medium">Total a pagar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-green/10">
            {INTERVENCION_AMOUNTS.map((amount) => (
              <tr key={amount}>
                <td className="px-5 py-4 font-mono text-brand-green">{fmtNum(amount, 2)} $</td>
                <td className="px-5 py-4 text-right font-mono text-lg font-semibold text-brand-green">
                  {fmtNum(amount * appliedRate, 2)} Bs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Dashboard Layout ──
export default function DashboardLayout({
  latestMarket: initialMarket,
  paraleloHistory: initialParalelo,
  exchangeHistory: initialExchangeHistory,
  latestExchanges: initialLatestExchanges,
  recentRecords: initialRecords,
  trades: initialTrades,
  isAuthenticated: initialAuth,
}: DashboardLayoutProps) {
  const { data: session } = useSession();
  const isAuthenticated = !!session || initialAuth;

  const [activeView, setActiveView] = useState<ViewType>("market");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Advice state
  const [adviceState, setAdviceState] = useState<{
    [K in AdviceType]: { advice: string | null; loading: boolean; error: string | null };
  }>({
    sell: { advice: null, loading: false, error: null },
    buy: { advice: null, loading: false, error: null },
    analyze: { advice: null, loading: false, error: null },
  });

  // Patterns
  const [patterns, setPatterns] = useState<HourlyPattern[]>([]);

  // Time range & data state
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [latestMarket, setLatestMarket] = useState<MarketSnapshot | null>(initialMarket);
  const [paraleloHistory, setParaleloHistory] = useState<RatePoint[]>(initialParalelo);
  const [exchangeHistory, setExchangeHistory] = useState<Record<string, RatePoint[]>>(initialExchangeHistory);
  const [latestExchanges, setLatestExchanges] = useState<(ExchangeSnapshot | null)[]>(initialLatestExchanges);
  const [recentRecords, setRecentRecords] = useState<RateRecord[]>(
    initialRecords
  );
  const [recordsPage, setRecordsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [trades, setTrades] = useState<TradeData[]>(initialTrades);
  const [tradesPage, setTradesPage] = useState(1);
  const [tradesTotalPages, setTradesTotalPages] = useState(1);

  // ── Trade edit state ──
  const [editingTrade, setEditingTrade] = useState<TradeData | null>(null);
  const [editForm, setEditForm] = useState({
    type: "sell" as "sell" | "buy",
    amount: "",
    price: "",
    targetPrice: "",
    notes: "",
    status: "open" as string,
    profit: "",
    profitPct: "",
  });

  // Fetch data
  const fetchRates = useCallback(
    async (range: TimeRange, rPage: number, tPage: number) => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/rates?range=${range}&recordsPage=${rPage}&tradesPage=${tPage}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: RatesResponse = await res.json();
        setLatestMarket(data.latestMarket);
        setParaleloHistory(data.paraleloHistory);
        setExchangeHistory(data.exchangeHistory);
        setLatestExchanges(data.latestExchanges);
        setRecentRecords(data.recentRecords);
        setTotalPages(data.totalPages);
        if (isAuthenticated && data.trades) {
          setTrades(data.trades);
          setTradesTotalPages(data.tradesTotalPages);
        }
        setFetchError(null);
      } catch {
        setFetchError("No se pudieron actualizar los datos. Mostrando la última información disponible.");
      } finally {
        setIsFetching(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    fetchRates(timeRange, recordsPage, tradesPage);
  }, [timeRange, recordsPage, tradesPage, fetchRates]);

  useEffect(() => {
    fetch("/api/patterns/hourly")
      .then((res) => res.json())
      .then((data) => { if (data.hourly) setPatterns(data.hourly); })
      .catch(() => {});
  }, []);

  const handleRangeChange = (range: TimeRange) => {
    setRecordsPage(1);
    setTradesPage(1);
    setTimeRange(range);
  };

  const chartData = [...paraleloHistory].reverse();
  const now = new Date();
  const currentHour = parseInt(
    new Intl.DateTimeFormat("en", { timeZone: "America/Caracas", hour: "numeric", hour12: false }).format(now)
  );

  // IA advice
  const requestAdvice = useCallback(
    async (type: AdviceType) => {
      if (!isAuthenticated) {
        signIn("google", { callbackUrl: "/dashboard" });
        return;
      }
      setAdviceState((prev) => ({ ...prev, [type]: { advice: null, loading: true, error: null } }));
      try {
        const res = await fetch("/api/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error desconocido");
        setAdviceState((prev) => ({ ...prev, [type]: { advice: data.advice, loading: false, error: null } }));
      } catch (err) {
        setAdviceState((prev) => ({
          ...prev,
          [type]: { advice: null, loading: false, error: err instanceof Error ? err.message : "Error al conectar con la IA" },
        }));
      }
    },
    [isAuthenticated]
  );

  // Trade edit functions
  const openEditModal = (t: TradeData) => {
    setEditForm({
      type: t.type as "sell" | "buy",
      amount: t.amount.toString(),
      price: t.price.toString(),
      targetPrice: t.targetPrice?.toString() ?? "",
      notes: t.notes ?? "",
      status: t.status,
      profit: t.profit?.toString() ?? "",
      profitPct: t.profitPct?.toString() ?? "",
    });
    setEditingTrade(t);
  };

  const saveEditTrade = async () => {
    if (!editingTrade) return;
    const body: { [key: string]: unknown } = {
      action: "edit",
      type: editForm.type,
      amount: editForm.amount,
      price: editForm.price,
      notes: editForm.notes || null,
    };
    if (editForm.targetPrice) body.targetPrice = editForm.targetPrice;
    else body.targetPrice = null;
    if (editingTrade.status === "closed") {
      if (editForm.status === "open") {
        body.status = "open";
        body.closedAt = null;
        body.profit = null;
        body.profitPct = null;
      } else {
        body.status = editForm.status;
        body.profit = editForm.profit || null;
        body.profitPct = editForm.profitPct || null;
      }
    }
    try {
      const res = await fetch(`/api/trades/${editingTrade.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditingTrade(null);
        fetchRates(timeRange, recordsPage, tradesPage);
      } else {
        alert("No se pudo guardar el trade. Intenta de nuevo.");
      }
    } catch {
      alert("No se pudo guardar el trade. Revisa tu conexión e intenta de nuevo.");
    }
  };

  const deleteTrade = async (id: number) => {
    if (!confirm("¿Eliminar este trade definitivamente?")) return;
    try {
      const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
      if (res.ok) fetchRates(timeRange, recordsPage, tradesPage);
      else alert("No se pudo eliminar el trade. Intenta de nuevo.");
    } catch {
      alert("No se pudo eliminar el trade. Revisa tu conexión e intenta de nuevo.");
    }
  };

  // Pagination
  const goToPage = (page: number, setter: (p: number) => void) => { if (page >= 1) setter(page); };
  const renderPagination = (current: number, total: number, setter: (p: number) => void) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-3">
        <button onClick={() => goToPage(current - 1, setter)} disabled={current <= 1}
          className="rounded-none border border-brand-green/10 px-3 py-1.5 text-xs font-medium text-brand-green/50 transition hover:border-brand-green/20 hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40">
          ← Anterior
        </button>
        <span className="text-xs text-brand-green/40">Pág. {current} de {total}</span>
        <button onClick={() => goToPage(current + 1, setter)} disabled={current >= total}
          className="rounded-none border border-brand-green/10 px-3 py-1.5 text-xs font-medium text-brand-green/50 transition hover:border-brand-green/20 hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40">
          Siguiente →
        </button>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-brand-cream">
      {/* ═══ MOBILE OVERLAY ═══ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-brand-green/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-brand-green/10 bg-brand-cream transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center justify-between border-b border-brand-green/10 px-5">
          <a href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-none bg-brand-green text-sm font-bold text-brand-cream">
              V
            </span>
            <span className="font-serif text-base font-bold tracking-tight text-brand-green">
              VE <span className="text-brand-yellow">Dólar</span>
            </span>
          </a>
          <button onClick={() => setSidebarOpen(false)} className="rounded-none p-1 text-brand-green/40 transition hover:bg-brand-green/5 hover:text-brand-green lg:hidden">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-sm font-medium transition ${
                activeView === item.id
                  ? "bg-brand-green/10 text-brand-green font-semibold"
                  : "text-brand-green/50 hover:bg-brand-green/5 hover:text-brand-green"
              }`}
            >
              {item.label}
              {item.id === "trades" && isAuthenticated && trades.filter((t) => t.status === "open").length > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-green px-1.5 text-[10px] font-bold text-brand-cream">
                  {trades.filter((t) => t.status === "open").length}
                </span>
              )}
            </button>
          ))}
        </nav>


      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-brand-green/10 bg-brand-cream px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-none p-1.5 text-brand-green/50 transition hover:bg-brand-green/5 hover:text-brand-green lg:hidden">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-brand-green">
                {NAV_ITEMS.find((i) => i.id === activeView)?.label}
              </h1>
              <p className="text-xs text-brand-green/40">
                {activeView === "market" && "Monitoreo en tiempo real del mercado USDT/VES"}
                {activeView === "trades" && "Gestiona tus operaciones de compra y venta"}
                {activeView === "ia" && "Asesoría inteligente para decisiones de trading"}
                {activeView === "patterns" && "Patrones horarios y mejores momentos para operar"}
                {activeView === "intervencion" && "Cálculo de intervención digital sobre la tasa BCV"}
                {activeView === "alerts" && "Recibe un aviso por Telegram cuando el precio cruce tu umbral"}
                {activeView === "aperturas" && "Histórico de aperturas de mesa de cambio por banco"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ThemeToggleButton />
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="inline-flex items-center gap-2 rounded-none bg-brand-green px-4 py-2 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Iniciar sesión
              </button>
            )}
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {fetchError && (
              <div className="flex items-center justify-between gap-3 rounded-none border border-brand-yellow/30 bg-brand-yellow/5 px-4 py-2.5 text-sm text-brand-green">
                <span>{fetchError}</span>
                <button
                  onClick={() => fetchRates(timeRange, recordsPage, tradesPage)}
                  className="shrink-0 font-medium underline hover:no-underline"
                >
                  Reintentar
                </button>
              </div>
            )}
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
            {activeView === "market" && (
              <MarketView
                latestMarket={latestMarket}
                paraleloHistory={paraleloHistory}
                exchangeHistory={exchangeHistory}
                latestExchanges={latestExchanges}
                patterns={patterns}
                currentHour={currentHour}
                timeRange={timeRange}
                isFetching={isFetching}
                onRangeChange={handleRangeChange}
                chartData={chartData}
                recentRecords={recentRecords}
              />
            )}

            {activeView === "trades" && (
              <div className="space-y-6">
                {/* Trade Tracker */}
                {isAuthenticated ? (
                  <TradePanelView
                    currentPrice={latestMarket?.price ?? null}
                    onTradeChange={() => fetchRates(timeRange, recordsPage, tradesPage)}
                  />
                ) : (
                  <div>
                    <h2 className="mb-4 text-xl font-semibold text-brand-green">Trade Tracker</h2>
                    <LoginPrompt />
                  </div>
                )}

                {/* Trade History */}
                <div>
                  <h2 className="mb-4 text-xl font-semibold text-brand-green">Historial de trades</h2>
                  {isAuthenticated ? (
                    <>
                      <div className="overflow-x-auto rounded-none border border-brand-green/10">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-brand-green/10">
                            <tr>
                              <th className="px-4 py-3 font-medium text-brand-green/50">#</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50">Tipo</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50">Estado</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Cantidad</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Precio</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Ganancia</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50 text-right">Rendim.</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50">Apertura</th>
                              <th className="px-4 py-3 font-medium text-brand-green/50 text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-green/10">
                            {trades.map((t) => (
                              <tr key={t.id} className={`transition hover:bg-brand-green/5 ${t.status === "open" ? "bg-brand-green/5" : ""}`}>
                                <td className="px-4 py-2.5 font-mono text-xs text-brand-green/40">{t.id}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${t.type === "sell" ? "bg-brand-yellow/15 text-brand-green" : "bg-brand-green/10 text-brand-green"}`}>
                                    {t.type === "sell" ? "VENTA" : "COMPRA"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${t.status === "open" ? "bg-brand-green/10 text-brand-green" : "bg-brand-green/5 text-brand-green/50"}`}>
                                    {t.status === "open" ? "Activo" : "Cerrado"}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">{fmtNum(t.amount, 0)}</td>
                                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-brand-green">{fmtNum(t.price)}</td>
                                <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${t.profit !== null && t.profit > 0 ? "text-brand-up" : t.profit !== null && t.profit < 0 ? "text-brand-down" : "text-brand-green/40"}`}>
                                  {t.profit !== null ? `${t.profit >= 0 ? "+" : ""}${fmtNum(t.profit)} Bs.` : "—"}
                                </td>
                                <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${t.profitPct !== null && t.profitPct > 0 ? "text-brand-up" : t.profitPct !== null && t.profitPct < 0 ? "text-brand-down" : "text-brand-green/40"}`}>
                                  {t.profitPct !== null ? `${t.profitPct >= 0 ? "+" : ""}${t.profitPct.toFixed(2)}%` : "—"}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-xs text-brand-green/40">
                                  {new Date(t.createdAt).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => openEditModal(t)} className="rounded-none bg-brand-green/5 px-2 py-1 text-xs text-brand-green/60 transition hover:bg-brand-green/10 hover:text-brand-green" title="Editar">Editar</button>
                                    <button onClick={() => deleteTrade(t.id)} className="rounded-none bg-brand-green/5 px-2 py-1 text-xs text-brand-green/60 transition hover:bg-brand-down/10 hover:text-brand-down" title="Eliminar">Eliminar</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {trades.length === 0 && (
                              <tr><td colSpan={9} className="px-4 py-8 text-center text-brand-green/40">No hay trades registrados.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {renderPagination(tradesPage, tradesTotalPages, setTradesPage)}
                    </>
                  ) : (
                    <LoginPrompt />
                  )}
                </div>
              </div>
            )}

            {activeView === "ia" && (
              <IaView
                isAuthenticated={isAuthenticated}
                adviceState={adviceState}
                onRequestAdvice={requestAdvice}
              />
            )}

            {activeView === "patterns" && (
              <PatternsView patterns={patterns} currentHour={currentHour} />
            )}

            {activeView === "aperturas" && <AperturasView />}

            {activeView === "intervencion" && (
              <IntervencionView
                bcvPrice={latestMarket?.bcvPrice ?? null}
                intervencionPrice={latestMarket?.intervencionPrice ?? null}
              />
            )}

            {activeView === "alerts" && (
              <AlertsView currentPrice={latestMarket?.price ?? null} />
            )}

            {activeView === "settings" && (
              <SettingsView />
            )}
            </motion.div>
          </div>
        </main>
      </div>

      {/* ═══ EDIT TRADE MODAL ═══ */}
      <AnimatePresence>
      {editingTrade && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-green/20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="mx-4 w-full max-w-lg rounded-none border border-brand-green/10 bg-white p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-brand-green">Editar trade #{editingTrade.id}</h3>
              <button onClick={() => setEditingTrade(null)} className="rounded-none p-1 text-brand-green/40 transition hover:bg-brand-green/5 hover:text-brand-green">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-brand-green/50">Tipo</label>
                  <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "sell" | "buy" })}
                    className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green">
                    <option value="sell">Venta</option><option value="buy">Compra</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-brand-green/50">Estado</label>
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green">
                    <option value="open">Activo</option><option value="closed">Cerrado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-brand-green/50">Cantidad (USDT)</label>
                  <input type="number" step="any" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-brand-green/50">Precio (VES)</label>
                  <input type="number" step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-green/50">Notas</label>
                <input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
              </div>
              {editForm.status === "closed" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-brand-green/50">Ganancia (Bs.)</label>
                    <input type="number" step="0.01" value={editForm.profit} onChange={(e) => setEditForm({ ...editForm, profit: e.target.value })}
                      className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-brand-green/50">Rendimiento (%)</label>
                    <input type="number" step="0.01" value={editForm.profitPct} onChange={(e) => setEditForm({ ...editForm, profitPct: e.target.value })}
                      className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditingTrade(null)} className="rounded-none border border-brand-green/10 px-4 py-2 text-sm text-brand-green/50 transition hover:border-brand-green/20 hover:text-brand-green">
                Cancelar
              </button>
              <button onClick={saveEditTrade} className="rounded-none bg-brand-green px-4 py-2 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90">
                Guardar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

// ── Inline TradePanel View ──
function TradePanelView({
  currentPrice,
  onTradeChange,
}: {
  currentPrice: number | null;
  onTradeChange: () => void;
}) {
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"sell" | "buy">("sell");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(currentPrice?.toFixed(2) ?? "");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");

  const loadTrades = () => {
    fetch("/api/trades?status=open")
      .then((r) => { if (r.status === 401) return; return r.json(); })
      .then((d) => { if (d?.trades) setTrades(d.trades); })
      .catch(() => {});
  };

  useEffect(() => { loadTrades(); }, []);
  useEffect(() => { if (currentPrice) setPrice(currentPrice.toFixed(2)); }, [currentPrice]);

  const createTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount, price, targetPrice, notes }),
    });
    if (res.ok) {
      setShowForm(false);
      setAmount("");
      setTargetPrice("");
      setNotes("");
      loadTrades();
      onTradeChange();
    }
  };

  const closeTrade = async (id: number) => {
    const res = await fetch(`/api/trades/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (res.ok) { loadTrades(); onTradeChange(); }
  };

  const openTrades = trades.filter((t) => t.status === "open");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">        <h2 className="text-xl font-semibold text-brand-green">Trade Tracker</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-none bg-brand-green px-4 py-1.5 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90"
        >
          {showForm ? "Cancelar" : "Nuevo trade"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createTrade} className="mb-4 rounded-none border border-brand-green/10 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-brand-green/50">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as "sell" | "buy")}
                className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green">
                <option value="sell">Venta</option><option value="buy">Compra</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-green/50">Cantidad USDT</label>
              <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="100"
                className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-green/50">Precio VES</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required
                className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-green/50">Objetivo (opcional)</label>
              <input type="number" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)}
                placeholder={type === "sell" ? "790" : "840"}
                className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nota opcional..."
                className="w-full rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30" />
            </div>
            <button type="submit"
              className="rounded-none bg-brand-green px-4 py-2 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90">
              Registrar {type === "sell" ? "venta" : "compra"}
            </button>
          </div>
        </form>
      )}

      {openTrades.length === 0 ? (
        <div className="rounded-none border border-brand-green/10 p-6 text-center text-sm text-brand-green/40">
          No hay trades activos. Registra una venta de USDT para empezar a monitorear el ciclo.
        </div>
      ) : (
        <div className="space-y-3">
          {openTrades.map((t) => {
            const diff = currentPrice && currentPrice > 0
              ? t.type === "sell" ? ((t.price - currentPrice) / t.price) * 100 : ((currentPrice - t.price) / t.price) * 100
              : null;
            const reachedTarget = t.targetPrice && currentPrice &&
              ((t.type === "sell" && currentPrice <= t.targetPrice) || (t.type === "buy" && currentPrice >= t.targetPrice));

            return (
              <div key={t.id} className={`rounded-none border p-4 ${reachedTarget ? "border-brand-green/20 bg-brand-green/5" : "border-brand-green/10"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${t.type === "sell" ? "bg-brand-yellow/15 text-brand-green" : "bg-brand-green/10 text-brand-green"}`}>
                      {t.type === "sell" ? "VENTA" : "COMPRA"}
                    </span>
                    <span className="ml-2 text-xs text-brand-green/40">
                      {new Date(t.createdAt).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => closeTrade(t.id)} className="rounded-none bg-brand-green px-3 py-1 text-xs text-brand-cream transition hover:bg-brand-green/90">Cerrar</button>
                    <button onClick={async () => { if (!confirm("¿Eliminar este trade?")) return; await fetch(`/api/trades/${t.id}`, { method: "DELETE" }); loadTrades(); onTradeChange(); }}
                      className="rounded-none bg-brand-green/5 px-2.5 py-1 text-xs text-brand-green/50 transition hover:bg-brand-down/10 hover:text-brand-down" title="Eliminar">Eliminar</button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-brand-green/40">Precio</p><p className="text-lg font-bold text-brand-green">{fmtNum(t.price)} VES</p></div>
                  <div><p className="text-xs text-brand-green/40">Cantidad</p><p className="text-lg font-bold text-brand-green">{fmtNum(t.amount, 0)} USDT</p></div>
                  <div><p className="text-xs text-brand-green/40">Actual</p><p className="text-lg font-bold text-brand-green">{currentPrice ? fmtNum(currentPrice) : "—"}</p></div>
                  <div><p className="text-xs text-brand-green/40">Potencial</p>
                    <p className={`text-lg font-bold ${diff !== null && diff > 0 ? "text-brand-up" : diff !== null && diff < 0 ? "text-brand-down" : "text-brand-green"}`}>
                      {diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                </div>
                {reachedTarget && <div className="mt-2 flex items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-brand-green">Objetivo alcanzado</span></div>}
                {t.notes && <p className="mt-2 text-xs text-brand-green/40">{t.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Alerts View ──
function AlertsView({ currentPrice }: { currentPrice: number | null }) {
  const [alerts, setAlerts] = useState<PriceAlertData[]>([]);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = () => {
    fetch("/api/alerts")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => { if (d?.alerts) setAlerts(d.alerts); })
      .catch(() => {});
  };

  useEffect(() => { loadAlerts(); }, []);

  const createAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, targetPrice }),
      });
      const data = await res.json();
      if (res.ok) {
        setTargetPrice("");
        loadAlerts();
      } else {
        setError(data.error ?? "No se pudo crear la alerta");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  const deleteAlert = async (id: number) => {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    loadAlerts();
  };

  const activeAlerts = alerts.filter((a) => a.active);
  const pastAlerts = alerts.filter((a) => !a.active);

  return (
    <div className="space-y-6">
      <form onSubmit={createAlert} className="border border-brand-green/10 p-4">
        <h2 className="mb-3 text-sm font-semibold text-brand-green">Nueva alerta</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "above" | "below")}
            className="rounded-none border border-brand-green/10 bg-brand-cream px-3 py-2 text-sm text-brand-green"
          >
            <option value="above">Cuando suba a</option>
            <option value="below">Cuando baje a</option>
          </select>
          <input
            type="number"
            step="0.01"
            required
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder={currentPrice ? currentPrice.toFixed(2) : "Precio en VES"}
            className="rounded-none border border-brand-green/10 px-3 py-2 text-sm text-brand-green placeholder:text-brand-green/30"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-none bg-brand-green px-4 py-2 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creando…" : "Crear alerta"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-brand-down">{error}</p>}
      </form>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-brand-green">Alertas activas</h2>
        {activeAlerts.length === 0 ? (
          <div className="border border-brand-green/10 p-6 text-center text-sm text-brand-green/40">
            No tienes alertas activas.
          </div>
        ) : (
          <div className="divide-y divide-brand-green/10 border border-brand-green/10">
            {activeAlerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-brand-green">
                  {a.direction === "above" ? "Sube a" : "Baja a"}{" "}
                  <span className="font-mono font-semibold">{fmtNum(a.targetPrice)} VES</span>
                </span>
                <button
                  onClick={() => deleteAlert(a.id)}
                  className="rounded-none bg-brand-green/5 px-2 py-1 text-xs text-brand-green/60 transition hover:bg-brand-down/10 hover:text-brand-down"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pastAlerts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-brand-green">Historial</h2>
          <div className="divide-y divide-brand-green/10 border border-brand-green/10">
            {pastAlerts.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3 text-sm text-brand-green/50">
                <span>
                  {a.direction === "above" ? "Subió a" : "Bajó a"}{" "}
                  <span className="font-mono">{fmtNum(a.targetPrice)} VES</span>
                </span>
                <span className="text-xs">
                  {a.triggeredAt
                    ? new Date(a.triggeredAt).toLocaleString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aperturas View ──
interface AperturaEntryData {
  id: number;
  date: string;
  bank: string;
  mechanism: string;
  time: string;
  duration: string | null;
}

function AperturasView() {
  const [entries, setEntries] = useState<AperturaEntryData[]>([]);
  const [summary, setSummary] = useState<{ bank: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/aperturas?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries ?? []);
        setSummary(d.summary ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-VE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-brand-green/40">
          Historial de aperturas de mesa de cambio por banco, actualizado en cada corrida del cron.
        </p>
        <div className="flex overflow-hidden border border-brand-green/10">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                days === d ? "bg-brand-green text-brand-cream" : "text-brand-green/50 hover:bg-brand-green/5 hover:text-brand-green"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {summary.length > 0 && (
        <div className="flex flex-wrap divide-x divide-brand-green/10 border-y border-brand-green/10">
          {summary.map((s) => (
            <div key={s.bank} className="px-4 py-3">
              <p className="text-xs text-brand-green/40">{s.bank}</p>
              <p className="font-mono text-lg font-semibold text-brand-green">{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-brand-green/40">Cargando…</p>
      ) : entries.length === 0 ? (
        <div className="border border-brand-green/10 p-8 text-center text-sm text-brand-green/40">
          No hay aperturas registradas todavía. Se van guardando automáticamente cada vez que corre el cron.
        </div>
      ) : (
        <div className="overflow-x-auto border border-brand-green/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand-green/10 text-xs uppercase tracking-wider text-brand-green/40">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Banco</th>
                <th className="px-4 py-3 font-medium">Mecanismo</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-green/10">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-green/50">{fmtDate(e.date)}</td>
                  <td className="px-4 py-2.5 font-medium text-brand-green">{e.bank}</td>
                  <td className="px-4 py-2.5 text-brand-green/70">{e.mechanism}</td>
                  <td className="px-4 py-2.5 font-mono text-brand-green">{e.time}</td>
                  <td className="px-4 py-2.5 text-brand-green/50">{e.duration ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
