import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Moon,
  Printer,
  RotateCcw,
  Settings,
  Sun,
  Users,
  X
} from "lucide-react";
import { AppLogo } from "../components/branding/app-logo";
import { applyAppTheme } from "../utils/theme";
import "../styles/business-planning-prototype.css";

type ProductView = "demand" | "schedule" | "review";
type PrototypeLanguage = "EN" | "DE" | "RO" | "RU";
type Candidate = "ana" | "mara" | null;

const copyByLanguage = {
  EN: {
    nav: { demand: "Demand", schedule: "Schedule", review: "Review" },
    overview: "Overview", plan: "Plan", team: "Team", work: "Work", settings: "Settings",
    demandTitle: "Turn hotel demand into open positions.",
    demandDescription: "Type, paste or reuse the week. Every value stays connected to the plan.",
    scheduleTitle: "Build the week where the work lives.",
    scheduleDescription: "Requirements, people and coverage stay in one operational surface.",
    reviewTitle: "Is every requirement covered?",
    reviewDescription: "Conflicts, coverage and changes are checked before the team sees the plan."
  },
  DE: {
    nav: { demand: "Bedarf", schedule: "Dienstplan", review: "Prüfen" },
    overview: "Übersicht", plan: "Planung", team: "Team", work: "Arbeit", settings: "Einstellungen",
    demandTitle: "Hotelbedarf wird zu offenen Positionen.",
    demandDescription: "Tippen, einfügen oder die Vorwoche übernehmen. Jeder Wert bleibt mit dem Plan verbunden.",
    scheduleTitle: "Plane die Woche direkt an der Arbeit.",
    scheduleDescription: "Bedarf, Team und Abdeckung bleiben auf einer Arbeitsfläche.",
    reviewTitle: "Ist jeder Bedarf abgedeckt?",
    reviewDescription: "Konflikte, Abdeckung und Änderungen werden vor der Veröffentlichung geprüft."
  },
  RO: {
    nav: { demand: "Necesar", schedule: "Program", review: "Verificare" },
    overview: "Prezentare", plan: "Plan", team: "Echipă", work: "Muncă", settings: "Setări",
    demandTitle: "Transformă necesarul hotelului în poziții deschise.",
    demandDescription: "Scrie, lipește sau reutilizează săptămâna. Fiecare valoare rămâne conectată la plan.",
    scheduleTitle: "Construiește săptămâna acolo unde este munca.",
    scheduleDescription: "Necesarul, oamenii și acoperirea rămân într-o singură suprafață operațională.",
    reviewTitle: "Este acoperit fiecare necesar?",
    reviewDescription: "Conflictele, acoperirea și schimbările sunt verificate înainte ca echipa să vadă planul."
  },
  RU: {
    nav: { demand: "Потребность", schedule: "График", review: "Проверка" },
    overview: "Обзор", plan: "План", team: "Команда", work: "Работа", settings: "Настройки",
    demandTitle: "Потребность отеля становится открытыми позициями.",
    demandDescription: "Введите, вставьте или повторите неделю. Каждое значение связано с планом.",
    scheduleTitle: "Планируйте неделю там, где находится работа.",
    scheduleDescription: "Потребность, люди и покрытие остаются на одном рабочем экране.",
    reviewTitle: "Закрыта ли каждая потребность?",
    reviewDescription: "Конфликты, покрытие и изменения проверяются до публикации."
  }
} as const;

type Copy = (typeof copyByLanguage)[PrototypeLanguage];
type DemandRow = { code: string; label: string; interval: string; values: number[]; source: "hotel" | "demo" };
type OpenRequirement = { rowIndex: number; dayIndex: number; code: string; label: string; interval: string };
type TeamMember = { name: string; role: string; hours: number; week: string[] };

const days = [
  { short: "MON", date: "10", rooms: 50, start: "09:00" },
  { short: "TUE", date: "11", rooms: 40, start: "09:00" },
  { short: "WED", date: "12", rooms: 40, start: "09:00" },
  { short: "THU", date: "13", rooms: 30, start: "09:00" },
  { short: "FRI", date: "14", rooms: 30, start: "09:00" },
  { short: "SAT", date: "15", rooms: 50, start: "10:00" },
  { short: "SUN", date: "16", rooms: 10, start: "10:00" }
] as const;

const baseDemand: DemandRow[] = [
  { code: "ROOM", label: "Room cleaning", interval: "09:00 / 10:00", values: [4, 4, 4, 2, 2, 4, 2], source: "hotel" },
  { code: "CH", label: "Checker", interval: "after rooms", values: [0, 0, 0, 1, 1, 1, 0], source: "hotel" },
  { code: "PF", label: "Public Früh", interval: "05:00–13:30", values: [2, 2, 2, 2, 2, 2, 1], source: "demo" },
  { code: "PS", label: "Public Spät", interval: "13:30–22:00", values: [2, 2, 2, 2, 2, 2, 1], source: "demo" },
  { code: "HD", label: "Handyman", interval: "09:00–17:30", values: [1, 1, 1, 1, 1, 1, 0], source: "demo" },
  { code: "HSK", label: "Housekeeping late", interval: "13:30–22:00", values: [1, 1, 1, 1, 1, 1, 1], source: "demo" },
  { code: "SPA F", label: "Spa Früh", interval: "05:00–08:00", values: [2, 2, 2, 2, 2, 2, 1], source: "demo" },
  { code: "SPA S", label: "Spa Spät", interval: "12:00–20:30", values: [1, 1, 1, 1, 1, 1, 1], source: "demo" },
  { code: "WW", label: "Wäsche / Wasser", interval: "09:00–17:30", values: [1, 1, 1, 1, 1, 1, 1], source: "demo" },
  { code: "LISTE", label: "Room lists", interval: "08:45", values: [1, 1, 1, 1, 1, 1, 1], source: "demo" }
];

