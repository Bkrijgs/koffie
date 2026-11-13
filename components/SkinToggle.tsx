"use client";

import { useEffect, useState } from "react";

/** Tijdelijke retro-skin. De key wordt ook gelezen door het inline script in
 *  app/layout.tsx, zodat de skin er al staat vóór de eerste paint. */
export const SKIN_KEY = "koffie:skin";
export const SKIN = "win98";
export const SKIN_EVENT = "koffie:skin-change";

export function isSkinOn(): boolean {
  return document.documentElement.dataset.skin === SKIN;
}

export function setSkin(on: boolean) {
  if (on) document.documentElement.dataset.skin = SKIN;
  else delete document.documentElement.dataset.skin;
  try {
    if (on) window.localStorage.setItem(SKIN_KEY, SKIN);
    else window.localStorage.removeItem(SKIN_KEY);
  } catch {
    // localStorage niet beschikbaar: skin geldt dan alleen deze sessie.
  }
  window.dispatchEvent(new Event(SKIN_EVENT));
}

export function SkinToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isSkinOn());
    sync();
    window.addEventListener(SKIN_EVENT, sync);
    return () => window.removeEventListener(SKIN_EVENT, sync);
  }, []);

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setSkin(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-ink-800"
      />
      <span className="text-ink-700">Windows 98-skin</span>
    </label>
  );
}
