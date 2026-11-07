/**
 * Tiny, safe markdown renderer for trip notes.
 *
 * Supports **bold**, *italic* and [label](url). Everything else is escaped.
 * Links are only emitted for http(s), mailto and tel URLs; anything else
 * (javascript:, data:, vbscript:, relative paths...) renders as plain text.
 *
 * Pure module: no Next/React imports so `node --test` can load it.
 */

const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns the URL (normalised the way browsers parse it) if it uses an allowed
 * scheme, otherwise null. Browsers drop tabs/newlines anywhere in a URL and
 * trim leading/trailing control characters and spaces, so do the same before
 * checking the scheme.
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return null;
  const compact = url
    .replace(/[\t\n\r]/g, '')
    .replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  return SAFE_URL.test(compact) ? compact : null;
}

function inline(html) {
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function renderMarkdown(text) {
  if (!text) return '';

  // NUL is used as a placeholder delimiter below, so drop any in the input.
  const source = String(text).replace(/\u0000/g, '');
  const links = [];

  // Pull links out first so bold/italic markers inside URLs are left alone.
  const withPlaceholders = source.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, label, url) => {
    const safe = sanitizeUrl(url);
    const labelHtml = inline(escapeHtml(label));
    const html = safe
      ? `<a href="${escapeHtml(safe)}" class="md-link" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`
      : labelHtml;
    links.push(html);
    return `\u0000${links.length - 1}\u0000`;
  });

  return inline(escapeHtml(withPlaceholders)).replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}
