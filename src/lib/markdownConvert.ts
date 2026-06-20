import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
});

// GFM tables, strikethrough, task lists
turndown.use(gfm);

// Custom rules — preserve inline HTML for highlight/underline since GFM
// has no native syntax and we want round-trip fidelity.
turndown.addRule('mark-highlight', {
  filter: (node) =>
    node.nodeName === 'MARK' ||
    (node.nodeName === 'SPAN' &&
      (node as HTMLElement).style?.backgroundColor !== ''),
  replacement: (_content, node) => {
    const text = (node.textContent ?? '').trim();
    return text ? `<mark>${text}</mark>` : '';
  },
});

turndown.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
});

// Override GFM's strikethrough to use ~~ (double tilde) instead of ~.
turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
});

// Ensure contenteditable produces stable, clean HTML.
marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

/**
 * Markdown → HTML. Used to populate the contenteditable when loading a note.
 * Empty input returns an empty string so the placeholder can show.
 */
export function markdownToHtml(md: string): string {
  const trimmed = md.trim();
  if (!trimmed) return '';
  const result = marked.parse(trimmed, { async: false });
  return typeof result === 'string' ? result : '';
}

/**
 * HTML → Markdown. Used on debounced input to extract storage format from
 * the live contenteditable state.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html === '<br>' || html === '<p><br></p>') return '';
  try {
    return turndown.turndown(html).trim();
  } catch {
    return html;
  }
}
