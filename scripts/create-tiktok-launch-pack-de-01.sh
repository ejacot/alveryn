#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/studio365/Development/alveryn"
ASSETS="$ROOT/frontend/public/landing"
OUT="$ROOT/marketing/tiktok/launch-pack-de-01"
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
       -background '#0a0d0b' -gravity center -extent 960x1180 -alpha set \) \
    -gravity south -geometry +0+155 -composite \
    -fill "$GREEN" -pointsize 29 -gravity south \
    -annotate +0+63 'ALVERYN.COM  •  KOSTENLOS STARTEN' \
    "$output"
}

calculation_scene() {
  local output="$1" title="$2" calculation="$3" subtitle="$4"
  magick -size 1080x1920 xc:'#050706' \
    -fill '#f8faf9' -font "$FONT" -pointsize 76 -gravity north \
    -interline-spacing 5 -annotate +0+125 "$title" \
    -fill "$GREEN" -pointsize 84 -gravity center -interline-spacing 18 \
    -annotate +0-35 "$calculation" \
    -fill '#a9b1ad' -pointsize 34 -gravity south \
    -annotate +0+205 "$subtitle" \
    -fill "$GREEN" -pointsize 29 -annotate +0+63 \
    'ALVERYN.COM  •  KOSTENLOS STARTEN' \
    "$output"
}

render_scene() {
  local image="$1" output="$2" duration="$3" frames
  frames=$(awk -v duration="$duration" 'BEGIN { print int(duration * 30) }')
  ffmpeg -hide_banner -loglevel error -y -loop 1 -i "$image" \
    -vf "zoompan=z='min(zoom+0.0007,1.045)':d=$frames:s=1080x1920:fps=30,fade=t=in:st=0:d=0.16,fade=t=out:st=$(awk -v duration="$duration" 'BEGIN { print duration - 0.18 }'):d=0.18,format=yuv420p" \
    -t "$duration" -an -c:v libopenh264 -b:v 6M "$output"
}

render_video() {
  local name="$1"; shift
  local images=("$@") list="$TMP/$name-list.txt" index=0
  : > "$list"
  for image in "${images[@]}"; do
    local clip="$TMP/$name-$index.mp4"
    render_scene "$image" "$clip" 2.35
    printf "file '%s'\n" "$clip" >> "$list"
    index=$((index + 1))
  done
  ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "$list" \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart \
    "$OUT/$name.mp4"
}

# 1. Core promise.
scene "$TMP/earned-1.png" $'FEIERABEND.' 'Aber weißt du, was du heute verdient hast?' "$ASSETS/dashboard/day-dark.jpg"
calculation_scene "$TMP/earned-2.png" 'EINE SCHICHT' $'6 Std. 30 Min. × 17,50 €\n=\n113,75 €' 'Alveryn rechnet mit deinem Stundensatz.'
scene "$TMP/earned-3.png" $'ARBEITSZEIT UND\nVERDIENST.' 'Übersichtlich für jeden Arbeitstag.' "$ASSETS/dashboard/activity-dark.jpg"
scene "$TMP/earned-4.png" $'NICHT MEHR AUS DEM\nKOPF RECHNEN.' 'Erfasse deinen ersten Arbeitstag.' "$ASSETS/calendar/month-dark.jpg"
render_video "01-weiss-du-was-du-verdient-hast" "$TMP/earned-1.png" "$TMP/earned-2.png" "$TMP/earned-3.png" "$TMP/earned-4.png"

