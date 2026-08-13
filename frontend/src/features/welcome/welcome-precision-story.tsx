import { useEffect, useRef, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

const WORKED_DAYS = new Set([
  3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 24, 25, 26,
  27, 28, 31,
]);

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const range = (progress: number, start: number, end: number) =>
  clamp((progress - start) / (end - start));
const mix = (start: number, end: number, progress: number) =>
  start + (end - start) * progress;

type StoryPhase = "day" | "transition" | "calendar" | "payslip" | "difference";

export function WelcomePrecisionStory() {
  const { t } = useTranslation("welcome");
  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const monthTotalRef = useRef<HTMLElement>(null);
  const phaseRef = useRef<StoryPhase>("day");

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const destination = destinationRef.current;
    const monthTotal = monthTotalRef.current;
    const scrollRoot = track?.closest<HTMLElement>("[data-testid='welcome-scroll']");
    if (!track || !stage || !destination || !monthTotal || !scrollRoot) return;

    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = (name: string, value: string | number) =>
      stage.style.setProperty(name, String(value));

    const render = () => {
      const rect = track.getBoundingClientRect();
      const travel = Math.max(1, track.offsetHeight - window.innerHeight);
      let progress = clamp(-rect.top / travel);
      if (reduced.matches) progress = progress < 0.3 ? 0 : progress < 0.7 ? 0.59 : 1;

      const dayExit = range(progress, 0.08, 0.17);
      const calendarReveal = range(progress, 0.18, 0.25);
      const flight = range(progress, 0.27, 0.43);
      const lock = range(progress, 0.43, 0.47);
      const provenanceHold = 1 - range(progress, 0.51, 0.55);
      const calendarCopy = range(progress, 0.48, 0.54);
      const calendarQuiet = range(progress, 0.61, 0.67);
      const recordReveal = range(progress, 0.65, 0.7);
      const documentReveal = range(progress, 0.7, 0.78);
      const valuesAlign = range(progress, 0.78, 0.84);
      const measureReveal = range(progress, 0.84, 0.9);
      const differenceReveal = range(progress, 0.91, 0.98);

      set("--pf-day", 1 - dayExit);
      set("--pf-calendar", calendarReveal);
      set("--pf-calendar-copy", calendarCopy);
      set("--pf-calendar-quiet", 1 - calendarQuiet * 0.88);
      set("--pf-record", recordReveal);
      set("--pf-document", documentReveal);
      set("--pf-align", valuesAlign);
      set("--pf-measure", measureReveal);
      set("--pf-reveal", differenceReveal);
      set("--pf-cells", lock);
      set("--pf-detail", Math.max(provenanceHold, 1 - lock));

      const stageRect = stage.getBoundingClientRect();
      const endRect = destination.getBoundingClientRect();
      const mobile = window.innerWidth < 768;
      const start = mobile
        ? { x: 20, y: Math.min(window.innerHeight - 175, 570), w: window.innerWidth - 40, h: 104 }
        : { x: stageRect.width * 0.51, y: stageRect.height - 176, w: stageRect.width * 0.43, h: 112 };
      const end = {
        x: endRect.left - stageRect.left,
        y: endRect.top - stageRect.top,
        w: endRect.width,
        h: endRect.height,
      };
      set("--pf-x", `${mix(start.x, end.x, flight)}px`);
      set("--pf-y", `${mix(start.y, end.y, flight)}px`);
      set("--pf-w", `${mix(start.w, end.w, flight)}px`);
      set("--pf-h", `${mix(start.h, end.h, flight)}px`);
      set("--pf-rotate", `${mix(-2.5, 0, lock)}deg`);

      monthTotal.textContent =
        progress < 0.52 ? "€2,730.00" : progress < 0.58 ? "+ €164.00" : "€2,894.00";

      let phase: StoryPhase = "day";
      if (progress >= 0.17 && progress < 0.48) phase = "transition";
      else if (progress >= 0.48 && progress < 0.64) phase = "calendar";
      else if (progress >= 0.64 && progress < 0.9) phase = "payslip";
      else if (progress >= 0.9) phase = "difference";
      if (phaseRef.current !== phase) {
        phaseRef.current = phase;
        stage.dataset.phase = phase;
      }
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    update();
    scrollRoot.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      scrollRoot.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  return (
    <section ref={trackRef} id="product-story" className="precision-flow-track" aria-label={t("motionIntegration.story.aria")}>
      <div ref={stageRef} className="precision-flow-stage" data-phase="day">
        <div className="precision-flow-grid" aria-hidden="true" />
        <div className="precision-flow-scene-copy" aria-live="polite">
          <p className="precision-flow-kicker">{t("motionIntegration.story.kicker")}</p>
          <h2 className="pf-copy-day">{t("motionIntegration.story.dayTitle")}</h2>
          <p className="pf-copy-day pf-human">{t("motionIntegration.story.dayBody")}</p>
          <h2 className="pf-copy-calendar">{t("motionIntegration.story.calendarTitle")}</h2>
          <p className="pf-copy-calendar pf-human">{t("motionIntegration.story.calendarBody")}</p>
          <h2 className="pf-copy-payslip">{t("motionIntegration.story.payslipTitle")}</h2>
          <p className="pf-copy-payslip pf-human">{t("motionIntegration.story.payslipBody")}</p>
          <h2 className="pf-copy-difference">{t("motionIntegration.story.differenceTitle")}</h2>
        </div>

        <div className="precision-flow-day" aria-label={t("motionIntegration.story.dayAria")}>
          <div className="pf-shift-title">
            <span aria-hidden="true">A</span>
            <div><small>{t("motionIntegration.story.regularShift")}</small><strong>08:00 <i>→</i> 16:30</strong></div>
          </div>
          <div className="pf-rule"><i /></div>
          <dl>
            <div><dt>{t("motionIntegration.story.worked")}</dt><dd>8h 00m</dd></div>
            <div><dt>{t("motionIntegration.story.break")}</dt><dd>30m</dd></div>
          </dl>
          <div className="pf-completed"><span>{t("motionIntegration.story.completed")}</span><strong>24 m²</strong><small>€4.00 / m²</small></div>
          <button type="button">+ {t("motionIntegration.story.addCompleted")}</button>
        </div>

        <div className="precision-flow-calendar" aria-label={t("motionIntegration.story.calendarAria")}>
          <div className="pf-calendar-head">
            <div><small>{t("motionIntegration.story.month")}</small><strong>{t("motionIntegration.story.monthRecord")}</strong></div>
            <div className="pf-month-total"><small>{t("motionIntegration.story.estimated")}</small><strong ref={monthTotalRef}>€2,730.00</strong></div>
          </div>
          <div className="pf-week" aria-hidden="true">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="pf-days">
            {Array.from({ length: 35 }, (_, index) => {
              const day = index + 1;
              const display = day <= 31 ? day : day - 31;
              const worked = day <= 31 && WORKED_DAYS.has(day);
              return <div key={day} ref={day === 11 ? destinationRef : undefined} className={`pf-cell ${worked ? "is-worked" : ""} ${day === 11 ? "is-destination" : ""}`}><span>{display}</span>{worked && day !== 11 ? <small>{day === 18 ? "24 m²" : day === 24 ? "Sick" : "7h"}</small> : null}</div>;
            })}
          </div>
          <div className="pf-month-foot"><span>19 {t("motionIntegration.story.days")}</span><span>168h</span><span>24 m²</span><span>2 {t("motionIntegration.story.absences")}</span></div>
        </div>

        <div className="precision-flow-comparison" aria-label={t("motionIntegration.story.comparisonAria")}>
          <div className="pf-record-value"><small>{t("motionIntegration.story.yourRecord")}</small><strong>€2,894.00</strong><span>{t("motionIntegration.story.includesDay")}</span></div>
          <div className="pf-delta-measure" aria-hidden="true"><i /><span /><b>€2,894 − €2,734</b><i /></div>
          <div className="pf-received-document"><div className="pf-document-head"><span>{t("motionIntegration.story.received")}</span><i /><span>{t("motionIntegration.story.august")}</span></div><small>{t("motionIntegration.story.payslipGross")}</small><strong>€2,734.00</strong><div className="pf-document-lines"><i /><i /><i /><i /></div></div>
          <div className="pf-difference"><small>{t("motionIntegration.story.possibleDifference")}</small><strong>Δ €160.00</strong><span>{t("motionIntegration.story.disclaimer")}</span></div>
        </div>

        <div className="precision-flow-object" aria-hidden="true"><small>{t("motionIntegration.story.dayEstimate")}</small><strong>€164.00</strong><span>11</span></div>
        <div className="precision-flow-footer" aria-hidden="true"><span>ALVERYN</span><i /><span>DAY 11 RECORD</span></div>
      </div>
    </section>
  );
}

export const precisionFlowInitialStyle = {
  "--pf-day": 1,
  "--pf-calendar": 0,
  "--pf-calendar-copy": 0,
  "--pf-calendar-quiet": 1,
  "--pf-record": 0,
  "--pf-document": 0,
  "--pf-align": 0,
  "--pf-measure": 0,
  "--pf-reveal": 0,
  "--pf-cells": 0,
  "--pf-detail": 1,
} as CSSProperties;
