import '@testing-library/jest-dom';

// Stub IntersectionObserver for jsdom
global.IntersectionObserver = class IntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof globalThis.IntersectionObserver;

// Mock fetch globally for tests
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
});