# 2. Unit-based work.
calculation_scene "$TMP/unit-1.png" $'PRO LIEFERUNG\nBEZAHLT?' $'24 Lieferungen × 1,80 €\n=\n43,20 €' 'Menge × Satz. Ohne extra Tabelle.'
scene "$TMP/unit-2.png" $'ERFASSE, WAS DU\nERLEDIGT HAST.' 'Lieferungen, Zimmer, Teile oder Kilometer.' "$ASSETS/dashboard/activity-dark.jpg"
scene "$TMP/unit-3.png" $'ERGEBNIS SOFORT\nSEHEN.' 'Dein Tag und der geschätzte Verdienst.' "$ASSETS/dashboard/day-dark.jpg"
scene "$TMP/unit-4.png" $'DEINE ARBEIT IST\nMEHR ALS EIN TIMER.' 'Teste Alveryn kostenlos.' "$ASSETS/dashboard/flow-dark.jpg"
render_video "02-pro-lieferung-bezahlt" "$TMP/unit-1.png" "$TMP/unit-2.png" "$TMP/unit-3.png" "$TMP/unit-4.png"

# 3. Multiple jobs.
calculation_scene "$TMP/jobs-1.png" 'ZWEI JOBS?' $'Morgens: Reinigung\nAbends: Lieferungen' 'Du brauchst keine zwei Tabellen.'
scene "$TMP/jobs-2.png" $'JEDER JOB MIT\nEIGENEM SATZ.' 'Andere Zeiten, Tätigkeiten und Regeln.' "$ASSETS/dashboard/activity-dark.jpg"
scene "$TMP/jobs-3.png" $'EINE KLARE\nÜBERSICHT.' 'Getrennte Summen und das Gesamtbild.' "$ASSETS/statistics-tour/kpis-dark.jpg"
scene "$TMP/jobs-4.png" $'DEINE ARBEIT.\nAN EINEM ORT.' 'Lege deinen ersten Job kostenlos an.' "$ASSETS/calendar/summary-dark.jpg"
render_video "03-zwei-jobs-eine-uebersicht" "$TMP/jobs-1.png" "$TMP/jobs-2.png" "$TMP/jobs-3.png" "$TMP/jobs-4.png"

# 4. End-of-month pain.
calculation_scene "$TMP/month-1.png" 'MONATSENDE?' $'Notizen + Chats\n+ Fotos + Excel?' 'Baue den Monat nicht nachträglich zusammen.'
scene "$TMP/month-2.png" $'DIREKT NACH DER\nARBEIT ERFASSEN.' 'Zeit und Tätigkeiten bleiben beim richtigen Tag.' "$ASSETS/dashboard/flow-dark.jpg"
scene "$TMP/month-3.png" $'DER MONAT IST\nSCHON GEORDNET.' 'Arbeit, Abwesenheiten und Verdienst.' "$ASSETS/calendar/month-dark.jpg"
scene "$TMP/month-4.png" $'SCHLUSS MIT RECHNEN\nAUS DER ERINNERUNG.' 'Kostenlos starten auf alveryn.com.' "$ASSETS/statistics-tour/trend-dark.jpg"
render_video "04-monat-nicht-neu-berechnen" "$TMP/month-1.png" "$TMP/month-2.png" "$TMP/month-3.png" "$TMP/month-4.png"

# 5. Payslip comparison.
scene "$TMP/pay-1.png" $'LOHNABRECHNUNG DA.\nKANNST DU SIE PRÜFEN?' 'Vergleiche sie mit deiner eigenen Aufzeichnung.' "$ASSETS/calendar/payroll-dark.jpg"
calculation_scene "$TMP/pay-2.png" 'ZWEI WERTE' $'Deine Aufzeichnung\nvs.\nLohnabrechnung' 'Stunden und Brutto direkt nebeneinander.'
scene "$TMP/pay-3.png" $'UNTERSCHIEDE\nSCHNELLER ERKENNEN.' 'Du behältst die Kontrolle über deine Daten.' "$ASSETS/statistics-tour/compare-dark.jpg"
scene "$TMP/pay-4.png" $'DEINE EIGENE\nARBEITSAUFZEICHNUNG.' 'Alveryn ersetzt keine professionelle Beratung.' "$ASSETS/calendar/summary-dark.jpg"
render_video "05-aufzeichnung-vs-lohnabrechnung" "$TMP/pay-1.png" "$TMP/pay-2.png" "$TMP/pay-3.png" "$TMP/pay-4.png"

rm -rf "$TMP"
printf 'Created five German videos in %s\n' "$OUT"
