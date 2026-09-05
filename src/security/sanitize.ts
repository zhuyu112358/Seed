// sanitize: best-effort input sanitisation for free-form strings (soul speech,
// chat, object names). Strips control characters and common injection patterns.
// The InputValidator pattern whitelist is the primary defence; this is a second
// line for human-generated text.

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '"': '\\u0022',
  "'": '\\u0027',
};

export function sanitizeString(input: string, maxLen = 500): string {
  let out = input.replace(CONTROL_CHARS, '');
  for (const [ch, esc] of Object.entries(HTML_ESCAPES)) {
    out = out.split(ch).join(esc);
  }
  if (out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

/** Reject strings that look like shell / SQL / HTML injection attempts. */
export function looksInjective(input: string): boolean {
  const patterns = [
    /<script/i,
    /\bDROP\s+TABLE/i,
    /;\s*rm\s+-rf/i,
    /\$\{.*\}/,
    /`.*`/,
  ];
  return patterns.some((p) => p.test(input));
}
