"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL_MS = 2500;

export default function SettingsView() {
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<number | null>(null);
  const [linkStatus, setLinkStatus] = useState<"idle" | "waiting" | "expired">("idle");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const linkExpiresAtRef = useRef<number | null>(null);

  useEffect(() => {
    linkExpiresAtRef.current = linkExpiresAt;
  }, [linkExpiresAt]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setTelegramChatId(data.settings.telegramChatId ?? "");
          setNotifications(data.settings.notifications ?? true);
        }
      })
      .catch(() => {});
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const startLink = async () => {
    setGeneratingLink(true);
    setMessage(null);
    stopPolling();
    try {
      const res = await fetch("/api/settings/telegram-link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "No se pudo generar el código" });
        return;
      }
      setLinkCode(data.code);
      setLinkExpiresAt(new Date(data.expiresAt).getTime());
      setLinkStatus("waiting");

      pollRef.current = setInterval(async () => {
        if (Date.now() > (linkExpiresAtRef.current ?? 0)) {
          setLinkStatus("expired");
          stopPolling();
          return;
        }
        try {
          const checkRes = await fetch("/api/settings/telegram-link");
          const checkData = await checkRes.json();
          if (checkData.linked) {
            setTelegramChatId(checkData.telegramChatId);
            setLinkStatus("idle");
            setLinkCode(null);
            stopPolling();
            setMessage({ type: "success", text: "Telegram conectado correctamente" });
          } else if (checkData.expired) {
            setLinkStatus("expired");
            stopPolling();
          }
        } catch {
          // reintenta en el siguiente tick
        }
      }, POLL_INTERVAL_MS);
    } catch {
      setMessage({ type: "error", text: "Error de conexión al generar el código" });
    } finally {
      setGeneratingLink(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramChatId: telegramChatId || null,
          notifications,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Configuración guardada" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "Error al guardar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  };

  const testTelegram = async () => {
    if (!telegramChatId) {
      setMessage({
        type: "error",
        text: "Primero conecta o pega tu Chat ID de Telegram",
      });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/test-telegram");
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "Mensaje de prueba enviado a Telegram" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Error al enviar prueba" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setTesting(false);
    }
  };

  const secondsLeft =
    linkStatus === "waiting" && linkExpiresAt
      ? Math.max(0, Math.round((linkExpiresAt - Date.now()) / 1000))
      : 0;

  return (
    <div className="space-y-6">
      {/* Telegram Section */}
      <div className="rounded-none border border-brand-green/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold text-brand-green">Notificaciones Telegram</h3>
            <p className="text-xs text-brand-green/40">Conecta tu cuenta para recibir alertas de trading en tiempo real</p>
          </div>
        </div>

        <div className="space-y-4">
          {telegramChatId && linkStatus === "idle" ? (
            <div className="flex items-center justify-between rounded-none border border-brand-green/20 bg-brand-green/5 p-4">
              <div>
                <p className="text-sm font-medium text-brand-green">Telegram conectado</p>
                <p className="text-xs text-brand-green/40 font-mono">Chat ID: {telegramChatId}</p>
              </div>
              <button
                onClick={startLink}
                disabled={generatingLink}
                className="text-xs font-medium text-brand-green/60 underline hover:text-brand-green"
              >
                Reconectar
              </button>
            </div>
          ) : linkStatus === "waiting" ? (
            <div className="rounded-none border border-brand-green/20 bg-brand-green/5 p-5 text-center">
              <p className="mb-3 text-xs text-brand-green/50">
                Envía este código a{" "}
                <a href="https://t.me/vedolar_alertas_bot" target="_blank" rel="noopener noreferrer" className="font-mono text-brand-green underline">
                  @vedolar_alertas_bot
                </a>{" "}
                en Telegram
              </p>
              <p className="mb-3 font-mono text-3xl font-bold tracking-[0.3em] text-brand-green">{linkCode}</p>
              <p className="text-xs text-brand-green/40">
                Esperando tu mensaje… expira en {secondsLeft}s
              </p>
            </div>
          ) : (
            <div>
              {linkStatus === "expired" && (
                <p className="mb-3 text-xs text-brand-yellow">El código expiró, genera uno nuevo.</p>
              )}
              <button
                onClick={startLink}
                disabled={generatingLink}
                className="w-full rounded-none bg-brand-green px-5 py-3 text-sm font-semibold text-brand-cream transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingLink ? "Generando código…" : "Conectar con Telegram"}
              </button>
            </div>
          )}

          <button
            onClick={() => setShowManual((v) => !v)}
            className="text-xs text-brand-green/40 underline hover:text-brand-green/60"
          >
            {showManual ? "Ocultar" : "¿Ya conoces tu Chat ID? Ingrésalo manualmente"}
          </button>

          {showManual && (
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Ej: 123456789"
              className="w-full rounded-none border border-brand-green/10 px-4 py-2.5 text-sm text-brand-green placeholder:text-brand-green/30 focus:border-brand-green focus:outline-none"
            />
          )}

          <div className="flex items-center justify-between rounded-none border border-brand-green/10 p-4">
            <div>
              <p className="text-sm font-medium text-brand-green">Notificaciones activas</p>
              <p className="text-xs text-brand-green/40">Recibir alertas de señales y trades en Telegram</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative h-7 w-12 rounded-full transition ${
                notifications ? "bg-brand-green" : "bg-brand-green/20"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition ${
                  notifications ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {message && (
            <div
              className={`rounded-none p-3 text-sm ${
                message.type === "success"
                  ? "border border-brand-green/20 bg-brand-green/5 text-brand-green"
                  : "border border-brand-down/30 bg-brand-down/5 text-brand-down"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={testTelegram}
              disabled={testing || !telegramChatId}
              className="rounded-none border border-brand-green/10 px-5 py-2.5 text-sm font-medium text-brand-green/60 transition hover:border-brand-green/20 hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40"
            >
              {testing ? "Enviando..." : "Probar Telegram"}
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="rounded-none bg-brand-green px-5 py-2.5 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-none border border-brand-green/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold text-brand-green">Información de la cuenta</h3>
            <p className="text-xs text-brand-green/40">Tus datos de sesión</p>
          </div>
        </div>
        <p className="text-sm text-brand-green/50">
          Gestiona tu sesión desde el menú de usuario en la esquina superior derecha.
        </p>
      </div>
    </div>
  );
}