const teamData: Array<[string, string, string[]]> = [
  ["Elena Popescu", "LISTE", ["U", "U", "U", "LISTE + OBJ", "LISTE + OBJ", "LISTE + OBJ", "F"]],
  ["Sebastian Marin", "PF", ["PF", "PF", "PF", "PF", "REQ", "F", "F"]],
  ["Mihaela Radu", "PF", ["PF", "PF", "PF", "PF", "REQ", "F", "F"]],
  ["Daniel Ionescu", "PS", ["PS", "REQ", "PS", "PS", "PS", "F", "F"]],
  ["Ana Dumitru", "SPA", ["SPA F", "SPA F", "SPA F", "SPA S", "SPA S", "SPA S", "—"]],
  ["Mara Klein", "SPA", ["SPA F", "SPA F", "SPA F", "SPA S", "SPA S", "SPA S", "—"]],
  ["Sofia Werner", "SPA", ["SPA F", "SPA F", "SPA F", "SPA S", "SPA S", "SPA S", "U"]],
  ["Victor Pavel", "HD", ["HD", "HD", "HD + WW", "HD + WW!", "HD", "HD", "F"]],
  ["Andrei Munteanu", "WW", ["WW", "WW", "WW", "WW", "WW", "WW", "F"]],
  ["Irina Stoica", "HSK", ["HSK", "HSK", "HSK", "HSK", "HSK", "HSK", "F"]],
  ["Maria Neagu", "CH", ["ROOM 9", "ROOM 9", "ROOM 9", "CH", "CH", "CH", "F"]],
  ["Alina Petrescu", "ROOM", ["ROOM 9", "ROOM 9", "ROOM 9", "WW*", "ROOM 9", "ROOM 10", "F"]],
  ["Gabriela Tudor", "ROOM", ["ROOM 9", "ROOM 9", "ROOM 9", "ROOM 9", "ROOM 9", "ROOM 10", "F"]],
  ["Roxana Matei", "ROOM", ["ROOM 9", "ROOM 9", "ROOM 9", "ROOM 9", "SICK", "ROOM 10", "F"]]
];

const team: TeamMember[] = teamData.map(([name, role, week], index) => ({ name, role, week, hours: 24 + (index % 5) * 4 }));
const cloneDemand = (rows: DemandRow[]) => rows.map((row) => ({ ...row, values: [...row.values] }));
const totalRequired = (rows: DemandRow[]) => rows.reduce((total, row) => total + row.values.reduce((sum, value) => sum + value, 0), 0);

