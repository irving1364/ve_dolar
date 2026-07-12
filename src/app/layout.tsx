import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VE Dólar — Monitoreo de Arbitraje USDT/VES",
  description:
    "Monitoreo de la tasa de cambio BCV y paralela USDT/VES en Venezuela con asesoría IA para arbitraje.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
