import type { WorkRecord } from "../../types/work-record";
import type { Absence } from "../../types/absence";

export type PdfExportField = "intervals" | "hours" | "quantity" | "extra" | "earnings" | "notes";

export type PdfExportSelection = Record<PdfExportField, boolean>;

export type PdfReportRow = {
  key: string;
  kind: "session" | "absence" | "empty";
  isoDate: string;
  date: string;
  activity: string;
  intervals: string;
  hours: string;
  quantity: string;
  extra: string;
  earnings: string;
  notes: string;
  minutes: number;
  extraMinutes: number;
  amount: number;
  currency: string;
};

export function filterWorkRecordsByEmployment(records: WorkRecord[], employmentId: string | null) {
  return employmentId ? records.filter((record) => record.employmentId === employmentId) : records;
}

type ReportLabels = {
  report: string;
  generated: string;
  workedDays: string;
  absences: string;
  totalHours: string;
  totalExtraHours: string;
  date: string;
  activity: string;
  intervals: string;
  hours: string;
  quantity: string;
  extra: string;
  earnings: string;
  notes: string;
  generatedWith: string;
  mixedCurrencies: string;
};

export function buildPdfReportRows(
  records: WorkRecord[],
  selection: PdfExportSelection,
  locale: string,
  range?: { from: string; to: string; absences?: Absence[] }
) {
  const sessionRows = [...records]
    .sort((left, right) => left.workDate.localeCompare(right.workDate) || left.createdAt.localeCompare(right.createdAt))
    .map((record) => toReportRow(record, selection, locale));

  if (!range) return sessionRows;

  const absenceRows = buildAbsenceRows(range.absences ?? [], selection, locale, range.from, range.to);

  const rowsByDate = new Map<string, PdfReportRow[]>();
  [...sessionRows, ...absenceRows].forEach((row) => {
    rowsByDate.set(row.isoDate, [...(rowsByDate.get(row.isoDate) ?? []), row]);
  });

  return eachIsoDate(range.from, range.to).flatMap((date) =>
    rowsByDate.get(date) ?? [emptyDayRow(date, locale)]
  );
}

export async function generateAlverynPdf({
  rows,
  selection,
  from,
  to,
  locale,
  labels
}: {
  rows: PdfReportRow[];
  selection: PdfExportSelection;
  from: string;
  to: string;
  locale: string;
  labels: ReportLabels;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF canvas is unavailable");

  drawReportCanvas(context, canvas.width, canvas.height, {
    rows,
    selection,
    locale,
    labels
  });

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297, undefined, "FAST");
  downloadPdf(pdf.output("blob"), `alveryn-report-${from}-${to}.pdf`);
}

function toReportRow(
  record: WorkRecord,
  selection: PdfExportSelection,
  locale: string
): PdfReportRow {
  const lines = [...(record.workLines ?? [])].sort((left, right) => left.displayOrder - right.displayOrder);
  const minutes = lines.reduce((total, line) => total + Math.max(Number(line.calculatedMinutes || 0), 0), 0);
  const activityNames = unique(lines.map((line) => line.workTypeName.trim()).filter(Boolean));
  const intervals = unique(lines.flatMap((line) =>
    line.startTime && line.endTime ? [`${line.startTime.slice(0, 5)}–${line.endTime.slice(0, 5)}`] : []
  ));
  const quantities = lines.flatMap((line) => {
    const quantity = Math.max(Number(line.quantity ?? 0), 0);
    if (quantity <= 0) return [];
    return [formatNumber(quantity, locale)];
  });
  const percentages = unique(lines
    .map((line) => Math.max(line.extraPayPercentage ?? 0, 0))
    .filter((percentage) => percentage > 0));
  const earningsByCurrency = new Map<string, number>();
  lines.forEach((line) => {
    const amount = Math.max(Number(line.totalGrossAmount ?? line.grossAmount ?? 0), 0);
    if (amount <= 0) return;
    const currency = line.currencySnapshot || record.currency || "EUR";
    earningsByCurrency.set(currency, (earningsByCurrency.get(currency) ?? 0) + amount);
  });
  const earnings = [...earningsByCurrency.entries()];
  const amount = earnings.reduce((total, [, value]) => total + value, 0);
  const extraMinutes = lines.reduce((total, line) => {
    const snapshot = line.extraPaidEquivalentMinutes;
    return total + (snapshot === undefined
      ? Math.max(Number(line.calculatedMinutes || 0), 0) * Math.max(Number(line.extraPayPercentage || 0), 0) / 100
      : Math.max(Number(snapshot || 0), 0));
  }, 0);
  const currency = earnings.length === 1 ? earnings[0][0] : earnings.length > 1 ? "MIXED" : "";
  const notes = unique([
    record.notes?.trim() ?? "",
    ...lines.map((line) => line.notes?.trim() ?? "")
  ].filter(Boolean));

  return {
    key: record.id,
    kind: "session",
    isoDate: record.workDate,
    date: formatDate(record.workDate, locale),
    activity: activityNames.join(" · "),
    intervals: selection.intervals ? intervals.join(" · ") : "",
    hours: selection.hours && minutes > 0 ? formatDuration(minutes) : "",
    quantity: selection.quantity ? quantities.join(", ") : "",
    extra: selection.extra ? percentages.map((value) => `+${formatNumber(value, locale)}%`).join(" · ") : "",
    earnings: selection.earnings
      ? earnings.map(([code, value]) => formatMoney(value, code, locale)).join(" · ")
      : "",
    notes: selection.notes ? notes.join(" · ") : "",
    minutes,
    extraMinutes,
    amount,
    currency
  };
}