export function BusinessPlanningPrototypePage() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  const initialView: ProductView = requestedView === "schedule" || requestedView === "day" || requestedView === "recommendation"
    ? "schedule"
    : requestedView === "review" || requestedView === "versions" || requestedView === "print" ? "review" : "demand";
  const [view, setView] = useState<ProductView>(initialView);
  const [demand, setDemand] = useState(() => cloneDemand(baseDemand));
  const [history, setHistory] = useState<DemandRow[][]>([]);
  const [openRequirement, setOpenRequirement] = useState<OpenRequirement | null>(
    requestedView === "recommendation" ? { rowIndex: 7, dayIndex: 6, code: "SPA S", label: "Spa Spät", interval: "12:00–20:30" } : null
  );
  const [acceptedCandidate, setAcceptedCandidate] = useState<Candidate>(null);
  const [previewCandidate, setPreviewCandidate] = useState<Candidate>(null);
  const [inspectorOpen, setInspectorOpen] = useState(requestedView === "recommendation");
  const [selectedDay, setSelectedDay] = useState(requestedView === "day" ? 5 : 6);
  const [lateChange, setLateChange] = useState(requestedView === "versions" || requestedView === "print");
  const [publishedV2, setPublishedV2] = useState(requestedView === "print");
  const [printOpen, setPrintOpen] = useState(requestedView === "print");
  const [theme, setTheme] = useState<"light" | "dark">(params.get("theme") === "dark" ? "dark" : "light");
  const requestedLanguage = params.get("lang")?.toUpperCase() as PrototypeLanguage | undefined;
  const [language, setLanguage] = useState<PrototypeLanguage>(requestedLanguage && requestedLanguage in copyByLanguage ? requestedLanguage : "EN");
  const copy = copyByLanguage[language];

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
      secondFrame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [view]);

  const required = totalRequired(demand);
  const addedPositions = Math.max(0, required - totalRequired(baseDemand));
  const assigned = Math.min(required, 98 + (acceptedCandidate ? 1 : 0));
  const uncovered = Math.max(0, required - assigned);
  const coverage = Math.round((assigned / required) * 100);
  const dayTotals = useMemo(() => days.map((_, dayIndex) => demand.reduce((sum, row) => sum + row.values[dayIndex], 0)), [demand]);

  const updateDemand = (next: DemandRow[], open?: OpenRequirement | null) => {
    setHistory((items) => [...items.slice(-9), cloneDemand(demand)]);
    setDemand(next);
    if (open !== undefined) {
      setOpenRequirement(open);
      setAcceptedCandidate(null);
      setPreviewCandidate(null);
    }
  };

  const setDemandValue = (rowIndex: number, dayIndex: number, rawValue: number) => {
    const value = Math.max(0, Math.min(99, Number.isFinite(rawValue) ? rawValue : 0));
    const previous = demand[rowIndex].values[dayIndex];
    const next = cloneDemand(demand);
    next[rowIndex].values[dayIndex] = value;
    const row = next[rowIndex];
    const open = value > baseDemand[rowIndex].values[dayIndex]
      ? { rowIndex, dayIndex, code: row.code, label: row.label, interval: row.interval }
      : openRequirement?.rowIndex === rowIndex && openRequirement.dayIndex === dayIndex ? null : openRequirement;
    if (value !== previous) updateDemand(next, open);
  };

  const pasteDemand = (rowIndex: number, dayIndex: number, text: string) => {
    const lines = text.trim().split(/\r?\n/).map((line) => line.split(/\t|[,;]/).map((value) => Number.parseInt(value.trim(), 10)));
    if (!lines.some((line) => line.some(Number.isFinite))) return;
    const next = cloneDemand(demand);
    let latestOpen: OpenRequirement | null | undefined;
    lines.forEach((line, rowOffset) => line.forEach((value, dayOffset) => {
      const targetRow = rowIndex + rowOffset;
      const targetDay = dayIndex + dayOffset;
      if (!Number.isFinite(value) || !next[targetRow] || targetDay > 6) return;
      next[targetRow].values[targetDay] = Math.max(0, Math.min(99, value));
      if (value > baseDemand[targetRow].values[targetDay]) {
        const row = next[targetRow];
        latestOpen = { rowIndex: targetRow, dayIndex: targetDay, code: row.code, label: row.label, interval: row.interval };
      }
    }));
    updateDemand(next, latestOpen);
  };

  const undoDemand = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setDemand(cloneDemand(previous));
    setHistory((items) => items.slice(0, -1));
    setOpenRequirement(null);
    setAcceptedCandidate(null);
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
  };

  const openScheduleRequirement = () => {
    if (!openRequirement) setOpenRequirement({ rowIndex: 7, dayIndex: 6, code: "SPA S", label: "Spa Spät", interval: "12:00–20:30" });
    setSelectedDay(openRequirement?.dayIndex ?? 6);
    setInspectorOpen(true);
  };

  const acceptCandidate = (candidate: Exclude<Candidate, null>) => {
    setPreviewCandidate(candidate);
    setAcceptedCandidate(candidate);
    setInspectorOpen(true);
  };

  return <main className="business-prototype" data-theme={theme} data-testid="business-planning-prototype" lang={language.toLowerCase()}>
    <ShellHeader theme={theme} language={language} setLanguage={setLanguage} toggleTheme={toggleTheme} />
    <ShellSidebar copy={copy} />
    <section className="bp-main">
      <nav className="bp-stage-nav" aria-label="Planning workflow">
        {(["demand", "schedule", "review"] as const).map((item, index) => <button type="button" key={item} className={view === item ? "is-active" : ""} onClick={() => setView(item)}><span>0{index + 1}</span>{copy.nav[item]}</button>)}
      </nav>
      {view === "demand" ? <DemandView copy={copy} demand={demand} required={required} addedPositions={addedPositions} dayTotals={dayTotals} historyCount={history.length} onValue={setDemandValue} onPaste={pasteDemand} onUndo={undoDemand} onBulk={(row, selectedDays) => {
        const next = cloneDemand(demand);
        selectedDays.forEach((day) => { next[row].values[day] = demand[row].values[selectedDays[0] ?? day]; });
        updateDemand(next);
      }} onCopy={() => updateDemand(cloneDemand(baseDemand), null)} onContinue={() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        setView("schedule");
      }} /> : null}
      {view === "schedule" ? <ScheduleView copy={copy} required={required} assigned={assigned} uncovered={uncovered} coverage={coverage} selectedDay={selectedDay} setSelectedDay={setSelectedDay} openRequirement={openRequirement} inspectorOpen={inspectorOpen} setInspectorOpen={setInspectorOpen} previewCandidate={previewCandidate} setPreviewCandidate={setPreviewCandidate} acceptedCandidate={acceptedCandidate} onOpenRequirement={openScheduleRequirement} onAccept={acceptCandidate} onReview={() => setView("review")} onLateChange={() => { setLateChange(true); setView("review"); }} /> : null}
      {view === "review" ? <ReviewView copy={copy} required={required} assigned={assigned} coverage={coverage} uncovered={uncovered} acceptedCandidate={acceptedCandidate} lateChange={lateChange} publishedV2={publishedV2} printOpen={printOpen} onResolve={() => { setView("schedule"); openScheduleRequirement(); }} onLateChange={() => setLateChange(true)} onPublish={() => setPublishedV2(true)} onPrint={() => setPrintOpen(true)} onClosePrint={() => setPrintOpen(false)} /> : null}
    </section>
  </main>;
}

function ShellHeader({ theme, language, setLanguage, toggleTheme }: { theme: "light" | "dark"; language: PrototypeLanguage; setLanguage: (language: PrototypeLanguage) => void; toggleTheme: () => void }) {
  return <header className="bp-topbar"><div className="bp-brand"><AppLogo wordmark /></div><button type="button" className="bp-workspace" aria-label="Change workspace"><span><small>BUSINESS</small><strong>PUIU GmbH</strong></span><ChevronDown /></button><div className="bp-context"><span>Hotel München</span><i /><strong>KW 33 · 10–16 AUG 2026</strong><em>DEMO</em></div><div className="bp-tools"><label><span className="sr-only">Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as PrototypeLanguage)}><option>EN</option><option>DE</option><option>RO</option><option>RU</option></select></label><button type="button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? <Moon /> : <Sun />}</button></div></header>;
}

function ShellSidebar({ copy }: { copy: Copy }) {
  return <aside className="bp-sidebar" aria-label="Business navigation"><nav><button type="button"><BriefcaseBusiness /><span>{copy.overview}</span></button><button type="button" className="is-active"><CalendarDays /><span>{copy.plan}</span></button><button type="button"><Users /><span>{copy.team}</span></button><button type="button"><ClipboardList /><span>{copy.work}</span></button><button type="button"><Settings /><span>{copy.settings}</span></button></nav><div className="bp-personal-switch"><small>PERSONAL</small><strong>My record</strong><span>Private</span></div></aside>;
}

