import "@testing-library/jest-dom/vitest";
import "../i18n";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "0px";
  readonly thresholds: ReadonlyArray<number> = [0];

  disconnect() {}

  observe() {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve() {}
}

Object.assign(globalThis, {
  IntersectionObserver: IntersectionObserverMock
});
