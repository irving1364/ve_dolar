"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function UserMenu() {
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);

  if (!session?.user) return null;

  const initials = session.user.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 rounded-full border border-brand-green/10 p-1 pr-3 transition hover:border-brand-green/20"
        >
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-brand-cream">
              {initials}
            </span>
          )}
          <span className="hidden text-sm font-medium text-brand-green sm:block">
            {session.user.name?.split(" ")[0]}
          </span>
          <svg
            className={`h-4 w-4 text-brand-green/40 transition ${showMenu ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 z-50 mt-2 w-56 rounded-none border border-brand-green/10 bg-white p-2"
            >
              <div className="border-b border-brand-green/8 px-3 py-2">
                <p className="text-sm font-medium text-brand-green truncate">
                  {session.user.name}
                </p>
                <p className="text-xs text-brand-green/40 truncate">
                  {session.user.email}
                </p>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-2 rounded-none px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
              >
                <span className="text-base">🚪</span>
                Cerrar sesión
              </button>
            </motion.div>
          </>
        )}
        </AnimatePresence>
      </div>
    </>
  );
}
