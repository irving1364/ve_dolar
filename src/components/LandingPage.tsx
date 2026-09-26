"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";
import UserMenu from "./UserMenu";

/* ─── JSON-LD Structured Data (SoftwareApp) ─── */
function JsonLdSoftwareApp() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "VE Dólar",
    description:
      "Monitoreo de la tasa de cambio USDT/VES en Venezuela en tiempo real con asesoría de inteligencia artificial, señales de trading y alertas Telegram.",
    operatingSystem: "Web",
    applicationCategory: "FinanceApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "256",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

/* ─── Landing Page ─── */
export default function LandingPage() {
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <JsonLdSoftwareApp />
      <div className="min-h-screen bg-brand-cream font-sans text-brand-green selection:bg-brand-yellow selection:text-brand-cream">
        {/* ═══ TICKER ═══ */}
        <div className="hidden items-center gap-8 whitespace-nowrap bg-brand-green px-6 py-2 font-mono text-xs tracking-wide text-brand-cream sm:flex">
          <span className="text-brand-yellow/80">USDT/VES · BINANCE P2P</span>
          <span className="text-brand-cream/50">Monitoreo en tiempo real · Señales de trading · Asesoría IA</span>
          <span className="ml-auto text-brand-cream/50">Datos de Binance P2P · No es asesoría financiera</span>
        </div>

        {/* ═══ NAVBAR ═══ */}
        <nav
          className={`sticky top-0 z-50 bg-brand-cream transition-all duration-300 ${
            scrolled ? "border-b border-brand-green/10" : "border-b border-transparent"
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <a href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-70">
              <span className="font-serif text-xl font-bold tracking-tight text-brand-green">
                VE D&Oacute;LAR
              </span>
            </a>

            <div className="flex items-center gap-8">
              <button
                onClick={scrollToFeatures}
                className="hidden text-sm text-brand-green/70 transition-colors hover:text-brand-green sm:block"
              >
                Características
              </button>

              <button
                onClick={toggle}
                className="flex h-8 w-8 items-center justify-center border border-brand-green/15 text-brand-green/60 transition hover:border-brand-green/30 hover:text-brand-green"
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

              {session?.user ? (
                <UserMenu />
              ) : (
                <button
                  onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                  className="bg-brand-green px-5 py-2.5 text-sm font-semibold text-brand-cream transition hover:bg-brand-green/90"
                >
                  Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section className="px-6 pb-16 pt-20 sm:pt-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mx-auto max-w-3xl"
          >
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.14em] text-brand-yellow">
              Mercado USDT/VES · Tiempo real
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-brand-green sm:text-5xl md:text-[3.4rem]">
              El arbitraje USDT/VES,
              <br />
              sin ruido.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-brand-green/60">
              Tasas del paralelo y BCV en vivo, señales claras para comprar o vender, y
              asesoría de IA cuando la decisión no es obvia.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-7">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="inline-flex items-center gap-2.5 bg-brand-green px-7 py-3.5 text-sm font-semibold text-brand-cream"
              >
                Empezar a monitorear
              </motion.button>
              <button
                onClick={scrollToFeatures}
                className="border-b border-brand-green text-sm font-semibold text-brand-green"
              >
                Ver cómo funciona →
              </button>
            </div>
          </motion.div>

          {/* Stat strip */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="mx-auto mt-16 flex max-w-3xl divide-x divide-brand-green/10 border-y border-brand-green/10"
          >
            {[
              { value: "30 min", label: "Actualización" },
              { value: "24/7", label: "Monitoreo continuo" },
              { value: "IA", label: "Asesoría inteligente" },
              { value: "Telegram", label: "Alertas en vivo" },
            ].map((stat) => (
              <div key={stat.label} className="flex-1 px-4 py-5 text-center sm:px-6">
                <p className="font-mono text-xl font-medium text-brand-green sm:text-2xl">{stat.value}</p>
                <p className="mt-1 text-xs text-brand-green/50">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <motion.section
          id="features"
          ref={featuresRef}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl px-6 py-20"
        >
          <h2 className="text-2xl font-bold text-brand-green sm:text-3xl">
            Todo lo que necesitas para operar
          </h2>
          <p className="mt-2 text-sm text-brand-green/50">Seis herramientas, una sola pantalla.</p>

          <div className="mt-10">
            {[
              {
                title: "Tasas en tiempo real",
                desc: "Monitoreo continuo del dólar paralelo y BCV con actualizaciones cada 30 minutos desde Binance P2P.",
              },
              {
                title: "Señales de trading",
                desc: "Comparamos el precio actual contra el promedio de 48 horas y te decimos cuándo comprar o vender.",
              },
              {
                title: "Asesoría con IA",
                desc: "Consultas inteligentes potenciadas por Groq/Llama 3.3 para decidir cuándo comprar o vender USDT.",
              },
              {
                title: "Patrones horarios",
                desc: "Descubre las mejores horas para operar basado en perfiles históricos de volumen y precio.",
              },
              {
                title: "Alertas Telegram",
                desc: "Recibe señales de trading y resúmenes diarios directamente en tu Telegram personal.",
              },
              {
                title: "Ciclo compra/venta",
                desc: "Registra tus operaciones y monitorea el ciclo completo de venta y recompra de USDT.",
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className={`flex gap-6 py-6 ${i === 0 ? "border-y" : "border-b"} border-brand-green/10`}
              >
                <span className="w-7 shrink-0 font-mono text-sm text-brand-yellow">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-semibold text-brand-green">{feature.title}</h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-brand-green/55">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══ HOW IT WORKS ═══ */}
        <motion.section
          id="how-it-works"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl px-6 py-20"
        >
          <h2 className="text-2xl font-bold text-brand-green sm:text-3xl">¿Cómo funciona?</h2>
          <p className="mt-2 text-sm text-brand-green/50">
            En solo 3 pasos empiezas a monitorear y optimizar tus operaciones.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Inicia sesión",
                desc: "Conéctate con tu cuenta de Google. Sin formularios ni contraseñas que recordar.",
              },
              {
                step: "02",
                title: "Monitorea el mercado",
                desc: "Visualiza tasas en tiempo real, señales de trading y patrones horarios.",
              },
              {
                step: "03",
                title: "Opera con confianza",
                desc: "Usa la asesoría IA, registra tus trades y recibe alertas por Telegram.",
              },
            ].map((step) => (
              <div key={step.step} className="border-t border-brand-green/10 pt-5">
                <span className="font-mono text-sm text-brand-yellow">{step.step}</span>
                <h3 className="mt-2 font-semibold text-brand-green">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-green/55">{step.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ═══ CTA ═══ */}
        <motion.section
          id="cta-section"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl px-6 py-20"
        >
          <div className="bg-brand-green px-8 py-14 text-center sm:px-14">
            <h2 className="text-2xl font-bold text-brand-cream sm:text-3xl">
              ¿Listo para optimizar tu arbitraje?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brand-cream/70">
              Únete gratis. Monitorea tasas, recibe señales de IA y nunca pierdas una
              oportunidad en el mercado USDT/VES.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="mt-7 inline-flex items-center gap-2.5 bg-brand-yellow px-7 py-3.5 text-sm font-bold text-[#161616]"
            >
              Comenzar ahora — es gratis
            </motion.button>
          </div>
        </motion.section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-brand-green/10 px-6 py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-brand-green/45 sm:flex-row">
            <span className="font-serif font-bold text-brand-green">VE D&Oacute;LAR</span>
            <p className="text-center sm:text-left">
              Monitoreo de tasas USDT/VES · Datos de Binance P2P · No es asesoría financiera
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