function PageIntro({ eyebrow, title, description, aside, compact = false }: { eyebrow: string; title: string; description: string; aside?: ReactNode; compact?: boolean }) {
  return <header className={`bp-page-intro${compact ? " is-compact" : ""}`}><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{aside}</header>;
}

function DemandView({ copy, demand, required, addedPositions, dayTotals, historyCount, onValue, onPaste, onUndo, onBulk, onCopy, onContinue }: { copy: Copy; demand: DemandRow[]; required: number; addedPositions: number; dayTotals: number[]; historyCount: number; onValue: (row: number, day: number, value: number) => void; onPaste: (row: number, day: number, text: string) => void; onUndo: () => void; onBulk: (row: number, days: number[]) => void; onCopy: () => void; onContinue: () => void }) {
  const [mobileDay, setMobileDay] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2]);
  const [selectedRow, setSelectedRow] = useState(0);
  const toggleDay = (index: number) => setSelectedDays((current) => current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort());
  return <div className="bp-view bp-demand-view"><PageIntro eyebrow="PLAN · DEMAND" title={copy.demandTitle} description={copy.demandDescription} aside={<div className="bp-save-state"><Check /> Draft saved locally</div>} />
    <div className="bp-demand-layout"><section className="bp-matrix-wrap" aria-label="Weekly staffing demand">
      <div className="bp-demand-actions"><button type="button" onClick={onCopy}>Copy previous week</button><button type="button" onClick={() => onBulk(selectedRow, selectedDays)}>Apply to selected days</button><button type="button" disabled={!historyCount} onClick={onUndo}><RotateCcw /> Undo</button><span>Paste directly from Excel · <b>demo data</b></span></div>
      <div className="bp-day-selection" aria-label="Select days for bulk editing">{days.map((day, index) => <button type="button" key={day.short} aria-pressed={selectedDays.includes(index)} className={selectedDays.includes(index) ? "is-selected" : ""} onClick={() => toggleDay(index)}>{day.short}</button>)}</div>
      <div className="bp-demand-matrix"><div className="bp-matrix-corner"><strong>WORK</strong><span>Click a value · type · Enter</span></div>{days.map((day) => <div className="bp-matrix-day" key={day.short}><small>{day.short}</small><strong>{day.date}</strong><span>{day.rooms} rooms</span></div>)}
        {demand.map((row, rowIndex) => <div className="bp-demand-row" key={row.code}><button type="button" className={`bp-demand-label${selectedRow === rowIndex ? " is-selected" : ""}`} onClick={() => setSelectedRow(rowIndex)}><strong>{row.code}</strong><span>{row.label}</span><small>{row.interval} · {row.source.toUpperCase()}</small></button>{row.values.map((value, dayIndex) => <DemandInput key={`${row.code}-${dayIndex}`} row={row} rowIndex={rowIndex} dayIndex={dayIndex} value={value} onValue={onValue} onPaste={onPaste} />)}</div>)}
      </div>
      <div className="bp-mobile-demand"><div className="bp-day-picker">{days.map((day, index) => <button type="button" key={day.short} className={mobileDay === index ? "is-active" : ""} onClick={() => setMobileDay(index)}><small>{day.short}</small><b>{day.date}</b></button>)}</div><header><div><span>{days[mobileDay].rooms} ROOMS</span><strong>{dayTotals[mobileDay]} positions</strong></div><small>ROOM starts {days[mobileDay].start}</small></header>{demand.map((row, rowIndex) => <div className="bp-mobile-demand-row" key={row.code}><span><b>{row.code}</b><small>{row.label} · {row.interval}</small></span><div><button type="button" aria-label={`Reduce ${row.label}`} onClick={() => onValue(rowIndex, mobileDay, row.values[mobileDay] - 1)}>−</button><input aria-label={`${row.label} on ${days[mobileDay].short}`} inputMode="numeric" value={row.values[mobileDay]} onChange={(event) => onValue(rowIndex, mobileDay, Number(event.target.value))} /><button type="button" aria-label={`Increase ${row.label}`} onClick={() => onValue(rowIndex, mobileDay, row.values[mobileDay] + 1)}>+</button></div></div>)}</div>
      <p className="bp-demand-note"><b>Sunday note</b> · Stayover rooms and strip departure beds.</p>
    </section><aside className={`bp-position-rail${addedPositions ? " has-new-position" : ""}`}><p>POSITIONS CREATED</p><strong>{required}</strong><span>required this week</span>{addedPositions ? <div className="bp-created-trace"><i /><b>+{addedPositions} open position</b><span>Demand → Schedule</span></div> : null}{days.map((day, index) => <div key={day.short}><b>{day.short}</b><span>{dayTotals[index]} positions</span><i style={{ "--coverage": `${(dayTotals[index] / 16) * 100}%` } as CSSProperties} /></div>)}<button type="button" onClick={onContinue}>Open schedule <ArrowRight /></button></aside></div>
  </div>;
}

