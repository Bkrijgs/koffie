#!/usr/bin/env bash
# Re-encode the barista mood clips for the web:
#   - light spatial+temporal denoise (hqdn3d) to kill diffusion grain
#   - lanczos downscale to a max of 1024 on the wider side
#   - libx264 CRF 18 (visually lossless) with web-friendly flags
#   - audio stripped (clips are silent anyway)
#
# Usage: ./scripts/process-barista-clips.sh
# Requires ffmpeg on PATH.

set -euo pipefail

PUBLIC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg is required (apt-get install ffmpeg / brew install ffmpeg)" >&2
  exit 1
fi

cd "$PUBLIC_DIR"
shopt -s nullglob
clips=(wave.mp4 happy.mp4 content.mp4 think.mp4 concerned.mp4 \
       celebrate.mp4 shrug.mp4 pour.mp4 taste.mp4)

for f in "${clips[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "skip $f (not present)"
    continue
  fi
  echo "processing $f"
  ffmpeg -y -loglevel error -i "$f" \
    -vf "hqdn3d=1.5:1.5:4:4,scale='min(1024,iw)':-2:flags=lanczos" \
    -c:v libx264 -crf 18 -preset medium \
    -pix_fmt yuv420p -movflags +faststart \
    -an \
    "$OUT_DIR/$f"
  mv "$OUT_DIR/$f" "$f"
done

echo "done. processed clips written to $PUBLIC_DIR"
