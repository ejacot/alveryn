import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Moon,
  Printer,
  Settings,
  Sun,
  Users
} from "lucide-react";
import { AppLogo } from "../components/branding/app-logo";
import { applyAppTheme } from "../utils/theme";
import "../styles/business-planning-prototype.css";

type PrototypeView =
  | "demand"
  | "schedule"
  | "day"
  | "recommendation"
  | "review"
  | "versions"
  | "print";

type PrototypeLanguage = "EN" | "DE" | "RO" | "RU";

const prototypeCopy = {
  EN: {
    overview: "Overview", plan: "Plan", team: "Team", work: "Work", settings: "Settings", personal: "PERSONAL", myRecord: "My record", private: "Private",
    views: { demand: "Demand", schedule: "Schedule", day: "Mobile day", recommendation: "Recommendation", review: "Review", versions: "Versions", print: "Print" },
    demandTitle: "What does the hotel need this week?", demandDescription: "Enter the operational need. Alveryn turns it into positions the team can cover.", buildSchedule: "Build the schedule",
    scheduleTitle: "Build the week around the work.", scheduleDescription: "The plan stays familiar. Coverage and conflicts no longer live in the manager’s memory.", reviewPlan: "Review plan",
    dayTitle: "Saturday · 15 August", dayDescription: "The operational day, without squeezing a weekly spreadsheet onto a phone.",
    recommendTitle: "Who can cover SPA Spät?", recommendDescription: "Recommendations use only this Business workspace and always explain why.",
    reviewTitle: "Is the week ready?", reviewDescription: "Coverage, conflicts and changes are checked before the plan reaches the team.",
    versionTitle: "The hotel changed Saturday.", versionDescription: "The published plan stays intact while the manager reviews a precise new draft.",
    printTitle: "Familiar on paper. Smarter before it gets there.", printDescription: "A4 landscape keeps the weekly grid the team already understands."
  },
  DE: {
    overview: "Übersicht", plan: "Planung", team: "Team", work: "Arbeit", settings: "Einstellungen", personal: "PERSÖNLICH", myRecord: "Meine Erfassung", private: "Privat",
    views: { demand: "Bedarf", schedule: "Dienstplan", day: "Tagesansicht", recommendation: "Empfehlung", review: "Prüfen", versions: "Versionen", print: "Drucken" },
    demandTitle: "Was braucht das Hotel diese Woche?", demandDescription: "Erfasse den betrieblichen Bedarf. Alveryn macht daraus besetzbare Positionen.", buildSchedule: "Dienstplan erstellen",
    scheduleTitle: "Die Woche um die Arbeit planen.", scheduleDescription: "Der Plan bleibt vertraut. Abdeckung und Konflikte müssen nicht mehr im Kopf bleiben.", reviewPlan: "Plan prüfen",
    dayTitle: "Samstag · 15. August", dayDescription: "Der operative Tag, ohne eine ganze Wochentabelle aufs Handy zu pressen.",
    recommendTitle: "Wer kann SPA Spät übernehmen?", recommendDescription: "Empfehlungen nutzen nur diesen Business-Bereich und erklären immer warum.",
    reviewTitle: "Ist die Woche bereit?", reviewDescription: "Abdeckung, Konflikte und Änderungen werden vor der Veröffentlichung geprüft.",
    versionTitle: "Das Hotel hat Samstag geändert.", versionDescription: "Der veröffentlichte Plan bleibt erhalten, während ein neuer Entwurf geprüft wird.",
    printTitle: "Vertraut auf Papier. Klarer vor dem Druck.", printDescription: "A4 quer erhält den Wochenplan, den das Team bereits kennt."
  },
  RO: {
    overview: "Prezentare", plan: "Plan", team: "Echipă", work: "Muncă", settings: "Setări", personal: "PERSONAL", myRecord: "Evidența mea", private: "Privat",
    views: { demand: "Necesar", schedule: "Program", day: "Ziua pe mobil", recommendation: "Recomandare", review: "Verificare", versions: "Versiuni", print: "Tipărire" },
    demandTitle: "De ce are nevoie hotelul săptămâna aceasta?", demandDescription: "Introdu necesarul operațional. Alveryn îl transformă în poziții pe care echipa le poate acoperi.", buildSchedule: "Construiește programul",
    scheduleTitle: "Construiește săptămâna în jurul muncii.", scheduleDescription: "Planul rămâne familiar. Acoperirea și conflictele nu mai rămân în memoria managerului.", reviewPlan: "Verifică planul",
    dayTitle: "Sâmbătă · 15 august", dayDescription: "Ziua operațională, fără a micșora un tabel săptămânal pe telefon.",
    recommendTitle: "Cine poate acoperi SPA Spät?", recommendDescription: "Recomandările folosesc numai acest spațiu Business și explică întotdeauna motivul.",
    reviewTitle: "Este săptămâna pregătită?", reviewDescription: "Acoperirea, conflictele și modificările sunt verificate înainte de publicare.",
    versionTitle: "Hotelul a modificat sâmbăta.", versionDescription: "Planul publicat rămâne intact cât timp managerul verifică noul draft.",
    printTitle: "Familiar pe hârtie. Mai clar înainte de tipărire.", printDescription: "Formatul A4 landscape păstrează programul săptămânal cunoscut de echipă."
  },
  RU: {
    overview: "Обзор", plan: "План", team: "Команда", work: "Работа", settings: "Настройки", personal: "ЛИЧНОЕ", myRecord: "Мой учёт", private: "Личное",
    views: { demand: "Потребность", schedule: "График", day: "День", recommendation: "Рекомендация", review: "Проверка", versions: "Версии", print: "Печать" },
    demandTitle: "Что нужно отелю на этой неделе?", demandDescription: "Укажите рабочую потребность. Alveryn превратит её в позиции для команды.", buildSchedule: "Создать график",
    scheduleTitle: "Постройте неделю вокруг работы.", scheduleDescription: "План остаётся знакомым. Покрытие и конфликты больше не нужно держать в памяти.", reviewPlan: "Проверить план",
    dayTitle: "Суббота · 15 августа", dayDescription: "Рабочий день без уменьшенной недельной таблицы на экране телефона.",
    recommendTitle: "Кто может закрыть SPA Spät?", recommendDescription: "Рекомендации используют только это Business-пространство и всегда объясняют причину.",
    reviewTitle: "Неделя готова?", reviewDescription: "Покрытие, конфликты и изменения проверяются до публикации.",
    versionTitle: "Отель изменил субботу.", versionDescription: "Опубликованный план остаётся прежним, пока менеджер проверяет новый черновик.",
    printTitle: "Знакомо на бумаге. Точнее до печати.", printDescription: "Альбомный A4 сохраняет привычную для команды недельную сетку."
  }
} as const;

