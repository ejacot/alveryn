import type { WorkRecord } from "../../types/work-record";
import type { Absence } from "../../types/absence";
import type { EmploymentRestDay } from "../../types/rest-day";

export type PdfExportField = "intervals" | "hours" | "quantity" | "extra" | "earnings" | "notes";

export type PdfExportSelection = Record<PdfExportField, boolean>;

export type PdfReportRow = {
  key: string;
  kind: "session" | "absence" | "rest" | "empty";
  isoDate: string;
  date: string;
  activity: string;
  status: string;
  intervals: string;
  hours: string;
  quantity: string;
  workDetails: string;
  extra: string;
  earnings: string;
  notes: string;
  minutes: number;
  extraMinutes: number;
  amount: number;
  currency: string;
  workTypeCells: PdfWorkTypeCell[];
};

export type PdfWorkTypeCell = {
  workTypeId: string;
  workTypeName: string;
  categoryName: string | null;
  value: string;
};
export type PdfWorkTypeColumn = { id: string; name: string; categoryName: string | null };

export function getPdfWorkTypeColumns(rows: PdfReportRow[]): PdfWorkTypeColumn[] {
  const columns = new Map<string, PdfWorkTypeColumn>();
  rows.forEach((row) => row.workTypeCells.forEach((cell) => {
    if (!columns.has(cell.workTypeId)) columns.set(cell.workTypeId, {
      id: cell.workTypeId,
      name: cell.workTypeName,
      categoryName: cell.categoryName
    });
  }));
  const categoryOrder = unique([...columns.values()].map((column) => column.categoryName ?? column.id));
  return [...columns.values()].sort((left, right) => {
    const leftGroup = categoryOrder.indexOf(left.categoryName ?? left.id);
    const rightGroup = categoryOrder.indexOf(right.categoryName ?? right.id);
    return leftGroup - rightGroup;
  });
}

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
  totalEarnings: string;
  date: string;
  activity: string;
  status: string;
  intervals: string;
  hours: string;
  quantity: string;
  workDetails: string;
  extra: string;
  earnings: string;
  notes: string;
  generatedWith: string;
  mixedCurrencies: string;
  restDay: string;
  noActivity: string;
  page: string;
};

export function buildPdfReportRows(
  records: WorkRecord[],
  selection: PdfExportSelection,
  locale: string,
  range?: { from: string; to: string; absences?: Absence[]; restDays?: EmploymentRestDay[] }
) {
  const sessionRows = [...records]
    .sort((left, right) => left.workDate.localeCompare(right.workDate)
      || (left.createdAt ?? "").localeCompare(right.createdAt ?? ""))
    .map((record) => toReportRow(record, selection, locale));

  if (!range) return sessionRows;

  const absenceRows = buildAbsenceRows(range.absences ?? [], selection, locale, range.from, range.to);
  const restRows = buildRestDayRows(range.restDays ?? [], selection, locale, range.from, range.to);

  const rowsByDate = new Map<string, PdfReportRow[]>();
  [...sessionRows, ...absenceRows, ...restRows].forEach((row) => {
    rowsByDate.set(row.isoDate, [...(rowsByDate.get(row.isoDate) ?? []), row]);
  });

  return eachIsoDate(range.from, range.to).map((date) => {
    const dayRows = rowsByDate.get(date);
    return dayRows ? mergeDayRows(date, dayRows, locale, selection) : emptyDayRow(date, locale);
  });
}

