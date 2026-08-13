import type { WorkType } from "../../types/configuration";
import type { WorkRecord, WorkRecordLine } from "../../types/work-record";
import { parseLocalIsoDate } from "../../utils/date";

const HISTORY_DAYS = 90;
const MIN_PATTERN_SAMPLES = 5;
const AMBIGUITY_RATIO = 0.85;
const TIME_TOLERANCE_MINUTES = 60;

type HistoricalLine = { line: WorkRecordLine; record: WorkRecord; ageInDays: number; sameWeekday: boolean };

export function recommendWorkType(records: WorkRecord[], workTypes: WorkType[], targetDate: string) {
  const history = eligibleHistory(records, workTypes, targetDate);
  const scores = new Map<string, number>();
  const counts = new Map<string, number>();

  history.forEach(({ line, ageInDays, sameWeekday }) => {
    counts.set(line.workTypeId, (counts.get(line.workTypeId) ?? 0) + 1);
    scores.set(
      line.workTypeId,
      (scores.get(line.workTypeId) ?? 0) + Math.exp(-ageInDays / 45) + (sameWeekday ? 0.8 : 0)
    );
  });

  const ranked = workTypes
    .filter((type) => type.active && (counts.get(type.id) ?? 0) >= MIN_PATTERN_SAMPLES)
    .sort((left, right) => (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0));
  const best = ranked[0] ?? null;
  if (!best) return null;

  const bestScore = scores.get(best.id) ?? 0;
  const runnerUpScore = ranked[1] ? scores.get(ranked[1].id) ?? 0 : 0;
  return runnerUpScore >= bestScore * AMBIGUITY_RATIO ? null : best;
}

export function recommendWorkEntry(records: WorkRecord[], workTypes: WorkType[], targetDate: string) {
  const workType = recommendWorkType(records, workTypes, targetDate);
  if (!workType) return null;

  const candidates = eligibleHistory(records, [workType], targetDate)
    .filter((item) => item.line.workTypeId === workType.id);
  const sameWeekday = candidates.filter((item) => item.sameWeekday);
  const comparable = sameWeekday.length >= MIN_PATTERN_SAMPLES ? sameWeekday : candidates;
  const pattern = stableLinePattern(comparable);
  if (!pattern) return null;

  return { workType, line: pattern.line, record: pattern.record };
}

function eligibleHistory(records: WorkRecord[], workTypes: WorkType[], targetDate: string): HistoricalLine[] {
  const target = parseLocalIsoDate(targetDate);
  const availableIds = new Set(workTypes.filter((type) => type.active).map((type) => type.id));
  return records.flatMap((record) => {
    const recordDate = parseLocalIsoDate(record.workDate);
    const ageInDays = Math.round((target.getTime() - recordDate.getTime()) / 86_400_000);
    if (ageInDays <= 0 || ageInDays > HISTORY_DAYS) return [];
    const seen = new Set<string>();
    return (record.workLines ?? []).flatMap((line) => {
      if (!availableIds.has(line.workTypeId) || seen.has(line.workTypeId)) return [];
      seen.add(line.workTypeId);
      return [{ line, record, ageInDays, sameWeekday: recordDate.getDay() === target.getDay() }];
    });
  });
}

function stableLinePattern(candidates: HistoricalLine[]) {
  const ranged = candidates.filter(({ line }) => line.startTime && line.endTime);
  if (ranged.length >= MIN_PATTERN_SAMPLES) {
    const cluster = densestCluster(ranged, (left, right) =>
      Math.max(
        circularMinuteDistance(timeMinutes(left.line.startTime!), timeMinutes(right.line.startTime!)),
        circularMinuteDistance(timeMinutes(left.line.endTime!), timeMinutes(right.line.endTime!))
      ) <= TIME_TOLERANCE_MINUTES);
    if (cluster.length < MIN_PATTERN_SAMPLES) return null;
    const start = median(cluster.map((item) => timeMinutes(item.line.startTime!)));
    const end = median(cluster.map((item) => timeMinutes(item.line.endTime!)));
    const breaks = median(cluster.map((item) => item.line.breakMinutes ?? 0));
    return synthesize(cluster, { startTime: minuteTime(start), endTime: minuteTime(end), breakMinutes: breaks, extraPayPercentage: 0 });
  }

  const durations = candidates.filter(({ line }) => line.durationMinutes != null && line.durationMinutes > 0);
  if (durations.length >= MIN_PATTERN_SAMPLES) {
    const cluster = densestCluster(durations, (left, right) =>
      Math.abs((left.line.durationMinutes ?? 0) - (right.line.durationMinutes ?? 0)) <= TIME_TOLERANCE_MINUTES);
    if (cluster.length < MIN_PATTERN_SAMPLES) return null;
    return synthesize(cluster, {
      durationMinutes: median(cluster.map((item) => item.line.durationMinutes ?? 0)),
      extraPayPercentage: 0
    });
  }

  const quantities = candidates.filter(({ line }) => line.quantity != null && Number(line.quantity) > 0);
  if (quantities.length >= MIN_PATTERN_SAMPLES) {
    const cluster = numericCluster(quantities, (item) => Number(item.line.quantity), 0.2);
    if (cluster.length < MIN_PATTERN_SAMPLES) return null;
    return synthesize(cluster, {
      quantity: String(roundUseful(median(cluster.map((item) => Number(item.line.quantity))))),
      extraPayPercentage: 0
    });
  }

  const fixed = candidates.filter(({ line }) => line.fixedAmountSnapshot != null && Number(line.fixedAmountSnapshot) > 0);
  if (fixed.length >= MIN_PATTERN_SAMPLES) {
    const cluster = numericCluster(fixed, (item) => Number(item.line.fixedAmountSnapshot), 0.1);
    if (cluster.length < MIN_PATTERN_SAMPLES) return null;
    return synthesize(cluster, {
      fixedAmountSnapshot: String(roundUseful(median(cluster.map((item) => Number(item.line.fixedAmountSnapshot))))),
      extraPayPercentage: 0
    });
  }

  return null;
}

function synthesize(cluster: HistoricalLine[], patch: Partial<WorkRecordLine>) {
  const representative = cluster.sort((left, right) => left.ageInDays - right.ageInDays)[0]!;
  const teamSizes = cluster.map((item) => item.record.teamSize).filter((value): value is number => value != null);
  return {
    line: { ...representative.line, ...patch },
    record: { ...representative.record, teamSize: mode(teamSizes) ?? null }
  };
}

function densestCluster<T>(items: T[], matches: (left: T, right: T) => boolean) {
  return items.reduce<T[]>((best, pivot) => {
    const cluster = items.filter((item) => matches(pivot, item));
    return cluster.length > best.length ? cluster : best;
  }, []);
}

function numericCluster<T>(items: T[], value: (item: T) => number, toleranceRatio: number) {
  return densestCluster(items, (left, right) => {
    const pivot = value(left);
    return Math.abs(pivot - value(right)) <= Math.max(1, Math.abs(pivot) * toleranceRatio);
  });
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function mode(values: number[]) {
  if (!values.length) return undefined;
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function timeMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minuteTime(value: number) {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}:00`;
}

function circularMinuteDistance(left: number, right: number) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 1440 - distance);
}

function roundUseful(value: number) {
  return Number(value.toFixed(2));
}
