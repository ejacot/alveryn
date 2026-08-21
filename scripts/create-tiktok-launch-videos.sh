#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/studio365/Development/alveryn"
ASSETS="$ROOT/frontend/src/assets/landing"
OUT="$ROOT/marketing/tiktok/launch-pack-01"
TMP="$OUT/.frames"
FONT="/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Bold.otf"

mkdir -p "$TMP" "$OUT"

make_frame() {
  local output="$1" title="$2" subtitle="$3" image="$4" crop_y="${5:-0}"
  magick -size 1080x1920 xc:'#050505' \
    -fill '#f7f7f7' -font "$FONT" -pointsize 78 -gravity north \
    -interline-spacing 8 -annotate +0+110 "$title" \
    -fill '#b6b6b6' -font "$FONT" -pointsize 36 \
    -annotate +0+335 "$subtitle" \
    \( "$image" -crop "100%x1400+0+$crop_y" +repage -resize '900x1360>' \
       -bordercolor '#222222' -border 2 -alpha set \
       -background none -gravity center \) \
    -gravity south -geometry +0+95 -composite \
    -fill '#34d399' -font "$FONT" -pointsize 31 -gravity south \
    -annotate +0+38 'ALVERYN.COM  •  GRATUIT' \
    "$output"
}

render_video() {
  local name="$1"; shift
  local frames=("$@")
  local list="$TMP/$name-list.txt"
  : > "$list"
  for frame in "${frames[@]}"; do
    printf "file '%s'\nduration 4.5\n" "$frame" >> "$list"
  done
  printf "file '%s'\n" "${frames[-1]}" >> "$list"
  ffmpeg -hide_banner -loglevel error -y \
    -f concat -safe 0 -i "$list" \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -vf "fps=30,format=yuv420p" -c:v libopenh264 -b:v 5M \
    -c:a aac -b:a 128k -shortest -movflags +faststart \
    "$OUT/$name.mp4"
}

# Video 1: payslip / earnings pain
make_frame "$TMP/pay-1.png" $'AI FOST PLĂTIT\nCORECT?' 'Nu ghici. Compară ce ai muncit.' "$ASSETS/dashboard-mobile.webp" 0
make_frame "$TMP/pay-2.png" $'ORE + MUNCĂ\nLA BUCATĂ' 'Totul calculat în aceeași zi.' "$ASSETS/dashboard-mobile.webp" 250
make_frame "$TMP/pay-3.png" $'ȘTII CÂT AI\nDE PRIMIT' 'Ore, activități și câștig brut.' "$ASSETS/statistics-overview.webp" 0
make_frame "$TMP/pay-4.png" $'ÎNCEARCĂ\nALVERYN' 'Înregistrează prima zi de muncă.' "$ASSETS/calendar-desktop.webp" 0
render_video "01-ai-fost-platit-corect" "$TMP/pay-1.png" "$TMP/pay-2.png" "$TMP/pay-3.png" "$TMP/pay-4.png"

# Video 2: end-of-month reconstruction
make_frame "$TMP/month-1.png" $'IAR RECALCULEZI\nTOATĂ LUNA?' 'Notițe. Mesaje. Poze. Excel.' "$ASSETS/calendar-desktop.webp" 0
make_frame "$TMP/month-2.png" $'ÎNREGISTREZI\nO SINGURĂ DATĂ' 'Adaugi ziua când termini munca.' "$ASSETS/entry-form.webp" 0
make_frame "$TMP/month-3.png" $'LUNA ESTE DEJA\nPREGĂTITĂ' 'Ore, bani, concediu și absențe.' "$ASSETS/statistics-overview.webp" 500
make_frame "$TMP/month-4.png" $'MAI PUȚINE\nSURPRIZE' 'Începe gratuit pe alveryn.com.' "$ASSETS/dashboard-desktop.webp" 0
render_video "02-nu-mai-recalcula-luna" "$TMP/month-1.png" "$TMP/month-2.png" "$TMP/month-3.png" "$TMP/month-4.png"

# Video 3: mixed compensation
make_frame "$TMP/mixed-1.png" $'PLĂTIT LA ORĂ\nȘI LA BUCATĂ?' 'Un timer simplu nu este suficient.' "$ASSETS/dashboard-mobile.webp" 100
make_frame "$TMP/mixed-2.png" $'TURA TA' 'Orele și tariful rămân clare.' "$ASSETS/entry-form.webp" 250
make_frame "$TMP/mixed-3.png" $'24 LIVRĂRI' 'Cantitate × tarif = rezultat.' "$ASSETS/dashboard-mobile.webp" 150
make_frame "$TMP/mixed-4.png" $'O ZI. TOATĂ\nMUNCA TA.' 'Încearcă Alveryn gratuit.' "$ASSETS/dashboard-mobile.webp" 700
render_video "03-ora-si-bucata" "$TMP/mixed-1.png" "$TMP/mixed-2.png" "$TMP/mixed-3.png" "$TMP/mixed-4.png"

rm -rf "$TMP"
printf 'Created videos in %s\n' "$OUT"
