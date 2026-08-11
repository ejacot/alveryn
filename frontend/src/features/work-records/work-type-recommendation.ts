import type { WorkType } from "../../types/configuration";
import type { WorkRecord } from "../../types/work-record";
import { parseLocalIsoDate } from "../../utils/date";

export function recommendWorkType(
  records: WorkRecord[],
  workTypes: WorkType[],
  targetDate: string
) {
  const target = parseLocalIsoDate(targetDate);
  const availableIds = new Set(workTypes.filter((type) => type.active).map((type) => type.id));
  const scores = new Map<string, number>();

  records.forEach((record) => {
    const recordDate = parseLocalIsoDate(record.workDate);
    const ageInDays = Math.round((target.getTime() - recordDate.getTime()) / 86_400_000);
    if (ageInDays <= 0 || ageInDays > 90) return;

    const recencyWeight = Math.exp(-ageInDays / 45);
    const weekdayWeight = recordDate.getDay() === target.getDay() ? 0.8 : 0;
    const usedTypeIds = new Set((record.workLines ?? []).map((line) => line.workTypeId));

    usedTypeIds.forEach((workTypeId) => {
      if (!availableIds.has(workTypeId)) return;
      scores.set(workTypeId, (scores.get(workTypeId) ?? 0) + recencyWeight + weekdayWeight);
    });
  });

  const ranked = workTypes
    .filter((type) => availableIds.has(type.id))
    .sort((left, right) => (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0));
  const bestMatch = ranked[0] ?? null;

  return bestMatch && (scores.get(bestMatch.id) ?? 0) > 0 ? bestMatch : null;
}

export function recommendWorkEntry(
  records: WorkRecord[],
  workTypes: WorkType[],
  targetDate: string
) {
  const workType = recommendWorkType(records, workTypes, targetDate);
  if (!workType) return null;

  const target = parseLocalIsoDate(targetDate);
  const candidates = records.flatMap((record) =>
    (record.workLines ?? [])
      .filter((line) => line.workTypeId === workType.id)
      .map((line) => {
        const recordDate = parseLocalIsoDate(record.workDate);
        const ageInDays = Math.round((target.getTime() - recordDate.getTime()) / 86_400_000);
        const score = Math.exp(-ageInDays / 45) + (recordDate.getDay() === target.getDay() ? 0.8 : 0);
        return { line, record, score };
      })
  );
  const bestMatch = candidates.sort((left, right) => right.score - left.score)[0] ?? null;

  return bestMatch ? { workType, line: bestMatch.line, record: bestMatch.record } : null;
}