export async function generateAlverynPdf({
  rows,
  selection,
  from,
  to,
  locale,
  labels,
  userName,
  employmentName
}: {
  rows: PdfReportRow[];
  selection: PdfExportSelection;
  from: string;
  to: string;
  locale: string;
  labels: ReportLabels;
  userName: string;
  employmentName: string;
}) {
  const { jsPDF } = await import("jspdf");
  const orientation = "portrait";
  const pages: PdfReportRow[][] = chunk(rows, 31);
  const logo = await loadImage("/brand/alveryn-mark.png").catch(() => null);
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  for (let index = 0; index < pages.length; index += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF canvas is unavailable");
    drawReportCanvas(context, canvas.width, canvas.height, {
      rows: pages[index], allRows: rows, selection, locale, labels,
      from, to, userName, employmentName, logo, page: index + 1, pageCount: pages.length
    });
    if (index > 0) pdf.addPage("a4", orientation);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0,
      210, 297, undefined, "FAST");
  }
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
  const extraMinutes = lines.reduce((total, line) => total + (
    Math.max(Number(line.extraPayPercentage || 0), 0) > 0
      ? Math.max(Number(line.calculatedMinutes || 0), 0)
      : 0
  ), 0);
  const currency = earnings.length === 1 ? earnings[0][0] : earnings.length > 1 ? "MIXED" : "";
  const notes = unique([
    record.notes?.trim() ?? "",
    ...lines.map((line) => line.notes?.trim() ?? "")
  ].filter(Boolean));

  const intervalValue = selection.intervals ? intervals.join(" · ") : "";
  const hoursValue = selection.hours && minutes > 0 ? formatDuration(minutes) : "";
  const quantityValue = selection.quantity ? quantities.join(", ") : "";
  const workDetails = lines.map((line) => {
    const lineMinutes = Math.max(Number(line.calculatedMinutes || 0), 0);
    const lineQuantity = Math.max(Number(line.quantity ?? 0), 0);
    const details = [
      selection.intervals && line.startTime && line.endTime
        ? `${line.startTime.slice(0, 5)}–${line.endTime.slice(0, 5)}`
        : "",
      selection.hours && lineMinutes > 0 ? formatDuration(lineMinutes) : "",
      selection.quantity && lineQuantity > 0 ? formatNumber(lineQuantity, locale) : ""
    ].filter(Boolean);
    return details.length > 0 ? `${line.workTypeName.trim()}: ${details.join(" · ")}` : "";
  }).filter(Boolean).join("; ");
  const workTypeCells = lines.map((line) => {
    const lineMinutes = Math.max(Number(line.calculatedMinutes || 0), 0);
    const lineQuantity = Math.max(Number(line.quantity ?? 0), 0);
    const details = [
      selection.intervals && line.startTime && line.endTime ? `${line.startTime.slice(0, 5)}–${line.endTime.slice(0, 5)}` : "",
      selection.hours && lineMinutes > 0 ? formatDuration(lineMinutes) : "",
      selection.quantity && lineQuantity > 0
        ? `${formatNumber(lineQuantity, locale)}${line.unitLabel ? ` ${line.unitLabel}` : ""}` : "",
      selection.extra && Number(line.extraPayPercentage || 0) > 0
        ? `+${formatNumber(Number(line.extraPayPercentage), locale)}%` : ""
    ].filter(Boolean);
    const workTypeName = line.workTypeName.trim();
    const categoryName = line.categoryName?.trim() || null;
    return {
      workTypeId: line.workTypeId,
      workTypeName,
      categoryName: categoryName && categoryName !== workTypeName ? categoryName : null,
      value: details.join(" · ")
    };
  });

  return {
    key: record.id,
    kind: "session",
    isoDate: record.workDate,
    date: formatDate(record.workDate, locale),
    activity: activityNames.join(" · "),
    status: "",
    intervals: intervalValue,
    hours: hoursValue,
    quantity: quantityValue,
    workDetails,
    extra: selection.extra && percentages.length > 0
      ? `${formatDuration(extraMinutes)} · ${percentages.map((value) => `+${formatNumber(value, locale)}%`).join(" · ")}`
      : "",
    earnings: selection.earnings
      ? earnings.map(([code, value]) => formatMoney(value, code, locale)).join(" · ")
      : "",
    notes: selection.notes ? notes.join(" · ") : "",
    minutes,
    extraMinutes,
    amount,
    currency,
    workTypeCells
  };
}

function emptyDayRow(date: string, locale: string): PdfReportRow {
  return {
    key: `empty:${date}`,
    kind: "empty",
    isoDate: date,
    date: formatDate(date, locale),
    activity: "",
    status: "",
    intervals: "",
    hours: "",
    quantity: "",
    workDetails: "",
    extra: "",
    earnings: "",
    notes: "",
    minutes: 0,
    extraMinutes: 0,
    amount: 0,
    currency: "",
    workTypeCells: []
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
      status: absence.absenceTypeName,
      intervals: "",
      hours: selection.hours && absence.paid && absence.paidMinutesPerDay > 0
        ? formatDuration(absence.paidMinutesPerDay) : "",
      quantity: "",
      workDetails: "",
      extra: "",
      earnings: "",
      notes: selection.notes ? absence.notes?.trim() ?? "" : "",
      minutes: 0,
      extraMinutes: 0,
      amount: 0,
      currency: "",
      workTypeCells: []
    }));
  });
}

