import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koffie",
  description: "Espresso dial-in log voor de Sage Barista Express.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-paper font-sans text-ink-700 antialiased">
        <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <Link
              href="/"
              className="font-display text-xl tracking-tightish text-ink-800"
            >
              koffie
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Shots</NavLink>
              <NavLink href="/beans">Bonen</NavLink>
              <Link
                href="/shots/new"
                className="ml-2 rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-medium text-paper transition hover:bg-ink-700"
              >
                Nieuw
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-8 pb-24">{children}</main>

        <footer className="mx-auto max-w-3xl px-5 py-10 text-center text-[11px] uppercase tracking-[0.18em] text-ink-300">
          {isSupabaseConfigured ? "Opgeslagen in Supabase" : "Lokaal opgeslagen"}
        </footer>
      </body>
    </html>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-ink-500 transition hover:bg-ink-50/60 hover:text-ink-800"
    >
      {children}
    </Link>
  );
}
