"use client";

import { useEffect, useState } from "react";

/** Tijdelijke retro-skin. De key wordt ook gelezen door het inline script in
 *  app/layout.tsx, zodat de skin er al staat vóór de eerste paint. */
export const SKIN_KEY = "koffie:skin";
const SKIN = "win98";

export function SkinToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(document.documentElement.dataset.skin === SKIN);
  }, []);

  function toggle(next: boolean) {
    setOn(next);
    try {
      if (next) {
        document.documentElement.dataset.skin = SKIN;
        window.localStorage.setItem(SKIN_KEY, SKIN);
      } else {
        delete document.documentElement.dataset.skin;
        window.localStorage.removeItem(SKIN_KEY);
      }
    } catch {
      // localStorage niet beschikbaar: skin geldt dan alleen deze sessie.
    }
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => toggle(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-ink-800"
      />
      <span className="text-ink-700">Windows 98-skin</span>
    </label>
  );
}
