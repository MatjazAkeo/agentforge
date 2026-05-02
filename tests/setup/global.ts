import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './msw';

// Tauri's plugin-http relies on `invoke()` which doesn't exist in the test runtime.
// Re-export the global fetch (which MSW patches) so OpenRouter calls are intercepted normally.
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