function emptyDayRow(date: string, locale: string): PdfReportRow {
  return {
    key: `empty:${date}`,
    kind: "empty",
    isoDate: date,
    date: formatDate(date, locale),
    activity: "",
    intervals: "",
    hours: "",
    quantity: "",
    extra: "",
    earnings: "",
    notes: "",
    minutes: 0,
    extraMinutes: 0,
    amount: 0,
    currency: ""
  };
}

function buildAbsenceRows(
  absences: Absence[],
  selection: PdfExportSelection,
  locale: string,
  from: string,
  to: string
) {
  return absences.flatMap((absence) => {
    const start = absence.startDate > from ? absence.startDate : from;
    const end = absence.endDate < to ? absence.endDate : to;
    if (start > end) return [];
    return eachIsoDate(start, end).map((date): PdfReportRow => ({
      key: `absence:${absence.id}:${date}`,
      kind: "absence",
      isoDate: date,
      date: formatDate(date, locale),
      activity: absence.absenceTypeName,
      intervals: "",
      hours: "",
      quantity: "",
      extra: "",
      earnings: "",
      notes: selection.notes ? absence.notes?.trim() ?? "" : "",
      minutes: 0,
      extraMinutes: absence.paid ? Math.max(absence.paidMinutesPerDay, 0) : 0,
      amount: 0,
      currency: ""
    }));
  });
}

function drawReportCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  report: {
    rows: PdfReportRow[];
    selection: PdfExportSelection;
    locale: string;
    labels: ReportLabels;
  }
) {
  const { rows, selection, locale, labels } = report;
  context.fillStyle = "#f1f1ed";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#090909";
  context.fillRect(0, 0, width, 142);
  drawSpacedText(context, "ALVERYN", 64, 68, 25, 9, "#ffffff");
  context.fillStyle = "#a5a5a0";
  context.font = "600 15px Inter, Arial, sans-serif";
  context.fillText(labels.report.toUpperCase(), 66, 108);
  context.textAlign = "right";
  context.fillText(`${labels.generated}: ${formatDate(new Date().toISOString().slice(0, 10), locale)}`, width - 64, 68);
  context.textAlign = "left";

  const totalMinutes = rows.reduce((total, row) => total + row.minutes, 0);
  const workedDates = new Set(rows.filter((row) => row.kind === "session" && row.minutes > 0).map((row) => row.isoDate));
  const absenceDates = new Set(rows
    .filter((row) => row.kind === "absence" && !workedDates.has(row.isoDate))
    .map((row) => row.isoDate));
  const totalExtraMinutes = rows.reduce((total, row) =>
    total + (row.kind === "absence" && workedDates.has(row.isoDate) ? 0 : row.extraMinutes), 0);
  const summary = [
    { label: labels.workedDays, value: formatNumber(workedDates.size, locale) },
    { label: labels.absences, value: formatNumber(absenceDates.size, locale) },
    { label: labels.totalHours, value: formatDuration(totalMinutes) },
    { label: labels.totalExtraHours, value: formatDuration(totalExtraMinutes) }
  ];
  const summaryWidth = (width - 128 - (summary.length - 1) * 12) / summary.length;
  summary.forEach((item, index) => {
    const x = 64 + index * (summaryWidth + 12);
    context.fillStyle = index === 0 ? "#ffffff" : "#202020";
    roundRect(context, x, 164, summaryWidth, 88, 18);
    context.fillStyle = index === 0 ? "#6d6d68" : "#999994";
    context.font = "600 14px Inter, Arial, sans-serif";
    context.fillText(item.label.toUpperCase(), x + 20, 196);
    context.fillStyle = index === 0 ? "#090909" : "#ffffff";
    context.font = "700 24px Manrope, Inter, Arial, sans-serif";
    context.fillText(trimToWidth(context, item.value, summaryWidth - 40), x + 20, 231);
  });

  const columns = buildColumns(selection, labels);
  const tableX = 64;
  const tableY = 278;
  const tableWidth = width - 128;
  const footerY = height - 68;
  const availableHeight = footerY - tableY;
  const rowHeight = Math.min(45, availableHeight / Math.max(rows.length + 1, 1));
  const bodyFontSize = Math.max(4.5, Math.min(14, rowHeight * 0.34));
  const headerFontSize = Math.max(5, Math.min(12, rowHeight * 0.3));
  const totalWeight = columns.reduce((total, column) => total + column.weight, 0);
  const widths = columns.map((column) => tableWidth * column.weight / totalWeight);

  context.fillStyle = "#0b0b0b";
  roundRect(context, tableX, tableY, tableWidth, rowHeight, Math.min(14, rowHeight / 2));
  let cursorX = tableX;
  columns.forEach((column, index) => {
    context.fillStyle = "#ffffff";
    context.font = `700 ${headerFontSize}px Inter, Arial, sans-serif`;
    context.fillText(trimToWidth(context, column.label.toUpperCase(), widths[index] - 16), cursorX + 8, tableY + rowHeight * 0.62);
    cursorX += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const y = tableY + rowHeight * (rowIndex + 1);
    context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#e8e8e3";
    context.fillRect(tableX, y, tableWidth, rowHeight);
    cursorX = tableX;
    columns.forEach((column, columnIndex) => {
      context.fillStyle = column.key === "activity" ? "#101010" : "#555550";
      context.font = `${column.key === "activity" ? 650 : 550} ${bodyFontSize}px Inter, Arial, sans-serif`;
      const value = String(row[column.key]);
      context.fillText(trimToWidth(context, value, widths[columnIndex] - 16), cursorX + 8, y + rowHeight * 0.62);
      cursorX += widths[columnIndex];
    });
  });

  context.fillStyle = "#777772";
  context.font = "600 13px Inter, Arial, sans-serif";
  context.fillText(labels.generatedWith, 64, height - 30);
  context.textAlign = "right";
  context.fillText("ALVERYN.COM  •  A4", width - 64, height - 30);
  context.textAlign = "left";
}

function buildColumns(selection: PdfExportSelection, labels: ReportLabels) {
  const columns: Array<{ key: keyof PdfReportRow; label: string; weight: number }> = [
    { key: "date", label: labels.date, weight: 1.3 },
    { key: "activity", label: labels.activity, weight: 1.9 }
  ];
  if (selection.intervals) columns.push({ key: "intervals", label: labels.intervals, weight: 1.05 });
  if (selection.hours) columns.push({ key: "hours", label: labels.hours, weight: 0.8 });
  if (selection.quantity) columns.push({ key: "quantity", label: labels.quantity, weight: 0.95 });
  if (selection.extra) columns.push({ key: "extra", label: labels.extra, weight: 0.65 });
  if (selection.earnings) columns.push({ key: "earnings", label: labels.earnings, weight: 1 });
  if (selection.notes) columns.push({ key: "notes", label: labels.notes, weight: 1.8 });
  return columns;
}

function formatDuration(minutes: number) {
  const rounded = Math.max(Math.round(minutes), 0);
  return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, "0")}m`;
}

function formatDate(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long" })
    .format(new Date(year, month - 1, day));
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${formatNumber(value, locale)} ${currency}`;
  }
}

function trimToWidth(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (!value || context.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && context.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fill();
}

function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.position = "fixed";
  anchor.style.left = "-10000px";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function drawSpacedText(context: CanvasRenderingContext2D, value: string, x: number, y: number, fontSize: number, spacing: number, color: string) {
  context.font = `700 ${fontSize}px Manrope, Inter, Arial, sans-serif`;
  context.fillStyle = color;
  let cursor = x;
  [...value].forEach((character) => {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + spacing;
  });
}

function unique<Value>(values: Value[]) {
  return [...new Set(values)];
}

function eachIsoDate(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