function DemandInput({ row, rowIndex, dayIndex, value, onValue, onPaste }: { row: DemandRow; rowIndex: number; dayIndex: number; value: number; onValue: (row: number, day: number, value: number) => void; onPaste: (row: number, day: number, text: string) => void }) {
  const move = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!["Enter", "Tab"].includes(event.key)) return;
    if (event.key === "Enter") event.preventDefault();
    const all = Array.from(event.currentTarget.closest(".bp-demand-matrix")?.querySelectorAll<HTMLInputElement>(".bp-demand-cell input") ?? []);
    const index = all.indexOf(event.currentTarget);
    const offset = event.shiftKey ? -1 : event.key === "Enter" ? 7 : 1;
    all[index + offset]?.focus();
    all[index + offset]?.select();
  };
  const paste = (event: ClipboardEvent<HTMLInputElement>) => { event.preventDefault(); onPaste(rowIndex, dayIndex, event.clipboardData.getData("text")); };
  return <div className="bp-demand-cell"><button type="button" aria-label={`Reduce ${row.label} on ${days[dayIndex].short}`} onClick={() => onValue(rowIndex, dayIndex, value - 1)}>−</button><input aria-label={`${row.label} on ${days[dayIndex].short}`} inputMode="numeric" value={value} onFocus={(event) => event.currentTarget.select()} onChange={(event) => onValue(rowIndex, dayIndex, Number(event.target.value))} onKeyDown={move} onPaste={paste} /><button type="button" aria-label={`Increase ${row.label} on ${days[dayIndex].short}`} onClick={() => onValue(rowIndex, dayIndex, value + 1)}>+</button>{row.code === "ROOM" ? <small>{days[dayIndex].start}</small> : null}</div>;
}

function Coverage({ required, assigned, pulse = false }: { required: number; assigned: number; pulse?: boolean }) {
  const value = Math.min(100, Math.round((assigned / required) * 100));
  return <div className={`bp-coverage${pulse ? " is-updated" : ""}`} aria-live="polite"><div><span>WEEK COVERAGE</span><strong>{value}%</strong></div><div className="bp-coverage-line"><i style={{ width: `${value}%` }} /></div><small>{assigned} of {required} positions covered</small></div>;
}

function ScheduleView({ copy, required, assigned, uncovered, coverage, selectedDay, setSelectedDay, openRequirement, inspectorOpen, setInspectorOpen, previewCandidate, setPreviewCandidate, acceptedCandidate, onOpenRequirement, onAccept, onReview, onLateChange }: { copy: Copy; required: number; assigned: number; uncovered: number; coverage: number; selectedDay: number; setSelectedDay: (day: number) => void; openRequirement: OpenRequirement | null; inspectorOpen: boolean; setInspectorOpen: (open: boolean) => void; previewCandidate: Candidate; setPreviewCandidate: (candidate: Candidate) => void; acceptedCandidate: Candidate; onOpenRequirement: () => void; onAccept: (candidate: Exclude<Candidate, null>) => void; onReview: () => void; onLateChange: () => void }) {
  const targetDay = openRequirement?.dayIndex ?? 6;
  const targetCode = openRequirement?.code ?? "SPA S";
  const targetInterval = openRequirement?.interval ?? "12:00–20:30";
  const chosenName = (acceptedCandidate ?? previewCandidate) === "mara" ? "Mara Klein" : "Ana Dumitru";
  return <div className="bp-view bp-schedule-view"><PageIntro compact eyebrow="PLAN · SCHEDULE" title={copy.scheduleTitle} description={copy.scheduleDescription} aside={<div className="bp-plan-actions"><button type="button" onClick={onLateChange}>Late hotel update</button><button type="button" className="bp-primary" onClick={onReview}>Review plan <ArrowRight /></button></div>} />
    <Coverage required={required} assigned={assigned} pulse={Boolean(acceptedCandidate)} />
    <div className="bp-requirement-strip"><button type="button" className={uncovered ? "is-open" : "is-covered"} onClick={onOpenRequirement}><span><b>{targetCode} · {days[targetDay].short}</b><small>{targetInterval} · DEMO ESTIMATE</small></span><span><em>REQUIRED</em><strong>2</strong></span><span><em>ASSIGNED</em><strong>{uncovered ? "1" : "2"}</strong></span><span><em>{uncovered ? "MISSING" : "STATUS"}</em><strong>{uncovered ? "1" : "COVERED"}</strong></span><ArrowRight /></button><div><b>PF · WED</b><span>Required 1 · Assigned 2 · DEMO</span><em>Overstaffed by 1</em></div><div className="bp-legend-inline"><span><i className="is-vacation" />U Vacation</span><span><i className="is-free" />F Rest</span><span><i className="is-sick" />Sick</span><span><i className="is-requested" />Requested free</span><span><i className="has-conflict" />Conflict</span><span><i className="is-unusual" />Unusual role</span></div></div>
    <div className={`bp-planner-surface${inspectorOpen ? " has-inspector" : ""}`}>
      <section className="bp-grid-panel" aria-label="Employee weekly schedule"><div className="bp-grid-toolbar"><span>Hotel München · 34 people · All teams</span><span><kbd>Enter</kbd> next person · <kbd>Tab</kbd> next day · <kbd>⌘Z</kbd> undo</span><button type="button">Codes & shortcuts</button></div><div className="bp-schedule-grid" role="grid"><div className="bp-employee-head">EMPLOYEE <span>ROLE · WEEK HOURS</span></div>{days.map((day) => <div className="bp-schedule-day-head" key={day.short}><b>{day.short}</b><span>{day.date} AUG</span></div>)}
        {openRequirement ? <div className="bp-team-row bp-open-slot-row" role="row"><div className="bp-employee"><strong>{uncovered ? "OPEN POSITION" : chosenName}</strong><span>{targetCode} · {targetInterval}</span></div>{days.map((day, index) => <button type="button" role="gridcell" key={day.short} className={index === targetDay ? uncovered ? previewCandidate ? "is-preview" : "is-open-slot" : "is-new-assignment" : "is-empty"} onClick={index === targetDay ? onOpenRequirement : undefined}>{index === targetDay ? <>{uncovered ? previewCandidate ? <><b>{chosenName}</b><small>Preview · confirm</small></> : <><b>+ 1 PERSON</b><small>Open recommendation</small></> : <><b>{chosenName}</b><small>{targetCode} · covered</small></>}</> : <b>—</b>}</button>)}</div> : null}
        {team.map((person) => <div className="bp-team-row" role="row" key={person.name}><div className="bp-employee"><strong>{person.name}</strong><span>{person.role} · {person.hours}h</span></div>{person.week.map((entry, index) => <button type="button" role="gridcell" className={cellClass(entry)} key={`${person.name}-${index}`} aria-label={`${person.name}, ${days[index].short}: ${entry}`}><b>{entry}</b>{entry.startsWith("ROOM") ? <small>{entry.endsWith("10") ? "10:00" : "09:00"}</small> : null}</button>)}</div>)}
      </div></section>
      <RecommendationInspector open={inspectorOpen} targetCode={targetCode} targetDay={targetDay} targetInterval={targetInterval} previewCandidate={previewCandidate} acceptedCandidate={acceptedCandidate} onPreview={setPreviewCandidate} onAccept={onAccept} onClose={() => { setInspectorOpen(false); setPreviewCandidate(null); }} />
    </div>
    <MobileSchedule selectedDay={selectedDay} setSelectedDay={setSelectedDay} uncovered={uncovered} coverage={coverage} targetCode={targetCode} targetDay={targetDay} targetInterval={targetInterval} inspectorOpen={inspectorOpen} previewCandidate={previewCandidate} acceptedCandidate={acceptedCandidate} onOpen={onOpenRequirement} onPreview={setPreviewCandidate} onAccept={onAccept} onClose={() => setInspectorOpen(false)} />
  </div>;
}

