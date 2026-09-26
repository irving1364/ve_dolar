import { auth } from "@/auth";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-brand-cream px-4">
        <div className="w-full rounded-none border border-brand-green/10 p-8 text-center">
          <div className="mb-4 text-6xl">👋</div>
          <h1 className="mb-2 text-2xl font-bold text-brand-green">
            Ya has iniciado sesión
          </h1>
          <p className="mb-6 text-sm text-brand-green/50">
            {session.user?.name} — {session.user?.email}
          </p>
          <a
            href="/dashboard"
            className="inline-block rounded-none bg-brand-green px-6 py-3 text-sm font-semibold text-brand-cream transition-all duration-200 hover:bg-brand-green/90 active:scale-[0.97]"
          >
            Ir al Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-brand-cream px-4">
      <div className="w-full rounded-none border border-brand-green/10 p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-none bg-brand-green text-xl font-bold text-brand-cream">
          V
        </span>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-brand-green">VE Dólar</h1>
        <p className="mb-8 text-sm leading-relaxed text-brand-green/55">
          Monitoreo de tasas USDT/VES · BCV y Paralelo
          <br />
          Inicia sesión para acceder a trading, asesoría IA y más.
        </p>
        <a
          href="/api/auth/signin"
          className="inline-flex items-center gap-3 rounded-none border border-brand-green/10 bg-white px-6 py-3 text-sm font-medium text-brand-green transition hover:border-brand-green/20 hover:bg-brand-cream"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Iniciar sesión con Google
        </a>
      </div>
    </main>
  );
}
