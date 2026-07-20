import { useSyncExternalStore } from "react";

const STORAGE_KEY = "alveryn.employment-scope";
const CHANGE_EVENT = "alveryn:employment-scope-change";
let memoryScope: string | null = null;

function readEmploymentScope() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    memoryScope = value && value !== "all" ? value : null;
    return memoryScope;
  } catch {
    return memoryScope;
  }
}

function subscribe(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

export function setEmploymentScope(employmentId: string | null) {
  memoryScope = employmentId;
  try {
    window.localStorage.setItem(STORAGE_KEY, employmentId ?? "all");
  } catch {
    // The in-memory UI still receives the change event when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useEmploymentScope() {
  return useSyncExternalStore(subscribe, readEmploymentScope, () => null);
}