function RecommendationInspector({ open, targetCode, targetDay, targetInterval, previewCandidate, acceptedCandidate, onPreview, onAccept, onClose }: { open: boolean; targetCode: string; targetDay: number; targetInterval: string; previewCandidate: Candidate; acceptedCandidate: Candidate; onPreview: (candidate: Candidate) => void; onAccept: (candidate: Exclude<Candidate, null>) => void; onClose: () => void }) {
  const [recommendationRejected, setRecommendationRejected] = useState(false);
  if (!open) return null;
  const selected = previewCandidate ?? acceptedCandidate ?? "ana";
  return <aside className="bp-recommend-inspector" aria-label="Assignment recommendation"><header><div><span>OPEN POSITION · {days[targetDay].short}</span><strong>{targetCode}</strong><small>{targetInterval} · 1 person needed</small></div><button type="button" aria-label="Close recommendation" onClick={onClose}><X /></button></header><p>RECOMMENDED</p>
    <CandidateRow id="ana" name="Ana Dumitru" meta="SPA · 24h this week" reasons={["Usually works SPA Spät", `Available ${targetInterval}`, "No conflicting assignment"]} selected={selected === "ana"} accepted={acceptedCandidate === "ana"} onPreview={onPreview} />
    <CandidateRow id="mara" name="Mara Klein" meta="SPA · 32h this week" reasons={["Has worked SPA Spät before", "Would reach 40h this week"]} selected={selected === "mara"} accepted={acceptedCandidate === "mara"} onPreview={onPreview} warning />
    <div className="bp-why-not"><p>WHY NOT OTHERS?</p><span><b>Sofia Werner</b>Vacation · Sunday</span><span><b>Irina Stoica</b>Already assigned HSK</span></div>{recommendationRejected ? <div className="bp-rejection-note" role="status"><b>Suggestion rejected</b><span>Reason · manager knows availability changed.</span><small>The reason stays in the draft. Choose another person above.</small></div> : null}<div className="bp-inspector-actions"><small>Preview appears in the open slot before confirmation.</small><div><button type="button" className="bp-reject-action" disabled={Boolean(acceptedCandidate)} onClick={() => setRecommendationRejected(true)}>Reject suggestion</button><button type="button" onClick={() => onAccept(selected)}>{acceptedCandidate === selected ? <><Check /> Assignment confirmed</> : <>{recommendationRejected ? "Assign manually" : `Assign ${selected === "ana" ? "Ana" : "Mara"}`} <ArrowRight /></>}</button></div></div>
  </aside>;
}

function CandidateRow({ id, name, meta, reasons, selected, accepted, onPreview, warning = false }: { id: Exclude<Candidate, null>; name: string; meta: string; reasons: string[]; selected: boolean; accepted: boolean; onPreview: (candidate: Exclude<Candidate, null>) => void; warning?: boolean }) {
  return <button type="button" className={`bp-candidate-row${selected ? " is-selected" : ""}${accepted ? " is-accepted" : ""}`} aria-pressed={selected} onClick={() => onPreview(id)}><span className="bp-avatar">{name.split(" ").map((part) => part[0]).join("")}</span><span><strong>{name}</strong><small>{meta}</small>{reasons.map((reason, index) => <em key={reason}>{warning && index === reasons.length - 1 ? <AlertTriangle /> : <Check />}{reason}</em>)}</span>{accepted ? <b>ASSIGNED</b> : selected ? <b>PREVIEW</b> : null}</button>;
}

