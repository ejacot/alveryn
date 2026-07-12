const STEP_KEY_PREFIX = "roomly.onboarding.step";
const UNIT_WORK_TYPE_KEY_PREFIX = "roomly.onboarding.unit-work-type";

export function getStoredOnboardingStep(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(`${STEP_KEY_PREFIX}:${userId}`);
  if (!raw) {
    return null;
  }

  const step = Number(raw);
  return Number.isInteger(step) ? step : null;
}

export function storeOnboardingStep(userId: string, step: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${STEP_KEY_PREFIX}:${userId}`, String(step));
}

export function clearStoredOnboardingStep(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(`${STEP_KEY_PREFIX}:${userId}`);
}

export function getStoredUnitWorkTypeId(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(`${UNIT_WORK_TYPE_KEY_PREFIX}:${userId}`);
}

export function storeUnitWorkTypeId(userId: string, workTypeId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${UNIT_WORK_TYPE_KEY_PREFIX}:${userId}`, workTypeId);
}

export function clearStoredUnitWorkTypeId(userId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(`${UNIT_WORK_TYPE_KEY_PREFIX}:${userId}`);
}
