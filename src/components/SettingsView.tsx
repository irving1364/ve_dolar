"use client";

import { useState, useEffect } from "react";

export default function SettingsView() {
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
        setMessage({ type: "success", text: "✅ Configuración guardada" });
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
        text: "Primero guarda un Chat ID de Telegram",
      });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/test-telegram");
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: "success", text: "✅ Mensaje de prueba enviado a Telegram" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Error al enviar prueba" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Telegram Section */}
      <div className="rounded-none border border-brand-green/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl">📱</span>
          <div>
            <h3 className="text-lg font-semibold text-brand-green">Notificaciones Telegram</h3>
            <p className="text-xs text-brand-green/40">Configura tu bot de Telegram para recibir alertas de trading en tiempo real</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-brand-green/70">
              Tu Chat ID de Telegram
            </label>
            <p className="mb-3 text-xs text-brand-green/40">
              Para recibir alertas necesitas dos pasos:
            </p>
            <ol className="mb-4 list-inside list-decimal space-y-1.5 text-sm text-brand-green/50">
              <li>
                Busca <a href="https://t.me/vedolar_alertas_bot" target="_blank" rel="noopener noreferrer" className="font-mono text-brand-green underline">@vedolar_alertas_bot</a> en Telegram y envíale <span className="font-mono text-brand-green">/start</span> — sin esto, Telegram no te dejará recibir mensajes nuestros
              </li>
              <li>
                Busca <span className="font-mono text-brand-green">@get_id_bot</span> en Telegram, envíale <span className="font-mono text-brand-green">/start</span> y copia tu ID numérico
              </li>
              <li>
                Pega tu ID abajo y guarda
              </li>
            </ol>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="Ej: 123456789"
              className="w-full rounded-none border border-brand-green/10 px-4 py-2.5 text-sm text-brand-green placeholder:text-brand-green/30 focus:border-brand-green focus:outline-none"
            />
          </div>

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
                  : "border border-red-200 bg-red-50 text-red-600"
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
              {testing ? "Enviando..." : "📨 Probar Telegram"}
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="rounded-none bg-brand-green px-5 py-2.5 text-sm font-medium text-brand-cream transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando..." : "💾 Guardar configuración"}
            </button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="rounded-none border border-brand-green/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl">👤</span>
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