function MobileSchedule({ selectedDay, setSelectedDay, uncovered, targetCode, targetDay, targetInterval, inspectorOpen, previewCandidate, acceptedCandidate, onOpen, onPreview, onAccept, onClose }: { selectedDay: number; setSelectedDay: (day: number) => void; uncovered: number; coverage: number; targetCode: string; targetDay: number; targetInterval: string; inspectorOpen: boolean; previewCandidate: Candidate; acceptedCandidate: Candidate; onOpen: () => void; onPreview: (candidate: Candidate) => void; onAccept: (candidate: Exclude<Candidate, null>) => void; onClose: () => void }) {
  const selected = previewCandidate ?? acceptedCandidate ?? "ana";
  const selectedName = selected === "ana" ? "Ana Dumitru" : "Mara Klein";
  return <section className="bp-mobile-schedule" aria-label="Mobile daily schedule"><header><span>MOBILE MANAGER</span><h1>{days[selectedDay].short === "SAT" ? "Saturday" : days[selectedDay].short === "SUN" ? "Sunday" : days[selectedDay].short} · {days[selectedDay].date} August</h1></header><div className="bp-day-picker">{days.map((day, index) => <button type="button" key={day.short} className={selectedDay === index ? "is-active" : ""} onClick={() => { setSelectedDay(index); if (index !== targetDay) onClose(); }}><small>{day.short}</small><b>{day.date}</b></button>)}</div><Coverage required={16} assigned={selectedDay === targetDay && uncovered ? 15 : 16} pulse={Boolean(acceptedCandidate)} />
    <div className="bp-mobile-summary"><div><span>ROOMS</span><strong>{days[selectedDay].rooms}</strong><small>start {days[selectedDay].start}</small></div><div><span>REQUIRED</span><strong>{selectedDay === targetDay ? 16 : 14}</strong><small>positions today</small></div><div><span>STATUS</span><strong>{selectedDay === targetDay && uncovered ? "1 OPEN" : "COVERED"}</strong><small>{selectedDay === targetDay ? targetCode : "All requirements"}</small></div></div>
    {selectedDay === targetDay ? <div className={`bp-mobile-open${uncovered ? "" : " is-covered"}`}><span><b>{targetCode}</b><small>{targetInterval} · Required 2</small></span><strong>{uncovered ? "1 / 2" : "2 / 2"}</strong><button type="button" onClick={onOpen}>{uncovered ? "Fill position" : "View assignment"}<ArrowRight /></button></div> : null}
    {inspectorOpen && selectedDay === targetDay ? <div className="bp-mobile-recommend"><div className="bp-mobile-recommend-head"><span>RECOMMENDED FOR THIS POSITION</span><button type="button" onClick={onClose}><X /></button></div><button type="button" className="is-selected" onClick={() => onPreview("ana")}><span className="bp-avatar">AD</span><span><strong>Ana Dumitru</strong><small>Usually works SPA Spät · available</small></span>{selected === "ana" ? <Check /> : null}</button><button type="button" onClick={() => onPreview("mara")}><span className="bp-avatar">MK</span><span><strong>Mara Klein</strong><small>Would reach 40h this week</small></span>{selected === "mara" ? <Check /> : null}</button><button type="button" className="bp-primary" onClick={() => onAccept(selected)}>Assign {selectedName.split(" ")[0]}</button></div> : null}
    <section className="bp-mobile-section"><header><p>PEOPLE TODAY</p><span>{selectedDay === targetDay && uncovered ? "15 / 16" : "16 / 16"}</span></header>{acceptedCandidate && selectedDay === targetDay ? <button type="button" className="is-new-mobile-assignment"><span><strong>{selectedName}</strong><small>{targetCode} · {targetInterval}</small></span><em>NEW</em></button> : null}{team.map((person) => <button type="button" key={person.name} className={cellClass(person.week[selectedDay])}><span><strong>{person.name}</strong><small>{person.week[selectedDay]}</small></span><em>{person.role}</em></button>)}</section>
    <section className="bp-mobile-section"><header><p>NEEDS ATTENTION</p><span>3</span></header><button type="button" className="has-warning"><span><strong>Victor · overlapping assignments</strong><small>HD and WW overlap</small></span><AlertTriangle /></button><button type="button" className="is-requested"><span><strong>Mihaela · requested free</strong><small>WhatsApp · awaiting decision</small></span><Clock3 /></button><button type="button" className="is-unusual"><span><strong>Friday · checker skill mismatch</strong><small>Replace before publishing</small></span><AlertTriangle /></button><div className="bp-mobile-statuses"><span><i className="is-free" />Frei</span><span><i className="is-vacation" />Urlaub</span><span><i className="is-sick" />Sick</span><span><i className="is-requested" />Requested</span><span><i className="has-conflict" />Conflict</span></div></section>
  </section>;
}

function cellClass(entry: string) { if (entry === "U") return "is-vacation"; if (entry === "F") return "is-free"; if (entry === "SICK") return "is-sick"; if (entry === "REQ") return "is-requested"; if (entry.includes("!")) return "has-conflict"; if (entry === "—") return "is-empty"; if (entry.includes("*")) return "is-unusual"; return "is-assigned"; }

