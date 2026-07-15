import type { PanInfo } from "framer-motion";
import { addDays } from "../../utils/date";
import { getWeekSwipeThresholds } from "../navigation/week-selector.utils";

const { distance: SWIPE_DISTANCE_THRESHOLD, velocity: SWIPE_VELOCITY_THRESHOLD } = getWeekSwipeThresholds();

export function getPreviousDayDate(date: Date) {
  return addDays(date, -1);
}

export function getNextDayDate(date: Date) {
  return addDays(date, 1);
}

export function resolveDaySwipeDirection(info: Pick<PanInfo, "offset" | "velocity">) {
  const offsetX = info.offset.x;
  const offsetY = info.offset.y;

  if (Math.abs(offsetY) > Math.abs(offsetX)) {
    return 0;
  }

  if (offsetX >= SWIPE_DISTANCE_THRESHOLD || info.velocity.x >= SWIPE_VELOCITY_THRESHOLD) {
    return -1;
  }

  if (offsetX <= -SWIPE_DISTANCE_THRESHOLD || info.velocity.x <= -SWIPE_VELOCITY_THRESHOLD) {
    return 1;
  }

  return 0;
}
