"use client";

import { useState, useEffect } from "react";

interface Trade {
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

interface TradePanelProps {
  currentPrice: number | null;
}

function fmtNum(n: number, d = 2): string {
  return n.toLocaleString("es-VE", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export default function TradePanel({ currentPrice }: TradePanelProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"sell" | "buy">("sell");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(currentPrice?.toFixed(2) ?? "");
  const [targetPrice, setTargetPrice] = useState("");
  const [notes, setNotes] = useState("");

  const loadTrades = () =>
    fetch("/api/trades?status=open")
      .then((r) => r.json())
      .then((d) => setTrades(d.trades ?? []))
      .catch(() => {});

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    if (currentPrice) setPrice(currentPrice.toFixed(2));
  }, [currentPrice]);

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
    }
  };

  const closeTrade = async (id: number) => {
    const res = await fetch(`/api/trades/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (res.ok) loadTrades();
  };

  const openTrades = trades.filter((t) => t.status === "open");
  const hasOpenSell = openTrades.some((t) => t.type === "sell");
  const hasOpenBuy = openTrades.some((t) => t.type === "buy");

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          Trade Tracker
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          {showForm ? "Cancelar" : "Nuevo trade"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createTrade}
          className="mb-4 rounded-xl border border-gray-800 bg-gray-900 p-4"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "sell" | "buy")}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              >
                <option value="sell">Venta</option>
                <option value="buy">Compra</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Cantidad USDT
              </label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="100"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Precio VES
              </label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Objetivo (opcional)
              </label>
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder={type === "sell" ? "790" : "840"}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nota opcional..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Registrar {type === "sell" ? "venta" : "compra"}
            </button>
          </div>
        </form>
      )}

      {openTrades.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
          No hay trades activos. Registra una venta de USDT para empezar a
          monitorear el ciclo.
        </div>
      ) : (
        <div className="space-y-3">
          {openTrades.map((t) => {
            const diff =
              currentPrice && currentPrice > 0
                ? t.type === "sell"
                  ? ((t.price - currentPrice) / t.price) * 100
                  : ((currentPrice - t.price) / t.price) * 100
                : null;

            const reachedTarget =
              t.targetPrice &&
              currentPrice &&
              ((t.type === "sell" && currentPrice <= t.targetPrice) ||
                (t.type === "buy" && currentPrice >= t.targetPrice));

            return (
              <div
                key={t.id}
                className={`rounded-xl border p-4 ${
                  reachedTarget
                    ? "border-emerald-600/50 bg-emerald-950/20"
                    : "border-gray-800 bg-gray-900"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.type === "sell"
                          ? "bg-amber-950 text-amber-400"
                          : "bg-emerald-950 text-emerald-400"
                      }`}
                    >
                      {t.type === "sell" ? "VENTA" : "COMPRA"}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {new Date(t.createdAt).toLocaleString("es-VE", {
                        timeZone: "America/Caracas",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => closeTrade(t.id)}
                    className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-gray-300 transition hover:bg-gray-600"
                  >
                    Cerrar trade
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">
                      Vendiste a
                    </p>
                    <p className="text-lg font-bold text-white">
                      {fmtNum(t.price)} VES
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cantidad</p>
                    <p className="text-lg font-bold text-white">
                      {fmtNum(t.amount, 0)} USDT
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      Precio actual
                    </p>
                    <p className="text-lg font-bold text-white">
                      {currentPrice ? fmtNum(currentPrice) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      Ganancia potencial
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        diff !== null && diff > 0
                          ? "text-emerald-400"
                          : diff !== null && diff < 0
                            ? "text-red-400"
                            : "text-white"
                      }`}
                    >
                      {diff !== null ? `${diff > 0 ? "+" : ""}${diff.toFixed(2)}%` : "—"}
                    </p>
                  </div>
                </div>

                {t.targetPrice && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-gray-500">
                      Objetivo:{" "}
                      <span className="font-mono text-white">
                        {fmtNum(t.targetPrice)} VES
                      </span>
                    </span>
                    {reachedTarget && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-2 py-0.5 text-emerald-400">
                        🎯 Objetivo alcanzado
                      </span>
                    )}
                  </div>
                )}

                {t.notes && (
                  <p className="mt-2 text-xs text-gray-500">{t.notes}</p>
                )}

                {t.type === "sell" && (
                  <div className="mt-2 rounded-lg bg-gray-800/50 p-2 text-xs text-gray-400">
                    {diff !== null && diff > 0
                      ? `Si recompras ahora a ${fmtNum(currentPrice!)} VES, recuperas tus USDT con ${diff.toFixed(2)}% más de bolívares.`
                      : diff !== null && diff < 0
                        ? `El precio aún no baja lo suficiente. Desde que vendiste, ha subido ${Math.abs(diff).toFixed(2)}%.`
                        : "Esperando datos de mercado..."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className={`rounded-xl border p-4 ${
            currentPrice && hasOpenSell
              ? "border-emerald-800/50 bg-emerald-950/10"
              : "border-gray-800 bg-gray-900/50"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Si tienes USDT
          </p>
          <p className="mt-1 text-sm text-gray-300">
            {hasOpenSell
              ? "Ya tienes una venta activa registrada. Espera a que baje para recomprar."
              : currentPrice
                ? `Precio actual: ${fmtNum(currentPrice)} VES`
                : "Esperando datos..."}
          </p>
          {!hasOpenSell && currentPrice && (
            <p className="mt-1 text-xs text-gray-500">
              Puedes vender ahora y registrar el trade para monitorear la
              recompra.
            </p>
          )}
        </div>

        <div
          className={`rounded-xl border p-4 ${
            currentPrice && hasOpenSell
              ? "border-emerald-800/50 bg-emerald-950/10"
              : "border-gray-800 bg-gray-900/50"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Si tienes Bs.
          </p>
          <p className="mt-1 text-sm text-gray-300">
            {hasOpenSell
              ? "Estás esperando la recompra. Cuando el precio baje a tu objetivo, cierra el trade."
              : hasOpenBuy
                ? "Ya tienes una compra activa."
                : currentPrice
                  ? `Precio actual: ${fmtNum(currentPrice)} VES`
                  : "Esperando datos..."}
          </p>
          {!hasOpenSell && !hasOpenBuy && (
            <p className="mt-1 text-xs text-gray-500">
              Recomienda vender USDT cuando la señal sea favorable, registra el
              trade y espera la recompra.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
