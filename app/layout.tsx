import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koffie — Dial-in Log",
  description:
    "Log je espresso-shots voor de Sage Barista Express en vind je beste instellingen per boon.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf6ef",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen bg-crema-50 font-sans text-espresso-700">
        <header className="sticky top-0 z-10 border-b border-crema-100 bg-crema-50/90 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-base font-semibold text-espresso-700"
            >
              <span aria-hidden>☕</span>
              <span>Koffie</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-full px-3 py-1.5 text-espresso-600 hover:bg-crema-100"
              >
                Dashboard
              </Link>
              <Link
                href="/beans"
                className="rounded-full px-3 py-1.5 text-espresso-600 hover:bg-crema-100"
              >
                Bonen
              </Link>
              <Link
                href="/shots/new"
                className="rounded-full bg-espresso-600 px-3 py-1.5 font-medium text-crema-50 hover:bg-espresso-700"
              >
                + Shot
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-6 pb-24">{children}</main>

        <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-espresso-400">
          Sage Barista Express dial-in log · Lokaal opgeslagen
        </footer>
      </body>
    </html>
  );
}
