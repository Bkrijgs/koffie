import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CompassPopup } from "@/components/CompassPopup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koffie",
  description: "Espresso dial-in log voor de Sage Barista Express.",
  manifest: "/manifest.json",
};

// Oud-WebKit-veilig (geen const/let/arrow/URLSearchParams): zet de e-ink modus
// aan zodra de Kobo de app met ?eink=1 opent en onthoudt dat in localStorage,
// zodat de bookmark op het apparaat in e-ink modus blijft. ?eink=0 zet hem uit.
// Draait vóór paint, dus geen flits; raakt alleen documentElement.className.
const einkInitScript = `(function(){try{var s=window.location.search||"";var m=s.match(/[?&]eink=([^&]*)/);var v=m?m[1]:null;if(v==="1"){try{localStorage.setItem("eink","1");}catch(e){}}else if(v==="0"){try{localStorage.removeItem("eink");}catch(e){}}var on=v==="1";if(!on){try{on=localStorage.getItem("eink")==="1";}catch(e){}}if(on){var d=document.documentElement;d.className=d.className?d.className+" eink":"eink";}}catch(e){}try{if(window.sessionStorage&&sessionStorage.getItem("koffie:boot")==="1"){var b=document.documentElement;b.className=b.className?b.className+" boot-seen":"boot-seen";}}catch(e){}})();`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f6fb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: einkInitScript }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink-700 antialiased">
        <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/85 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-5">
            <nav className="flex items-center justify-between text-sm">
              <NavLink href="/" aria-label="Dashboard">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 9.5 12 3l9 6.5" />
                  <path d="M5 8.5V21h5v-6h4v6h5V8.5" />
                </svg>
              </NavLink>
              <NavLink href="/shots">Shots</NavLink>
              <NavLink href="/beans">Bonen</NavLink>
              <NavLink href="/kosten">Kosten</NavLink>
              <NavLink href="/instellingen" aria-label="Instellingen">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </NavLink>
              <Link
                href="/shots/new"
                className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-sm font-medium text-paper transition hover:bg-ink-700 sm:px-3"
              >
                Nieuw
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-5 py-8 pb-24">{children}</main>

        <CompassPopup />

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
  "aria-label": ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="flex items-center rounded-lg px-2 py-1.5 text-ink-500 transition hover:bg-ink-50/60 hover:text-ink-800 sm:px-3"
    >
      {children}
    </Link>
  );
}