function buildRestDayRows(
  restDays: EmploymentRestDay[], selection: PdfExportSelection, locale: string,
  from: string, to: string
) {
  return restDays.filter((item) => item.date >= from && item.date <= to).map((item): PdfReportRow => ({
    key: `rest:${item.id}`,
    kind: "rest",
    isoDate: item.date,
    date: formatDate(item.date, locale),
    activity: "REST_DAY",
    status: "REST_DAY",
    intervals: "", hours: "", quantity: "", workDetails: "", extra: "", earnings: "",
    notes: selection.notes ? item.notes?.trim() ?? "" : "",
    minutes: 0, extraMinutes: 0, amount: 0, currency: "", workTypeCells: []
  }));
}

function mergeDayRows(date: string, rows: PdfReportRow[], locale: string, selection: PdfExportSelection): PdfReportRow {
  const sessions = rows.filter((row) => row.kind === "session");
  const primary = sessions[0] ?? rows[0];
  const cells = new Map<string, PdfWorkTypeCell>();
  sessions.flatMap((row) => row.workTypeCells).forEach((cell) => {
    const previous = cells.get(cell.workTypeId);
    cells.set(cell.workTypeId, previous
      ? { ...previous, value: [previous.value, cell.value].filter(Boolean).join("; ") }
      : cell);
  });
  const notes = unique(rows.map((row) => row.notes).filter(Boolean)).join(" · ");
  const currencies = new Map<string, number>();
  sessions.forEach((row) => {
    if (row.currency && row.currency !== "MIXED") currencies.set(row.currency, (currencies.get(row.currency) ?? 0) + row.amount);
  });
  const amount = sessions.reduce((sum, row) => sum + row.amount, 0);
  const currency = currencies.size === 1 ? [...currencies.keys()][0] : currencies.size > 1 ? "MIXED" : "";
  return {
    ...primary,
    key: `day:${date}`,
    isoDate: date,
    date: formatDate(date, locale),
    kind: sessions.length ? "session" : primary.kind,
    activity: unique(rows.map((row) => row.activity).filter(Boolean)).join(" · "),
    status: unique(rows.filter((row) => row.kind !== "session").map((row) => row.status).filter(Boolean)).join(" · "),
    workTypeCells: [...cells.values()],
    notes,
    minutes: sessions.reduce((sum, row) => sum + row.minutes, 0),
    extraMinutes: sessions.reduce((sum, row) => sum + row.extraMinutes, 0),
    amount,
    currency,
    earnings: selection.earnings
      ? [...currencies].map(([code, value]) => formatMoney(value, code, locale)).join(" · ")
      : ""
  };
}

function drawReportCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  report: {
    rows: PdfReportRow[];
    allRows: PdfReportRow[];
    selection: PdfExportSelection;
    locale: string;
    labels: ReportLabels;
    from: string;
    to: string;
    userName: string;
    employmentName: string;
    logo: HTMLImageElement | null;
    page: number;
    pageCount: number;
  }
) {
  const { rows, allRows, selection, locale, labels } = report;
  context.fillStyle = "#f1f1f1";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#090909";
  context.fillRect(0, 0, width, 142);
  if (report.logo) context.drawImage(report.logo, 64, 30, 62, 62);
  drawSpacedText(context, "ALVERYN", report.logo ? 148 : 64, 68, 25, 9, "#ffffff");
  context.fillStyle = "#a5a5a5";
  context.font = "600 15px Inter, Arial, sans-serif";
  context.fillText(`${labels.report.toUpperCase()} · ${report.userName}`, 66, 108);
  context.textAlign = "right";
  context.fillText(`${labels.generated}: ${formatDate(new Date().toISOString().slice(0, 10), locale)}`, width - 64, 68);
  context.fillText(`${report.employmentName} · ${report.from} – ${report.to}`, width - 64, 108);
  context.textAlign = "left";

  const totalMinutes = allRows.reduce((total, row) => total + row.minutes, 0);
  const workedDates = new Set(allRows.filter((row) => row.kind === "session" && row.minutes > 0).map((row) => row.isoDate));
  const absenceDates = new Set(allRows
    .filter((row) => row.kind === "absence" && !workedDates.has(row.isoDate))
    .map((row) => row.isoDate));
  const totalExtraMinutes = allRows.reduce((total, row) =>
    total + (row.kind === "absence" && workedDates.has(row.isoDate) ? 0 : row.extraMinutes), 0);
  const earningsByCurrency = new Map<string, number>();
  allRows.forEach((row) => {
    if (!row.currency || row.amount <= 0) return;
    earningsByCurrency.set(row.currency, (earningsByCurrency.get(row.currency) ?? 0) + row.amount);
  });
  const totalEarnings = [...earningsByCurrency.entries()]
    .map(([currency, amount]) => formatMoney(amount, currency, locale)).join(" · ") || "—";
  const summary = [
    { label: labels.workedDays, value: formatNumber(workedDates.size, locale) },
    { label: labels.absences, value: formatNumber(absenceDates.size, locale) },
    { label: labels.totalHours, value: formatDuration(totalMinutes) },
    { label: labels.totalExtraHours, value: formatDuration(totalExtraMinutes) },
    ...(selection.earnings ? [{ label: labels.totalEarnings, value: totalEarnings }] : [])
  ];
  const summaryWidth = (width - 128 - (summary.length - 1) * 12) / summary.length;
  summary.forEach((item, index) => {
    const x = 64 + index * (summaryWidth + 12);
    context.fillStyle = index === 0 ? "#ffffff" : "#202020";
    roundRect(context, x, 164, summaryWidth, 88, 18);
    context.fillStyle = index === 0 ? "#6d6d6d" : "#999999";
    context.font = "600 14px Inter, Arial, sans-serif";
    context.fillText(item.label.toUpperCase(), x + 20, 196);
    context.fillStyle = index === 0 ? "#090909" : "#ffffff";
    context.font = "700 24px Manrope, Inter, Arial, sans-serif";
    context.fillText(trimToWidth(context, item.value, summaryWidth - 40), x + 20, 231);
  });

  const workTypeColumns = getPdfWorkTypeColumns(allRows);
  const columns = buildColumns(selection, labels, workTypeColumns);
  const tableX = 64;
  const tableY = 278;
  const tableWidth = width - 128;
  const footerY = height - 68;
  const availableHeight = footerY - tableY;
  const groupedHeader = workTypeColumns.some((column) => column.categoryName);
  const headerRows = groupedHeader ? 1.55 : 1;
  const rowHeight = Math.min(45, availableHeight / Math.max(rows.length + headerRows, 1));
  const headerHeight = rowHeight * headerRows;
  const bodyFontSize = Math.max(4.5, Math.min(14, rowHeight * 0.34));
  const headerFontSize = Math.max(5, Math.min(12, rowHeight * 0.3));
  const totalWeight = columns.reduce((total, column) => total + column.weight, 0);
  const widths = columns.map((column) => tableWidth * column.weight / totalWeight);

  context.fillStyle = "#0b0b0b";
  roundRect(context, tableX, tableY, tableWidth, headerHeight, Math.min(14, rowHeight / 2));
  let cursorX = tableX;
  columns.forEach((column, index) => {
    if (column.workTypeId && column.categoryName) {
      cursorX += widths[index];
      return;
    }
    context.fillStyle = "#ffffff";
    context.font = `700 ${headerFontSize}px Inter, Arial, sans-serif`;
    context.fillText(
      trimToWidth(context, column.label.toUpperCase(), widths[index] - 16),
      cursorX + 8,
      tableY + headerHeight * 0.62
    );
    cursorX += widths[index];
  });

  if (groupedHeader) {
    let columnIndex = 0;
    while (columnIndex < columns.length) {
      const column = columns[columnIndex];
      if (!column.workTypeId || !column.categoryName) {
        columnIndex += 1;
        continue;
      }
      let end = columnIndex + 1;
      while (end < columns.length && columns[end].categoryName === column.categoryName) end += 1;
      const groupX = tableX + widths.slice(0, columnIndex).reduce((sum, value) => sum + value, 0);
      const groupWidth = widths.slice(columnIndex, end).reduce((sum, value) => sum + value, 0);
      context.fillStyle = "#ffffff";
      context.font = `700 ${headerFontSize}px Inter, Arial, sans-serif`;
      context.textAlign = "center";
      context.fillText(
        trimToWidth(context, column.categoryName.toUpperCase(), groupWidth - 16),
        groupX + groupWidth / 2,
        tableY + headerHeight * 0.34
      );
      context.strokeStyle = "rgba(255,255,255,0.24)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(groupX + 6, tableY + headerHeight * 0.48);
      context.lineTo(groupX + groupWidth - 6, tableY + headerHeight * 0.48);
      context.stroke();
      for (let child = columnIndex; child < end; child += 1) {
        const childX = tableX + widths.slice(0, child).reduce((sum, value) => sum + value, 0);
        context.fillText(
          trimToWidth(context, columns[child].label.toUpperCase(), widths[child] - 12),
          childX + widths[child] / 2,
          tableY + headerHeight * 0.82
        );
      }
      context.textAlign = "left";
      columnIndex = end;
    }
  }

  rows.forEach((row, rowIndex) => {
    const y = tableY + headerHeight + rowHeight * rowIndex;
    context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#e8e8e8";
    context.fillRect(tableX, y, tableWidth, rowHeight);
    cursorX = tableX;
    columns.forEach((column, columnIndex) => {
      context.fillStyle = column.key === "activity" ? "#101010" : "#555555";
      context.font = `${column.key === "activity" ? 650 : 550} ${bodyFontSize}px Inter, Arial, sans-serif`;
      const rawValue = column.workTypeId
        ? row.workTypeCells.find((cell) => cell.workTypeId === column.workTypeId)?.value ?? ""
        : column.key === "status" && row.kind === "rest" ? labels.restDay
          : row[column.key!];
      const value = String(rawValue);
      if (column.workTypeId && value.includes("; ")) {
        drawCellLines(context, value.split("; "), cursorX + 8, y, widths[columnIndex] - 16, rowHeight, bodyFontSize);
      } else {
        context.fillText(trimToWidth(context, value, widths[columnIndex] - 16), cursorX + 8, y + rowHeight * 0.62);
      }
      cursorX += widths[columnIndex];
    });
  });

  context.fillStyle = "#777777";
  context.font = "600 13px Inter, Arial, sans-serif";
  context.fillText(labels.generatedWith, 64, height - 30);
  context.textAlign = "right";
  context.fillText(`${labels.page} ${report.page}/${report.pageCount}  •  ALVERYN.COM  •  A4`, width - 64, height - 30);
  context.textAlign = "left";
}

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size));
}