type PrototypeCopy = (typeof prototypeCopy)[PrototypeLanguage];

type DemandRow = {
  code: string;
  label: string;
  interval: string;
  values: number[];
  source?: "hotel" | "demo";
};

type TeamMember = {
  name: string;
  role: string;
  skills: string[];
  hours: number;
  week: string[];
};

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

const names = [
  ["Elena Popescu", "LISTE", ["LISTE", "OBJ"]],
  ["Sebastian Marin", "PF", ["PF", "PS"]],
  ["Mihaela Radu", "PF", ["PF", "PS"]],
  ["Daniel Ionescu", "PS", ["PS", "PF"]],
  ["Ana Dumitru", "SPA", ["SPA F", "SPA S"]],
  ["Mara Klein", "SPA", ["SPA F", "SPA S"]],
  ["Sofia Werner", "SPA", ["SPA F", "SPA S"]],
  ["Victor Pavel", "HD", ["HD", "WW"]],
  ["Andrei Munteanu", "WW", ["WW", "HD"]],
  ["Irina Stoica", "HSK", ["HSK", "PS"]],
  ["Klara Hoffmann", "HSK", ["HSK", "LISTE"]],
  ["Nina Wolf", "HSK", ["HSK", "PS"]],
  ["Maria Neagu", "CH", ["CH", "ROOM"]],
  ["Ioana Stan", "CH", ["CH", "ROOM"]],
  ["Cristina Lupu", "CH", ["CH", "ROOM"]],
  ["Lea Bauer", "CH", ["CH", "ROOM", "LISTE"]],
  ["Alina Petrescu", "ROOM", ["ROOM", "WW"]],
  ["Gabriela Tudor", "ROOM", ["ROOM"]],
  ["Roxana Matei", "ROOM", ["ROOM"]],
  ["Nicoleta Dobre", "ROOM", ["ROOM"]],
  ["Larisa Enache", "ROOM", ["ROOM"]],
  ["Simona Oprea", "ROOM", ["ROOM"]],
  ["Daniela Nistor", "ROOM", ["ROOM"]],
  ["Monica Ilie", "ROOM", ["ROOM"]],
  ["Adriana Barbu", "ROOM", ["ROOM"]],
  ["Oana Sandu", "ROOM", ["ROOM"]],
  ["Camelia Voicu", "ROOM", ["ROOM"]],
  ["Florentina Ene", "ROOM", ["ROOM"]],
  ["Claudia Serban", "ROOM", ["ROOM"]],
  ["Sorina Georgescu", "ROOM", ["ROOM"]],
  ["Loredana Popa", "ROOM", ["ROOM"]],
  ["Iulia Grigore", "ROOM", ["ROOM"]],
  ["Mirela Rusu", "ROOM", ["ROOM"]],
  ["Bianca Pavel", "ROOM", ["ROOM"]]
] as const;

