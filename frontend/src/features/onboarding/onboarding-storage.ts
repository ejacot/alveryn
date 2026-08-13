const STEP_KEY_PREFIX = "alveryn.onboarding.step";
const UNIT_WORK_TYPE_KEY_PREFIX = "alveryn.onboarding.unit-work-type";
const INITIAL_SETUP_DRAFT_KEY_PREFIX = "alveryn.onboarding.initial-setup";
const INITIAL_SETUP_DRAFT_VERSION = 1;

export type InitialSetupDraft = {
  version: 1;
  step: 1 | 2 | 3;
  firstName: string;
  lastName: string;
  compensationType: "HOURLY" | "PER_UNIT" | "FIXED_AMOUNT";
  hourlyRate: string;
  unitLabel: string;
  ratePerUnit: string;
  currency: string;
  paidVacation: boolean;
  paidSickLeave: boolean;
};

export function getInitialSetupDraft(userId: string): InitialSetupDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${INITIAL_SETUP_DRAFT_KEY_PREFIX}:${userId}`);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isInitialSetupDraft(value)) {
      window.localStorage.removeItem(`${INITIAL_SETUP_DRAFT_KEY_PREFIX}:${userId}`);
      return null;
    }
    return value;
  } catch {
    window.localStorage.removeItem(`${INITIAL_SETUP_DRAFT_KEY_PREFIX}:${userId}`);
    return null;
  }
}

export function storeInitialSetupDraft(userId: string, draft: InitialSetupDraft) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(`${INITIAL_SETUP_DRAFT_KEY_PREFIX}:${userId}`, JSON.stringify(draft)); } catch { /* setup remains usable without persistence */ }
}

export function clearInitialSetupDraft(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${INITIAL_SETUP_DRAFT_KEY_PREFIX}:${userId}`);
}

function isInitialSetupDraft(value: unknown): value is InitialSetupDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return draft.version === INITIAL_SETUP_DRAFT_VERSION &&
    (draft.step === 1 || draft.step === 2 || draft.step === 3) &&
    ["HOURLY", "PER_UNIT", "FIXED_AMOUNT"].includes(String(draft.compensationType)) &&
    ["firstName", "lastName", "hourlyRate", "unitLabel", "ratePerUnit", "currency"].every((key) => typeof draft[key] === "string") &&
    typeof draft.paidVacation === "boolean" && typeof draft.paidSickLeave === "boolean";
}

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
