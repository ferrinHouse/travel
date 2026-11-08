import { renderMarkdown } from '@/lib/markdown';

/**
 * The only place the app injects HTML. renderMarkdown escapes everything and
 * only emits <strong>, <em> and links with safe URL schemes.
 */
export default function Markdown({ text, as: Tag = 'span', className }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