const team: TeamMember[] = names.map(([name, role, skills], index) => {
  const patterns: Record<string, string[]> = {
    PF: ["PF", "PF", "PF", "PF", "REQ", "F", "F"],
    PS: ["PS", "PS", "PS", "PS", "PS", "F", "F"],
    SPA: ["SPA F", "SPA F", "SPA F", "SPA S", "SPA S", "SPA S", "—"],
    HD: ["HD", "HD", "HD + WW", "HD", "HD", "HD", "F"],
    WW: ["WW", "WW", "WW", "WW", "WW", "WW", "F"],
    HSK: ["HSK", "HSK", "HSK", "HSK", "HSK", "HSK", "F"],
    CH: ["ROOM 9", "ROOM 9", "ROOM 9", "CH", "CH", "CH", "F"],
    LISTE: ["U", "U", "U", "LISTE + OBJ", "LISTE + OBJ", "LISTE + OBJ", "F"],
    ROOM: ["ROOM 9", "ROOM 9", "ROOM 9", "ROOM 9", "ROOM 9", "ROOM 10", "F"]
  };
  const week = [...(patterns[role] ?? patterns.ROOM)];
  if (name === "Daniel Ionescu") week[1] = "REQ";
  if (name === "Sorina Georgescu") week[5] = "F";
  if (name === "Alina Petrescu") week[3] = "WW*";
  if (name === "Victor Pavel") week[3] = "HD + WW!";
  return { name, role, skills: [...skills], hours: 24 + (index % 5) * 4, week };
});

const viewLabels: Array<{ id: PrototypeView; label: string }> = [
  { id: "demand", label: "Demand" },
  { id: "schedule", label: "Schedule" },
  { id: "day", label: "Mobile day" },
  { id: "recommendation", label: "Recommendation" },
  { id: "review", label: "Review" },
  { id: "versions", label: "Versions" },
  { id: "print", label: "Print" }
];

function totalRequired(rows: DemandRow[]) {
  return rows.reduce((total, row) => total + row.values.reduce((sum, value) => sum + value, 0), 0);
}

