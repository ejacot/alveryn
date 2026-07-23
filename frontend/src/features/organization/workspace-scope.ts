import { useSyncExternalStore } from "react";
const KEY = "alveryn.workspace-scope";
const EVENT = "alveryn:workspace-scope-change";
let memory: string | null = null;
function read() {
  try { memory = window.localStorage.getItem(KEY); } catch { /* keep memory */ }
  return memory;
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === KEY) listener(); };
  window.addEventListener("storage", storage); window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(EVENT, listener); };
}
export function setWorkspaceScope(id: string | null) {
  memory = id;
  try { id ? window.localStorage.setItem(KEY, id) : window.localStorage.removeItem(KEY); } catch { /* memory fallback */ }
  window.dispatchEvent(new Event(EVENT));
}
export function useWorkspaceScope() { return useSyncExternalStore(subscribe, read, () => null); }
