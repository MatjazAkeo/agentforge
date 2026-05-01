let current: AbortController | null = null;

export function newRunAbortController(): AbortController {
  current?.abort();
  current = new AbortController();
  return current;
}

export function getCurrent(): AbortController | null {
  return current;
}

export function abortCurrent() {
  current?.abort();
}