export function BusinessPlanningPrototypePage() {
  const previewParams = new URLSearchParams(window.location.search);
  const requestedView = previewParams.get("view") as PrototypeView | null;
  const initialView = viewLabels.some((item) => item.id === requestedView) ? requestedView! : "demand";
  const requestedTheme = previewParams.get("theme");
  const [view, setView] = useState<PrototypeView>(initialView);
  const [demand, setDemand] = useState(baseDemand);
  const [selectedDay, setSelectedDay] = useState(5);
  const [acceptedSuggestion, setAcceptedSuggestion] = useState(false);
  const [manualSelection, setManualSelection] = useState(false);
  const [lateChange, setLateChange] = useState(false);
  const [publishedV2, setPublishedV2] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(
    requestedTheme === "dark" || requestedTheme === "light"
      ? requestedTheme
      : document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );
  const requestedLanguage = previewParams.get("lang")?.toUpperCase() as PrototypeLanguage | undefined;
  const [language, setLanguage] = useState<PrototypeLanguage>(requestedLanguage && requestedLanguage in prototypeCopy ? requestedLanguage : "EN");
  const copy = prototypeCopy[language];

  const required = totalRequired(demand) + (lateChange ? 1 : 0);
  const assigned = Math.min(required + 1, 97 + (acceptedSuggestion || manualSelection ? 1 : 0));
  const uncovered = Math.max(0, required - assigned);
  const coverage = Math.round((assigned / required) * 100);
  const dayTotals = useMemo(
    () => days.map((_, dayIndex) => demand.reduce((sum, row) => sum + row.values[dayIndex], 0) + (lateChange && dayIndex === 5 ? 1 : 0)),
    [demand, lateChange]
  );

  const changeDemand = (rowIndex: number, dayIndex: number, delta: number) => {
    setDemand((current) => current.map((row, index) => index === rowIndex
      ? { ...row, values: row.values.map((value, day) => day === dayIndex ? Math.max(0, value + delta) : value) }
      : row));
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyAppTheme(next === "dark" ? "DARK" : "LIGHT");
  };

  return (
    <main className="business-prototype" data-theme={theme} data-testid="business-planning-prototype" lang={language.toLowerCase()}>
      <header className="bp-topbar">
        <div className="bp-brand"><AppLogo wordmark /></div>
        <button type="button" className="bp-workspace" aria-label="Change workspace">
          <span><small>BUSINESS</small><strong>PUIU GmbH</strong></span><ChevronDown aria-hidden="true" />
        </button>
        <div className="bp-context">
          <span>Hotel München</span><i /> <strong>KW 33 · 10–16 AUG 2026</strong><em>DEMO</em>
        </div>
        <div className="bp-tools">
          <label><span className="sr-only">Language</span><select value={language} onChange={(event) => setLanguage(event.target.value as PrototypeLanguage)}><option>EN</option><option>DE</option><option>RO</option><option>RU</option></select></label>
          <button type="button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}>
            {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </button>
        </div>
      </header>

      <aside className="bp-sidebar" aria-label="Business navigation">
        <nav>
          <button type="button"><BriefcaseBusiness /><span>{copy.overview}</span></button>
          <button type="button" className="is-active"><CalendarDays /><span>{copy.plan}</span></button>
          <button type="button"><Users /><span>{copy.team}</span></button>
          <button type="button"><ClipboardList /><span>{copy.work}</span></button>
          <button type="button"><Settings /><span>{copy.settings}</span></button>
        </nav>
        <div className="bp-personal-switch"><small>{copy.personal}</small><strong>{copy.myRecord}</strong><span>{copy.private}</span></div>
      </aside>

      <section className="bp-main">
        <div className="bp-stage-nav" aria-label="Prototype screens">
          {viewLabels.map((item) => (
            <button type="button" key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => setView(item.id)}>{copy.views[item.id]}</button>
          ))}
        </div>

        {view === "demand" ? (
          <DemandView copy={copy} demand={demand} required={required} dayTotals={dayTotals} onChange={changeDemand} onContinue={() => setView("schedule")} />
        ) : null}
        {view === "schedule" ? (
          <ScheduleView copy={copy} required={required} assigned={assigned} uncovered={uncovered} onRecommend={() => setView("recommendation")} onReview={() => setView("review")} />
        ) : null}
        {view === "day" ? (
          <MobileDayView copy={copy} selectedDay={selectedDay} setSelectedDay={setSelectedDay} uncovered={uncovered} onRecommend={() => setView("recommendation")} />
        ) : null}
        {view === "recommendation" ? (
          <RecommendationView copy={copy} accepted={acceptedSuggestion} manual={manualSelection} onAccept={() => { setAcceptedSuggestion(true); setManualSelection(false); }} onManual={() => { setAcceptedSuggestion(false); setManualSelection(true); }} onBack={() => setView("schedule")} />
        ) : null}
        {view === "review" ? (
          <ReviewView copy={copy} required={required} assigned={assigned} coverage={coverage} uncovered={uncovered} accepted={acceptedSuggestion} manual={manualSelection} onResolve={() => setView("recommendation")} onVersions={() => setView("versions")} />
        ) : null}
        {view === "versions" ? (
          <VersionsView copy={copy} lateChange={lateChange} published={publishedV2} onLateChange={() => setLateChange(true)} onPublish={() => setPublishedV2(true)} onPrint={() => setView("print")} />
        ) : null}
        {view === "print" ? <PrintView copy={copy} onBack={() => setView("versions")} /> : null}
      </section>
    </main>
  );
}

