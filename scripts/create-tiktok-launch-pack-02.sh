#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/studio365/Development/alveryn"
ASSETS="$ROOT/frontend/public/landing"
OUT="$ROOT/marketing/tiktok/launch-pack-02"
TMP="$OUT/.frames"
FONT="/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Bold.otf"
GREEN="#34d399"

mkdir -p "$TMP" "$OUT"

scene() {
  local output="$1" title="$2" subtitle="$3" image="$4"
  magick -size 1080x1920 xc:'#050706' \
    -fill '#f8faf9' -font "$FONT" -pointsize 76 -gravity north \
    -interline-spacing 5 -annotate +0+125 "$title" \
    -fill '#a9b1ad' -pointsize 34 -annotate +0+350 "$subtitle" \
    \( "$image" -resize '930x1120>' -bordercolor '#26312c' -border 3 \
       -background '#0a0d0b' -gravity center -extent 960x1180 \
       -alpha set \) \
    -gravity south -geometry +0+155 -composite \
    -fill "$GREEN" -pointsize 29 -gravity south \
    -annotate +0+63 'ALVERYN.COM  •  ÎNCEPE GRATUIT' \
    "$output"
}

calculation_scene() {
  local output="$1" title="$2" calculation="$3" subtitle="$4"
  magick -size 1080x1920 xc:'#050706' \
    -fill '#f8faf9' -font "$FONT" -pointsize 76 -gravity north \
    -interline-spacing 5 -annotate +0+125 "$title" \
    -fill "$GREEN" -pointsize 88 -gravity center -interline-spacing 18 \
    -annotate +0-35 "$calculation" \
    -fill '#a9b1ad' -pointsize 34 -gravity south \
    -annotate +0+205 "$subtitle" \
    -fill "$GREEN" -pointsize 29 -annotate +0+63 \
    'ALVERYN.COM  •  ÎNCEPE GRATUIT' \
    "$output"
}

render_scene() {
  local image="$1" output="$2" duration="$3"
  local frames
  frames=$(awk -v duration="$duration" 'BEGIN { print int(duration * 30) }')
  ffmpeg -hide_banner -loglevel error -y -loop 1 -i "$image" \
    -vf "zoompan=z='min(zoom+0.0007,1.045)':d=$frames:s=1080x1920:fps=30,fade=t=in:st=0:d=0.16,fade=t=out:st=$(awk -v duration="$duration" 'BEGIN { print duration - 0.18 }'):d=0.18,format=yuv420p" \
    -t "$duration" -an -c:v libopenh264 -b:v 6M "$output"
}

render_video() {
  local name="$1"; shift
  local images=("$@") clips=() list="$TMP/$name-list.txt" index=0
  : > "$list"
  for image in "${images[@]}"; do
    local clip="$TMP/$name-$index.mp4"
    render_scene "$image" "$clip" 2.35
    clips+=("$clip")
    printf "file '%s'\n" "$clip" >> "$list"
    index=$((index + 1))
  done
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$list" \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart \
    "$OUT/$name.mp4"
}

# 1. The core promise: work -> rate -> estimated earnings.
scene "$TMP/earned-1.png" $'AI TERMINAT\nMUNCA.' 'Dar știi cât ai câștigat astăzi?' "$ASSETS/dashboard/day-dark.jpg"
calculation_scene "$TMP/earned-2.png" 'O TURĂ' $'6h 30m × €17,50\n=\n€113,75' 'Alveryn aplică tariful pentru tine.'
scene "$TMP/earned-3.png" $'ORELE ȘI BANII.\nÎMPREUNĂ.' 'O evidență clară pentru fiecare zi.' "$ASSETS/dashboard/activity-dark.jpg"
scene "$TMP/earned-4.png" $'NU MAI CALCULA\nDIN MEMORIE.' 'Înregistrează prima zi în Alveryn.' "$ASSETS/calendar/month-dark.jpg"
render_video "01-stii-cat-ai-castigat" "$TMP/earned-1.png" "$TMP/earned-2.png" "$TMP/earned-3.png" "$TMP/earned-4.png"

