const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Returns the unique placeholder names appearing in `template`, in first-seen order.
 * Whitespace inside braces is allowed and trimmed. Names must match
 * `[A-Za-z_][A-Za-z0-9_]*`; anything else is silently ignored.
 */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Replaces each `{{name}}` with `values[name]`. Strings are inserted verbatim.
 * Non-string values are JSON-stringified (so a number renders as `42`, an array
 * as `[1,2,3]`). Missing keys substitute the empty string.
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_RE, (_full, name: string) => {
    if (!(name in values)) return '';
    const v = values[name];
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return '';
    try { return JSON.stringify(v); } catch { return String(v); }
  });
}
