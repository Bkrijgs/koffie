#!/usr/bin/env python3
"""Zet de Espresso Compass-poster om naar één webklare WebP.

De bron is de poster van BaristaHustle: één PDF-pagina met een JPEG van
3276x5010 (~3 MB). Onbewerkt te zwaar om op een telefoon in te laden.

    pip install pillow pymupdf        # pymupdf alleen voor .pdf-invoer
    python3 scripts/make-kompas-asset.py ~/Downloads/EspressoCompass.pdf

Levert public/kompas/espresso-compass.webp op 2048 px breed. Die maat is
gekozen op het inzoomen: bij 2,5x op een 390pt-scherm kijk je naar ~975
CSS-pixels, dus daar is 2048 px bron ruim genoeg voor, en passend-in-beeld
schaalt netjes terug. Eén bestand, geen srcset nodig.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "kompas" / "espresso-compass.webp"

WIDTH = 2048
QUALITY = 80


def load(path: Path) -> Image.Image:
    if path.suffix.lower() == ".pdf":
        import pymupdf

        page = pymupdf.open(path)[0]
        # Iets boven de doelbreedte renderen, dan terugschalen: scherper dan
        # precies op maat renderen.
        scale = (WIDTH * 1.3) / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale))
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return Image.open(path).convert("RGB")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1

    src = Path(sys.argv[1]).expanduser()
    if not src.exists():
        print(f"Bron niet gevonden: {src}")
        return 1

    img = load(src)
    print(f"bron: {src.name} ({img.width}x{img.height})")

    height = round(img.height * WIDTH / img.width)
    img = img.resize((WIDTH, height), Image.LANCZOS)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=QUALITY, method=6)
    print(f"{OUT.relative_to(ROOT)}  {img.width}x{img.height}  "
          f"{OUT.stat().st_size / 1024:.0f} kB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
