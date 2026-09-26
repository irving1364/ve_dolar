import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700"],
  variable: "--font-serif",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "VE Dólar — Monitoreo de Arbitraje USDT/VES en Venezuela",
    template: "%s | VE Dólar",
  },
  description:
    "Monitorea la tasa de cambio BCV y paralela USDT/VES en Venezuela en tiempo real. Recibe señales de trading, asesoría con IA y alertas Telegram para arbitraje.",
  keywords: [
    "dólar paralelo Venezuela",
    "USDT VES",
    "tasa de cambio",
    "arbitraje",
    "Binance P2P",
    "BCV",
    "criptomonedas Venezuela",
  ],
  authors: [{ name: "VE Dólar" }],
  creator: "VE Dólar",
  publisher: "VE Dólar",
  metadataBase: new URL("https://vedolar.vercel.app"),
  openGraph: {
    type: "website",
    locale: "es_VE",
    url: "https://vedolar.vercel.app",
    siteName: "VE Dólar",
    title: "VE Dólar — Monitoreo de Arbitraje USDT/VES en Venezuela",
    description:
      "Monitorea la tasa de cambio del dólar paralelo en Venezuela en tiempo real. Señales de trading, IA y alertas Telegram.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VE Dólar — Monitoreo de Arbitraje USDT/VES",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VE Dólar — Monitoreo de Arbitraje USDT/VES",
    description:
      "Monitorea la tasa de cambio del dólar paralelo en Venezuela en tiempo real con asesoría IA.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
