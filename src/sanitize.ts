import DOMPurify from 'dompurify'

/*
 * Canvas Page bodies and Assignment descriptions are authored in Canvas's
 * own UI by people who are not the Better Canvas user, so they are
 * untrusted input: rendered with `v-html` only after passing through here.
 * DOMPurify's defaults (script/iframe/event-handler/javascript:-URL
 * stripping, safe-link normalization) are exactly the policy we want —
 * no extra config, no allowlist to drift.
 */
export function sanitizeCanvasHtml(html: string): string {
  return DOMPurify.sanitize(html)
}
