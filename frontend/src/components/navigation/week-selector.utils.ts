import type { PanInfo } from "framer-motion";
import { addWeeks } from "../../utils/date";

const SWIPE_DISTANCE_THRESHOLD = 72;
const SWIPE_VELOCITY_THRESHOLD = 420;

export function getNextWeekDate(date: Date) {
  return addWeeks(date, 1);
}

export function getPreviousWeekDate(date: Date) {
  return addWeeks(date, -1);
}

export function resolveWeekSwipeDirection(info: Pick<PanInfo, "offset" | "velocity">) {
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

export function getWeekSwipeThresholds() {
  return {
    distance: SWIPE_DISTANCE_THRESHOLD,
    velocity: SWIPE_VELOCITY_THRESHOLD
  };
}