function PageIntro({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return <header className="bp-page-intro"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{aside}</header>;
}

function DemandView({ copy, demand, required, dayTotals, onChange, onContinue }: { copy: PrototypeCopy; demand: DemandRow[]; required: number; dayTotals: number[]; onChange: (row: number, day: number, delta: number) => void; onContinue: () => void }) {
  const [mobileDay, setMobileDay] = useState(0);
  return <div className="bp-view bp-demand-view">
    <PageIntro eyebrow="PLAN · DEMAND" title={copy.demandTitle} description={copy.demandDescription} aside={<div className="bp-save-state"><Check /> Draft saved</div>} />
    <div className="bp-demand-layout">
      <section className="bp-matrix-wrap" aria-label="Weekly staffing demand">
        <div className="bp-demand-actions"><button type="button">Copy previous week</button><button type="button">Apply activity to days</button><span>Hotel source + <b>demo estimates</b></span></div>
        <div className="bp-demand-matrix">
          <div className="bp-matrix-corner"><strong>WORK</strong><span>Default interval</span></div>
          {days.map((day) => <div className="bp-matrix-day" key={day.short}><small>{day.short}</small><strong>{day.date}</strong><span>{day.rooms} rooms</span></div>)}
          {demand.map((row, rowIndex) => <div className="bp-demand-row" key={row.code}>
            <div className="bp-demand-label"><strong>{row.code}</strong><span>{row.label}</span><small>{row.interval} · {row.source === "hotel" ? "HOTEL" : "DEMO"}</small></div>
            {row.values.map((value, dayIndex) => <div className="bp-demand-cell" key={`${row.code}-${dayIndex}`}>
              <button type="button" aria-label={`Reduce ${row.label} on ${days[dayIndex].short}`} onClick={() => onChange(rowIndex, dayIndex, -1)}>−</button>
              <strong>{value}</strong>
              <button type="button" aria-label={`Increase ${row.label} on ${days[dayIndex].short}`} onClick={() => onChange(rowIndex, dayIndex, 1)}>+</button>
              {row.code === "ROOM" ? <small>{days[dayIndex].start}</small> : null}
            </div>)}
          </div>)}
        </div>
        <div className="bp-mobile-demand">
          <div className="bp-day-picker">{days.map((day, index) => <button type="button" key={day.short} className={mobileDay === index ? "is-active" : ""} onClick={() => setMobileDay(index)}><small>{day.short}</small><b>{day.date}</b></button>)}</div>
          <header><div><span>{days[mobileDay].rooms} ROOMS</span><strong>{dayTotals[mobileDay]} positions</strong></div><small>ROOM starts {days[mobileDay].start}</small></header>
          {demand.map((row, rowIndex) => <div className="bp-mobile-demand-row" key={row.code}><span><b>{row.code}</b><small>{row.label} · {row.interval}</small></span><div><button type="button" aria-label={`Reduce ${row.label} on ${days[mobileDay].short}`} onClick={() => onChange(rowIndex, mobileDay, -1)}>−</button><strong>{row.values[mobileDay]}</strong><button type="button" aria-label={`Increase ${row.label} on ${days[mobileDay].short}`} onClick={() => onChange(rowIndex, mobileDay, 1)}>+</button></div></div>)}
        </div>
        <p className="bp-demand-note"><b>Sunday note</b> · Stayover rooms and strip departure beds.</p>
      </section>
      <aside className="bp-position-rail">
        <p>POSITIONS CREATED</p><strong>{required}</strong><span>required this week</span>
        {days.map((day, index) => <div key={day.short}><b>{day.short}</b><span>{dayTotals[index]} positions</span><i style={{ "--coverage": `${(dayTotals[index] / 16) * 100}%` } as CSSProperties} /></div>)}
        <button type="button" onClick={onContinue}>{copy.buildSchedule} <ArrowRight /></button>
      </aside>
    </div>
  </div>;
}

function Coverage({ required, assigned }: { required: number; assigned: number }) {
  const value = Math.min(100, Math.round((assigned / required) * 100));
  return <div className="bp-coverage"><div><span>WEEK COVERAGE</span><strong>{value}%</strong></div><div className="bp-coverage-line"><i style={{ width: `${value}%` }} /></div><small>{assigned} of {required} required positions covered</small></div>;
}

function ScheduleView({ copy, required, assigned, uncovered, onRecommend, onReview }: { copy: PrototypeCopy; required: number; assigned: number; uncovered: number; onRecommend: () => void; onReview: () => void }) {
  return <div className="bp-view bp-schedule-view">
    <PageIntro eyebrow="PLAN · SCHEDULE" title={copy.scheduleTitle} description={copy.scheduleDescription} aside={<button type="button" className="bp-primary" onClick={onReview}>{copy.reviewPlan} <ArrowRight /></button>} />
    <Coverage required={required} assigned={assigned} />
    <div className="bp-schedule-layout">
      <aside className="bp-needed-rail"><p>STILL NEEDED</p><strong>{uncovered}</strong><span>open positions</span>
        <button type="button" onClick={onRecommend}><b>SPA S · SUN</b><span>12:00–20:30</span><em>1 person</em></button>
        <div className="bp-overstaffed"><b>PF · WED</b><span>Overstaffed by 1</span></div>
      </aside>
      <section className="bp-grid-panel" aria-label="Employee weekly schedule">
        <div className="bp-grid-toolbar"><span>Hotel München · All teams</span><span><kbd>⌘Z</kbd> Undo</span><button type="button">Codes & shortcuts</button></div>
        <div className="bp-schedule-grid" role="grid">
          <div className="bp-employee-head">EMPLOYEE <span>34 PEOPLE</span></div>
          {days.map((day) => <div className="bp-schedule-day-head" key={day.short}><b>{day.short}</b><span>{day.date} AUG</span></div>)}
          {team.map((person) => <div className="bp-team-row" role="row" key={person.name}>
            <div className="bp-employee"><strong>{person.name}</strong><span>{person.role} · {person.hours}h</span></div>
            {person.week.map((entry, index) => <button type="button" role="gridcell" className={cellClass(entry)} key={`${person.name}-${index}`} aria-label={`${person.name}, ${days[index].short}: ${entry}`}>
              <b>{entry}</b>{entry.startsWith("ROOM") ? <small>{entry.endsWith("10") ? "10:00" : "09:00"}</small> : null}
            </button>)}
          </div>)}
        </div>
      </section>
      <aside className="bp-inspector"><p>NEEDS ATTENTION</p><div><AlertTriangle /><strong>2 conflicts</strong><span>Victor has overlapping work on Thursday.</span><button type="button">Review conflict</button></div><div><AlertTriangle /><strong>Skill mismatch</strong><span>Friday checker is not CH-qualified.</span><button type="button">Choose another person</button></div></aside>
    </div>
    <div className="bp-mobile-switch"><button type="button" onClick={() => window.scrollTo({ top: 0 })}>Day view available on mobile</button></div>
  </div>;
}

function cellClass(entry: string) {
  if (entry === "U") return "is-vacation";
  if (entry === "F") return "is-free";
  if (entry === "REQ") return "is-requested";
  if (entry.includes("!")) return "has-conflict";
  if (entry === "—") return "is-empty";
  if (entry.includes("*")) return "is-unusual";
  return "is-assigned";
}

function MobileDayView({ copy, selectedDay, setSelectedDay, uncovered, onRecommend }: { copy: PrototypeCopy; selectedDay: number; setSelectedDay: (day: number) => void; uncovered: number; onRecommend: () => void }) {
  return <div className="bp-view bp-day-view">
    <PageIntro eyebrow="MOBILE MANAGER" title={copy.dayTitle} description={copy.dayDescription} />
    <div className="bp-day-picker">{days.map((day, index) => <button type="button" key={day.short} className={selectedDay === index ? "is-active" : ""} onClick={() => setSelectedDay(index)}><small>{day.short}</small><b>{day.date}</b></button>)}</div>
    <Coverage required={16} assigned={15} />
    <section className="bp-mobile-day-content">
      <div className="bp-day-stat"><span>ROOMS</span><strong>50</strong><small>start 10:00</small></div>
      <div className="bp-day-stat"><span>REQUIRED</span><strong>16</strong><small>across 10 work types</small></div>
      <div className="bp-day-stat is-alert"><span>STILL NEEDED</span><strong>{Math.max(1, uncovered)}</strong><small>SPA Spät</small></div>
      <div className="bp-mobile-section"><header><p>ASSIGNED PEOPLE</p><span>15 / 16</span></header>{team.slice(0, 6).map((person) => <button type="button" key={person.name}><span><strong>{person.name}</strong><small>{person.week[5]}</small></span><em>{person.role}</em></button>)}</div>
      <div className="bp-mobile-section"><header><p>NEEDS ATTENTION</p><span>2</span></header><button type="button" className="has-warning"><span><strong>ROOM begins at 10:00</strong><small>4 assigned cleaners</small></span><AlertTriangle /></button><button type="button" className="has-warning"><span><strong>Sorina Georgescu · F</strong><small>Rest day — do not assign</small></span><AlertTriangle /></button></div>
      <button type="button" className="bp-primary bp-mobile-assign" onClick={onRecommend}>Fill open position <ArrowRight /></button>
    </section>
  </div>;
}

function RecommendationView({ copy, accepted, manual, onAccept, onManual, onBack }: { copy: PrototypeCopy; accepted: boolean; manual: boolean; onAccept: () => void; onManual: () => void; onBack: () => void }) {
  return <div className="bp-view bp-recommend-view">
    <button type="button" className="bp-back" onClick={onBack}><ArrowLeft /> Back to schedule</button>
    <PageIntro eyebrow="OPEN POSITION · SUNDAY" title={copy.recommendTitle} description={copy.recommendDescription} />
    <div className="bp-recommend-layout">
      <section className="bp-open-position"><p>SPA SPÄT</p><strong>12:00 → 20:30</strong><span>Sunday · 16 August</span><div><b>1 person</b><small>still needed</small></div></section>
      <section className="bp-candidates">
        <p>RECOMMENDED</p>
        <article className={accepted ? "is-accepted" : ""}><header><div className="bp-avatar">AD</div><div><strong>Ana Dumitru</strong><span>SPA · 24h this week</span></div><em>BEST FIT</em></header><ul><li><Check /> Usually works SPA Spät</li><li><Check /> Available 12:00–20:30</li><li><Check /> No conflicting assignment</li></ul><button type="button" onClick={onAccept}>{accepted ? <><Check /> Assigned to Sunday</> : "Accept suggestion"}</button></article>
        <article><header><div className="bp-avatar">MW</div><div><strong>Mara Klein</strong><span>SPA · 32h this week</span></div></header><ul><li><Check /> Has worked SPA Spät before</li><li><AlertTriangle /> Would reach 40h this week</li></ul><button type="button" onClick={onManual}>{manual ? <><Check /> Selected manually</> : "Reject suggestion · choose Mara"}</button></article>
        <div className="bp-decision-log"><span>ROOM · SAT</span><strong>Suggestion rejected</strong><small>Loredana Popa selected manually · manager decision</small></div>
      </section>
      <aside className="bp-recommend-policy"><p>WHY NOT OTHERS?</p><div><strong>Sofia Werner</strong><span>Vacation · Sunday</span></div><div><strong>Irina Stoica</strong><span>Already assigned HSK</span></div><small>No hidden score. The manager keeps the final decision.</small></aside>
    </div>
  </div>;
}

function ReviewView({ copy, required, assigned, coverage, uncovered, accepted, manual, onResolve, onVersions }: { copy: PrototypeCopy; required: number; assigned: number; coverage: number; uncovered: number; accepted: boolean; manual: boolean; onResolve: () => void; onVersions: () => void }) {
  return <div className="bp-view bp-review-view">
    <PageIntro eyebrow="REVIEW & PUBLISH" title={copy.reviewTitle} description={copy.reviewDescription} />
    <div className="bp-review-hero"><div><span>COVERAGE</span><strong>{assigned} / {required}</strong><small>{coverage}% of required positions</small></div><div><span>STATUS</span><strong>{uncovered === 0 ? "Ready with warnings" : `${uncovered} position${uncovered === 1 ? "" : "s"} missing`}</strong><small>Draft · saved just now</small></div><div><span>PEOPLE</span><strong>34</strong><small>scheduled across the week</small></div></div>
    <div className="bp-review-columns">
      <section><header><p>NEEDS ATTENTION</p><b>3</b></header><article className="is-conflict"><AlertTriangle /><div><strong>Victor · overlapping assignments</strong><span>Thursday · HD 09:00–17:30 and WW 12:00–16:00</span></div><button type="button">Resolve</button></article><article><AlertTriangle /><div><strong>Friday · CH skill mismatch</strong><span>The assigned person is not checker-qualified.</span></div><button type="button">Replace</button></article><article><Clock3 /><div><strong>Mihaela · requested Friday free</strong><span>WhatsApp request · not approved yet</span></div><button type="button">Review</button></article></section>
      <section><header><p>COVERAGE BY WORK</p><span>Required / assigned</span></header>{[["ROOM",22,22],["PF",13,14],["PS",13,13],["SPA",20,accepted || manual ? 20 : 19],["CH",3,3],["OTHER",27,27]].map(([code, need, has]) => <div className="bp-work-coverage" key={String(code)}><strong>{code}</strong><i><span style={{ width: `${Math.min(100, (Number(has) / Number(need)) * 100)}%` }} /></i><b>{has} / {need}</b></div>)}</section>
      <section><header><p>CHANGES IN THIS DRAFT</p><span>Since v1</span></header><div className="bp-change-line"><b>+6</b><span>new assignments</span></div><div className="bp-change-line"><b>2</b><span>changed intervals</span></div><div className="bp-change-line"><b>−1</b><span>removed assignment</span></div><button type="button" className="bp-secondary" onClick={onVersions}>Review version changes</button></section>
    </div>
    <div className="bp-publish-bar"><span><b>{uncovered ? "Resolve the open position before publishing." : "Coverage complete."}</b> Warnings require acknowledgement.</span>{uncovered ? <button type="button" onClick={onResolve}>Resolve issues</button> : <button type="button" onClick={onVersions}>Continue to publish <ArrowRight /></button>}</div>
  </div>;
}

function VersionsView({ copy, lateChange, published, onLateChange, onPublish, onPrint }: { copy: PrototypeCopy; lateChange: boolean; published: boolean; onLateChange: () => void; onPublish: () => void; onPrint: () => void }) {
  return <div className="bp-view bp-version-view">
    <PageIntro eyebrow="PLAN HISTORY" title={published ? "Published v2." : copy.versionTitle} description={copy.versionDescription} aside={<span className="bp-version-badge">{published ? "PUBLISHED · V2" : "PUBLISHED V1 · DRAFT CHANGES"}</span>} />
    {!lateChange ? <section className="bp-late-change"><p>LATE HOTEL UPDATE · 14 AUG · 18:42</p><h2>Saturday ROOM now starts at 09:00.</h2><span>Previously 10:00 · 50 rooms · 4 cleaners</span><button type="button" onClick={onLateChange}>Apply change to a new draft <ArrowRight /></button></section> : <div className="bp-version-diff">
      <section><p>PUBLISHED V1</p><strong>ROOM · SAT</strong><b>10:00</b><span>4 cleaners · LISTE at 09:45</span><small>Published 13 Aug · 17:10</small></section>
      <div className="bp-diff-trace"><span>5 PEOPLE AFFECTED</span><i /><ArrowRight /></div>
      <section className="is-current"><p>{published ? "PUBLISHED V2" : "CHANGED DRAFT"}</p><strong>ROOM · SAT</strong><b>09:00</b><span>4 cleaners · LISTE at 08:45</span><small>{published ? "Published 14 Aug · 19:04" : "Unpublished changes · 5"}</small></section>
      <aside><p>AFFECTED</p>{["Gabriela Tudor","Roxana Matei","Nicoleta Dobre","Larisa Enache","Elena Popescu · LISTE"].map((name) => <div key={name}><strong>{name}</strong><span>−1h start time</span></div>)}</aside>
    </div>}
    {lateChange ? <div className="bp-version-actions"><span>{published ? "v1 remains available in plan history." : "Only affected employees will receive the updated plan."}</span>{published ? <button type="button" onClick={onPrint}><Printer /> Open print preview</button> : <button type="button" onClick={onPublish}>Publish v2 <ArrowRight /></button>}</div> : null}
  </div>;
}

function PrintView({ copy, onBack }: { copy: PrototypeCopy; onBack: () => void }) {
  return <div className="bp-view bp-print-view">
    <PageIntro eyebrow="SHARE & PRINT" title={copy.printTitle} description={copy.printDescription} aside={<button type="button" className="bp-primary" onClick={() => window.print()}><Printer /> Print A4</button>} />
    <div className="bp-print-toolbar"><button type="button" onClick={onBack}><ArrowLeft /> Back to version</button><span>PDF · A4 landscape · v2</span></div>
    <section className="bp-paper business-print-root">
      <header><div><h2>PUIU GmbH · Hotel München</h2><p>Dienstplan · KW 33 · 10–16 August 2026</p></div><div><b>VERSION 2</b><span>Published 14 Aug 2026 · 19:04</span></div></header>
      <table><thead><tr><th>Employee / role</th>{days.map((day) => <th key={day.short}>{day.short}<small>{day.date} AUG</small></th>)}</tr></thead><tbody>{team.slice(0, 16).map((person) => <tr key={person.name}><th>{person.name}<small>{person.role}</small></th>{person.week.map((entry,index) => <td key={`${person.name}-${index}`}><b>{entry.replace("!", "").replace("*", "")}</b><small>{entry.startsWith("ROOM") ? (index === 5 ? "09:00" : "09:00") : entry === "PF" ? "05:00–13:30" : entry === "PS" ? "13:30–22:00" : ""}</small></td>)}</tr>)}</tbody></table>
      <footer><span><b>U</b> Urlaub</span><span><b>F</b> Frei</span><span><b>ROOM 9</b> Room cleaning · 09:00</span><span><b>LISTE + OBJ</b> Main assignment + responsibility</span></footer>
    </section>
  </div>;
}
