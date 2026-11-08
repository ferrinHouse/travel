import test from 'node:test';
import assert from 'node:assert';
import { renderMarkdown, sanitizeUrl, escapeHtml } from '../src/lib/markdown.js';

const link = (href, label) =>
  `<a href="${href}" class="md-link" target="_blank" rel="noopener noreferrer">${label}</a>`;

test('renders bold, italic and safe links', () => {
  assert.strictEqual(
    renderMarkdown('This is **bold** and *italic* text.'),
    'This is <strong>bold</strong> and <em>italic</em> text.'
  );
  assert.strictEqual(
    renderMarkdown('Go to [Google](https://google.com).'),
    `Go to ${link('https://google.com', 'Google')}.`
  );
  assert.strictEqual(renderMarkdown('[Call](tel:+15555550100)'), link('tel:+15555550100', 'Call'));
  assert.strictEqual(renderMarkdown('[Mail](mailto:a@b.co)'), link('mailto:a@b.co', 'Mail'));
});

test('escapes raw HTML', () => {
  assert.strictEqual(
    renderMarkdown('Check out <script>alert(1)</script> & enjoy!'),
    'Check out &lt;script&gt;alert(1)&lt;/script&gt; &amp; enjoy!'
  );
  assert.strictEqual(renderMarkdown('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('drops links with dangerous schemes but keeps the label', () => {
  for (const url of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//evil.example.com',
    '/relative/path',
  ]) {
    const html = renderMarkdown(`[click](${url})`);
    assert.ok(!html.includes('<a'), `should not link ${JSON.stringify(url)}: ${html}`);
    assert.ok(html.startsWith('click'), html);
  }
});

test('quotes in URLs cannot break out of the href attribute', () => {
  const html = renderMarkdown('[x](https://a.com/" onmouseover="alert(1))');
  assert.ok(!html.includes('" onmouseover'), html);
  assert.ok(html.includes('&quot; onmouseover=&quot;alert(1'), html);
});

test('quotes in text are escaped', () => {
  assert.strictEqual(renderMarkdown(`He said "hi" & it's fine`), 'He said &quot;hi&quot; &amp; it&#39;s fine');
});

test('emphasis markers inside URLs are left alone', () => {
  assert.strictEqual(
    renderMarkdown('[map](https://x.com/*a*/b)'),
    link('https://x.com/*a*/b', 'map')
  );
});

test('formats bold inside link labels and multiple links', () => {
  assert.strictEqual(
    renderMarkdown('[**Tickets**](https://t.co) and [Map](https://m.co)'),
    `${link('https://t.co', '<strong>Tickets</strong>')} and ${link('https://m.co', 'Map')}`
  );
});

test('placeholder delimiters in user input cannot inject links', () => {
  assert.strictEqual(renderMarkdown('a\u00000\u0000b'), 'a0b');
});

test('empty input', () => {
  assert.strictEqual(renderMarkdown(''), '');
  assert.strictEqual(renderMarkdown(null), '');
});

test('sanitizeUrl and escapeHtml', () => {
  assert.strictEqual(sanitizeUrl('  https://a.com  '), 'https://a.com');
  assert.strictEqual(sanitizeUrl('ftp://a.com'), null);
  assert.strictEqual(sanitizeUrl(42), null);
  assert.strictEqual(escapeHtml(`<a href="x">'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
});