function ReviewView({ copy, required, assigned, coverage, uncovered, acceptedCandidate, lateChange, publishedV2, printOpen, onResolve, onLateChange, onPublish, onPrint, onClosePrint }: { copy: Copy; required: number; assigned: number; coverage: number; uncovered: number; acceptedCandidate: Candidate; lateChange: boolean; publishedV2: boolean; printOpen: boolean; onResolve: () => void; onLateChange: () => void; onPublish: () => void; onPrint: () => void; onClosePrint: () => void }) {
  return <div className="bp-view bp-review-view"><PageIntro eyebrow="REVIEW & PUBLISH" title={copy.reviewTitle} description={copy.reviewDescription} aside={<span className="bp-version-badge">{publishedV2 ? "PUBLISHED · V2" : "PUBLISHED V1 · DRAFT"}</span>} />
    <div className="bp-review-hero"><div><span>COVERAGE</span><strong>{assigned} / {required}</strong><small>{coverage}% of required positions</small></div><div><span>STATUS</span><strong>{uncovered ? `${uncovered} position missing` : "Ready with warnings"}</strong><small>Draft · saved just now</small></div><div><span>PEOPLE</span><strong>34</strong><small>scheduled across the week</small></div></div>
    <div className="bp-review-columns"><section><header><p>NEEDS ATTENTION</p><b>{uncovered ? 4 : 3}</b></header>{uncovered ? <article className="is-conflict"><AlertTriangle /><div><strong>Sunday · SPA Spät missing 1</strong><span>12:00–20:30 · requirement not covered</span></div><button type="button" onClick={onResolve}>Assign</button></article> : null}<article className="is-conflict"><AlertTriangle /><div><strong>Victor · overlapping assignments</strong><span>Thursday · HD 09:00–17:30 and WW 12:00–16:00</span></div><button type="button">Resolve</button></article><article><AlertTriangle /><div><strong>Friday · CH skill mismatch</strong><span>The assigned person is not checker-qualified.</span></div><button type="button">Replace</button></article><article><Clock3 /><div><strong>Mihaela · requested Friday free</strong><span>WhatsApp request · not approved yet</span></div><button type="button">Review</button></article></section>
      <section><header><p>COVERAGE BY WORK</p><span>Required / assigned</span></header>{[["ROOM",22,22],["PF",13,14],["PS",13,13],["SPA",20,acceptedCandidate ? 20 : 19],["CH",3,3],["OTHER",27,27]].map(([code, need, has]) => <div className="bp-work-coverage" key={String(code)}><strong>{code}</strong><i><span style={{ width: `${Math.min(100, (Number(has) / Number(need)) * 100)}%` }} /></i><b>{has} / {need}</b></div>)}</section>
      <section><header><p>PLAN HISTORY</p><span>Published v1</span></header><div className="bp-change-line"><b>+{acceptedCandidate ? 1 : 0}</b><span>new assignment</span></div><div className="bp-change-line"><b>2</b><span>changed intervals</span></div><div className="bp-change-line"><b>−1</b><span>removed assignment</span></div>{!lateChange ? <button type="button" className="bp-secondary" onClick={onLateChange}>Simulate late hotel change</button> : null}</section></div>
    {lateChange ? <section className="bp-review-diff"><header><div><span>LATE HOTEL UPDATE · 14 AUG · 18:42</span><h2>Saturday ROOM starts one hour earlier.</h2></div><em>{publishedV2 ? "PUBLISHED V2" : "UNPUBLISHED CHANGE"}</em></header><div className="bp-version-diff"><section><p>PUBLISHED V1</p><strong>ROOM · SAT</strong><b>10:00</b><span>4 cleaners · LISTE at 09:45</span></section><div className="bp-diff-trace"><span>5 PEOPLE AFFECTED</span><i /><ArrowRight /></div><section className="is-current"><p>{publishedV2 ? "PUBLISHED V2" : "CHANGED DRAFT"}</p><strong>ROOM · SAT</strong><b>09:00</b><span>4 cleaners · LISTE at 08:45</span></section><aside><p>AFFECTED</p>{["Gabriela Tudor","Roxana Matei","Nicoleta Dobre","Larisa Enache","Elena Popescu · LISTE"].map((name) => <div key={name}><strong>{name}</strong><span>−1h start time</span></div>)}</aside></div><footer><span>{publishedV2 ? "v1 remains available in plan history." : "Only affected employees receive the updated plan."}</span>{publishedV2 ? <button type="button" onClick={onPrint}><Printer /> Print / share</button> : <button type="button" onClick={onPublish}>Publish v2 <ArrowRight /></button>}</footer></section> : null}
    {!lateChange ? <div className="bp-publish-bar"><span><b>{uncovered ? "Resolve the open position before publishing." : "Coverage complete."}</b> Warnings require acknowledgement.</span>{uncovered ? <button type="button" onClick={onResolve}>Resolve issues</button> : <button type="button" onClick={onLateChange}>Review late update <ArrowRight /></button>}</div> : null}
    {printOpen ? <PrintDialog onClose={onClosePrint} /> : null}
  </div>;
}

function PrintDialog({ onClose }: { onClose: () => void }) {
  return <div className="bp-print-overlay" role="dialog" aria-modal="true" aria-label="Print preview"><div className="bp-print-overlay-toolbar"><span>PRINT PREVIEW · A4 LANDSCAPE · V2</span><button type="button" onClick={onClose}><X /> Close</button><button type="button" onClick={() => window.print()}><Printer /> Print A4</button></div><section className="bp-paper business-print-root"><header><div><h2>PUIU GmbH · Hotel München</h2><p>Dienstplan · KW 33 · 10–16 August 2026</p></div><div><b>VERSION 2</b><span>Published 14 Aug 2026 · 19:04</span></div></header><table><thead><tr><th>Employee / role</th>{days.map((day) => <th key={day.short}>{day.short}<small>{day.date} AUG</small></th>)}</tr></thead><tbody>{team.map((person) => <tr key={person.name}><th>{person.name}<small>{person.role}</small></th>{person.week.map((entry,index) => <td key={`${person.name}-${index}`}><b>{entry.replace("!", "").replace("*", "")}</b><small>{entry.startsWith("ROOM") ? "09:00" : entry === "PF" ? "05:00–13:30" : entry === "PS" ? "13:30–22:00" : ""}</small></td>)}</tr>)}</tbody></table><footer><span><b>U</b> Urlaub</span><span><b>F</b> Frei</span><span><b>REQ</b> Requested free</span><span><b>ROOM 9</b> Room cleaning · 09:00</span><span><b>LISTE + OBJ</b> Assignment + responsibility</span></footer></section></div>;
}
