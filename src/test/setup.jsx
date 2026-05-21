import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
