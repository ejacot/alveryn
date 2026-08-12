#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "/tmp/alveryn-payroll-fixtures");
const countPerCountry = Number(process.argv[3] ?? 100);
const profiles = {
  DE: { language: "deu", currency: "EUR", title: "Abrechnung der Brutto-Netto-Bezüge",
    period: "Abrechnungsmonat", headers: ["Lohnart", "Bezeichnung", "bezahlte Menge", "Faktor", "Betrag"],
    regular: "Lohn", night: "Nachtzuschlag 30%", weekend: "Sonntagszuschlag 50%", gross: "Gesamtbrutto" },
  RO: { language: "ron", currency: "RON", title: "Fluturaș de salariu",
    period: "Perioada", headers: ["Cod", "Denumire", "Ore", "Tarif", "Valoare"],
    regular: "Salariu de bază — ore lucrate", night: "Spor de noapte 25%", weekend: "Spor weekend 15%", gross: "Total brut" },
  GB: { language: "eng", currency: "GBP", title: "Employee payslip",
    period: "Pay period", headers: ["Code", "Description", "Hours", "Rate", "Amount"],
    regular: "Regular pay", night: "Night premium 30%", weekend: "Sunday overtime 50%", gross: "Gross pay" },
  FR: { language: "fra", currency: "EUR", title: "Bulletin de paie",
    period: "Période", headers: ["Code", "Libellé", "Heures", "Taux", "Montant"],
    regular: "Salaire de base", night: "Majoration nuit 30%", weekend: "Majoration dimanche 50%", gross: "Salaire brut" }
};
const variants = ["clean", "rotated", "dim", "fragment"];
const money = (value) => value.toFixed(2);
const escapeXml = (value) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"})[c]);

await mkdir(output, { recursive: true });
const manifest = [];
for (const [country, profile] of Object.entries(profiles)) {
  for (let index = 0; index < countPerCountry; index++) {
    const hours = 140 + (index % 61) + ((index % 4) * 0.25);
    const rate = country === "RO" ? 30 + index % 17 : 14 + (index % 14) * 0.5;
    const nightHours = index % 13;
    const weekendHours = (index * 3) % 19;
    const regularAmount = hours * rate;
    const nightAmount = nightHours * rate * 0.30;
    const weekendAmount = weekendHours * rate * 0.50;
    const gross = regularAmount + nightAmount + weekendAmount;
    const month = (index % 12) + 1;
    const rows = [
      ["100", profile.regular, hours, rate, regularAmount],
      ["310", profile.night, nightHours, rate * 0.30, nightAmount],
      ["350", profile.weekend, weekendHours, rate * 0.50, weekendAmount]
    ].filter(row => row[2] > 0 || row[0] === "100");
    for (const variant of variants) {
      const id = `${country.toLowerCase()}-${String(index + 1).padStart(3, "0")}-${variant}`;
      const crop = variant === "fragment";
      const width = 1400, height = crop ? 620 : 1050;
      const rowSvg = rows.map((row, rowIndex) => {
        const y = 520 + rowIndex * 105;
        return `<text x="90" y="${y}">${row.map(escapeXml).join("     ")}</text>`;
      }).join("\n");
      const viewBox = crop ? `0 330 ${width} ${height}` : `0 0 ${width} ${height}`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">
        <rect x="0" y="0" width="${width}" height="1050" fill="#fff"/><g font-family="DejaVu Sans, sans-serif" fill="#111">
        <text x="80" y="110" font-size="42" font-weight="700">${escapeXml(profile.title)}</text>
        <text x="980" y="110" font-size="30">${escapeXml(profile.period)} ${String(month).padStart(2,"0")}/2026</text>
        <text x="80" y="220" font-size="24">Synthetic Example Ltd · TEST DOCUMENT · ${country}</text>
        <rect x="70" y="360" width="1260" height="430" fill="none" stroke="#333" stroke-width="2"/>
        <text x="90" y="420" font-size="24" font-weight="700">${profile.headers.map(escapeXml).join("     ")}</text>
        <g font-size="28">${rowSvg}</g>
        <text x="760" y="880" font-size="32" font-weight="700">${escapeXml(profile.gross)}: ${money(gross)} ${profile.currency}</text>
        </g></svg>`;
      const svgPath = join(output, `${id}.svg`);
      const imagePath = join(output, `${id}.jpg`);
      await writeFile(svgPath, svg);
      const args = [svgPath];
      if (variant === "rotated") args.push("-rotate", "1.8");
      if (variant === "dim") args.push("-brightness-contrast", "-18x8", "-blur", "0x0.7");
      args.push("-quality", "88", imagePath);
      const converted = spawnSync("magick", args, { encoding: "utf8" });
      if (converted.status !== 0) throw new Error(converted.stderr || "ImageMagick failed");
      manifest.push({ id, file: `${id}.jpg`, synthetic: true, country,
        language: profile.language, currency: profile.currency,
        completeness: crop ? "FRAGMENT" : "FULL_PAGE", year: 2026,
        month: crop ? null : month, normalHours: hours, normalRate: rate,
        normalAmount: Number(money(regularAmount)), extraHours: nightHours + weekendHours,
        extraAmount: Number(money(nightAmount + weekendAmount)), grossAmount: Number(money(gross)), rows });
    }
  }
}
await writeFile(join(output, "manifest.json"), JSON.stringify({ version: 1, fixtures: manifest }, null, 2));
process.stdout.write(`Generated ${manifest.length} synthetic payroll fixtures in ${output}\n`);