# 2. Unit-based work.
calculation_scene "$TMP/unit-1.png" 'PLĂTIT PE LIVRARE?' $'24 livrări × €1,80\n=\n€43,20' 'Cantitate × tarif. Fără calcule separate.'
scene "$TMP/unit-2.png" $'ADAUGI CE\nAI TERMINAT' 'Livrări, camere, piese sau kilometri.' "$ASSETS/dashboard/activity-dark.jpg"
scene "$TMP/unit-3.png" $'VEZI REZULTATUL\nIMEDIAT' 'Alveryn păstrează ziua și venitul estimat.' "$ASSETS/dashboard/day-dark.jpg"
scene "$TMP/unit-4.png" $'MUNCA TA NU E\nDOAR UN TIMER.' 'Încearcă gratuit pe alveryn.com.' "$ASSETS/dashboard/flow-dark.jpg"
render_video "02-platit-pe-livrare" "$TMP/unit-1.png" "$TMP/unit-2.png" "$TMP/unit-3.png" "$TMP/unit-4.png"

# 3. Multiple jobs in one record.
calculation_scene "$TMP/jobs-1.png" 'DOUĂ JOBURI?' $'Dimineața: curățenie\nSeara: livrări' 'Nu ai nevoie de două tabele.'
scene "$TMP/jobs-2.png" $'FIECARE JOB CU\nTARIFUL LUI' 'Ore, unități și activități diferite.' "$ASSETS/dashboard/activity-dark.jpg"
scene "$TMP/jobs-3.png" $'O SINGURĂ\nEVIDENȚĂ' 'Totaluri separate și imaginea completă.' "$ASSETS/statistics-tour/kpis-dark.jpg"
scene "$TMP/jobs-4.png" $'TOATĂ MUNCA TA.\nUN SINGUR LOC.' 'Creează gratuit primul job.' "$ASSETS/calendar/summary-dark.jpg"
render_video "03-doua-joburi" "$TMP/jobs-1.png" "$TMP/jobs-2.png" "$TMP/jobs-3.png" "$TMP/jobs-4.png"

# 4. End-of-month pain.
calculation_scene "$TMP/month-1.png" 'SFÂRȘIT DE LUNĂ?' $'Notițe + mesaje\n+ poze + Excel?' 'Nu reconstrui totul în ultima zi.'
scene "$TMP/month-2.png" $'ÎNREGISTREZI\nCÂND TERMINI' 'Orele și activitățile rămân în ziua corectă.' "$ASSETS/dashboard/flow-dark.jpg"
scene "$TMP/month-3.png" $'LUNA ESTE DEJA\nORGANIZATĂ' 'Muncă, absențe, ore și venit estimat.' "$ASSETS/calendar/month-dark.jpg"
scene "$TMP/month-4.png" $'STOP CALCULELOR\nDIN MEMORIE.' 'Începe gratuit pe alveryn.com.' "$ASSETS/statistics-tour/trend-dark.jpg"
render_video "04-nu-recalcula-luna" "$TMP/month-1.png" "$TMP/month-2.png" "$TMP/month-3.png" "$TMP/month-4.png"

# 5. Independent record and payslip comparison.
scene "$TMP/pay-1.png" $'FLUTURAȘUL A VENIT.\nÎL POȚI VERIFICA?' 'Compară documentul cu propria evidență.' "$ASSETS/calendar/payroll-dark.jpg"
calculation_scene "$TMP/pay-2.png" 'DOUĂ VALORI' $'Evidența ta\nvs.\ndocumentul primit' 'Orele și brutul, puse alături.'
scene "$TMP/pay-3.png" $'DIFERENȚELE DEVIN\nMAI UȘOR DE VĂZUT' 'Tu păstrezi controlul asupra evidenței.' "$ASSETS/statistics-tour/compare-dark.jpg"
scene "$TMP/pay-4.png" $'PĂSTREAZĂ-ȚI\nPROPRIA EVIDENȚĂ.' 'Alveryn nu înlocuiește consultanța profesională.' "$ASSETS/calendar/summary-dark.jpg"
render_video "05-evidenta-vs-fluturas" "$TMP/pay-1.png" "$TMP/pay-2.png" "$TMP/pay-3.png" "$TMP/pay-4.png"

rm -rf "$TMP"
printf 'Created five videos in %s\n' "$OUT"