function buildColumns(selection: PdfExportSelection, labels: ReportLabels, workTypes: PdfWorkTypeColumn[]) {
  const columns: Array<{
    key?: keyof PdfReportRow;
    workTypeId?: string;
    categoryName?: string | null;
    label: string;
    weight: number;
  }> = [
    { key: "date", label: labels.date, weight: 1.05 },
    { key: "status", label: labels.status, weight: 1.05 },
    ...workTypes.map((workType) => ({
      workTypeId: workType.id,
      categoryName: workType.categoryName,
      label: workType.name,
      weight: 1.5
    }))
  ];
  if (workTypes.length === 0) columns.push({ key: "activity", label: labels.activity, weight: 1.5 });
  if (selection.notes) columns.push({ key: "notes", label: labels.notes, weight: 1.45 });
  if (selection.earnings) columns.push({ key: "earnings", label: labels.earnings, weight: 1.05 });
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

function drawCellLines(
  context: CanvasRenderingContext2D,
  values: string[],
  x: number,
  y: number,
  maxWidth: number,
  rowHeight: number,
  fontSize: number
) {
  const lineHeight = Math.max(fontSize * 1.08, 6);
  const maxLines = Math.max(1, Math.floor((rowHeight - 4) / lineHeight));
  const visible = values.slice(0, maxLines);
  if (values.length > maxLines) {
    visible[maxLines - 1] = `${visible[maxLines - 1]} · +${values.length - maxLines + 1}`;
  }
  const startY = y + (rowHeight - visible.length * lineHeight) / 2 + lineHeight * 0.78;
  visible.forEach((value, index) => {
    context.fillText(trimToWidth(context, value, maxWidth), x, startY + index * lineHeight);
  });
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

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${source}`));
    image.src = source;
  });
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
