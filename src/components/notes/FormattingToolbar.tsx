import { useCallback, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface FormattingToolbarProps {
  className?: string;
}

interface Action {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  apply: () => void;
  dividerAfter?: boolean;
  command?: string;
  blockTag?: string;
}

/* ----- Helpers ----- */

const EDITOR_SELECTOR = '[data-wysiwyg-editor="true"]';

function getEditor(): HTMLElement | null {
  return document.querySelector<HTMLElement>(EDITOR_SELECTOR);
}

/** Focus the editor and restore the last selection inside it. */
function focusEditor() {
  const editor = getEditor();
  if (!editor) return;
  editor.focus();
  // Restore selection if there is one inside the editor
  const sel = document.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) return;
  }
  // Place caret at the end of the editor
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Run a contenteditable command and fire `input` so the editor flushes. */
function runCommand(command: string, value?: string) {
  focusEditor();
  document.execCommand(command, false, value);
  const sel = document.getSelection();
  const node = sel?.anchorNode;
  const el = node?.nodeType === 1 ? (node as Element) : node?.parentElement;
  el?.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Wrap the current selection in a nodeName (e.g. 'MARK', 'CODE'). */
function wrapSelection(tagName: string) {
  focusEditor();
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const ancestor = range.commonAncestorContainer;
  const startEl =
    ancestor.nodeType === 1
      ? (ancestor as HTMLElement)
      : (ancestor.parentElement as HTMLElement | null);
  const existing = startEl?.closest(tagName);
  if (existing) {
    const parent = existing.parentNode;
    while (existing.firstChild) {
      parent?.insertBefore(existing.firstChild, existing);
    }
    parent?.removeChild(existing);
    const el = sel.anchorNode?.parentElement;
    el?.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  const wrapper = document.createElement(tagName);
  try {
    range.surroundContents(wrapper);
  } catch {
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(wrapper);
  sel.addRange(newRange);
  const el = wrapper.parentElement;
  el?.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Get the closest LI ancestor of the caret, if any. */
function caretIsInList(): 'ul' | 'ol' | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node.nodeType === 1) {
      const tag = (node as HTMLElement).tagName;
      if (tag === 'UL') return 'ul';
      if (tag === 'OL') return 'ol';
      if ((node as HTMLElement).dataset?.wysiwygEditor === 'true') return null;
    }
    node = node.parentNode;
  }
  return null;
}

/** Insert a bullet/numbered list at the caret, or toggle off if already in one. */
function applyList(tag: 'ul' | 'ol') {
  focusEditor();
  const editor = getEditor();
  if (!editor) return;

  const inside = caretIsInList();
  if (inside === tag) {
    // Already in this list type — unwrap items into paragraphs
    document.execCommand(tag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (inside === (tag === 'ul' ? 'ol' : 'ul')) {
    // In the opposite list — convert
    document.execCommand(tag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
  }
  // Try the standard command first
  const ok = document.execCommand(tag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
  if (!ok) {
    // Manual fallback — wrap the current block in <ul><li>
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const block = closestBlock(range.commonAncestorContainer, editor);
    if (!block) return;
    const list = document.createElement(tag);
    const li = document.createElement('li');
    li.innerHTML = block.innerHTML || '<br>';
    list.appendChild(li);
    block.replaceWith(list);
  }
  editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function closestBlock(node: Node, root: HTMLElement): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const el = n as HTMLElement;
      if (/^(P|H[1-6]|BLOCKQUOTE|PRE|DIV)$/.test(el.tagName)) return el;
    }
    n = n.parentNode;
  }
  return null;
}

/** Returns the tagName of the closest block ancestor of the caret. */
function getCaretBlockTag(): string | null {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  while (node) {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      if (el.dataset?.wysiwygEditor === 'true') return null;
      if (/^(P|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|PRE|LI|UL|OL)$/.test(el.tagName)) {
        return el.tagName;
      }
    }
    node = node.parentNode;
  }
  return null;
}

function setBlock(tag: string) {
  runCommand('formatBlock', tag.toLowerCase());
}

const actions: Action[] = [
  {
    icon: <Bold size={14} />,
    label: 'Bold',
    shortcut: '⌘B',
    apply: () => runCommand('bold'),
    command: 'bold',
  },
  {
    icon: <Italic size={14} />,
    label: 'Italic',
    shortcut: '⌘I',
    apply: () => runCommand('italic'),
    command: 'italic',
  },
  {
    icon: <Underline size={14} />,
    label: 'Underline',
    shortcut: '⌘U',
    apply: () => runCommand('underline'),
    command: 'underline',
  },
  {
    icon: <Strikethrough size={14} />,
    label: 'Strikethrough',
    apply: () => runCommand('strikeThrough'),
    command: 'strikeThrough',
    dividerAfter: true,
  },
  {
    icon: <Highlighter size={14} />,
    label: 'Highlight',
    apply: () => wrapSelection('mark'),
  },
  {
    icon: <Code size={14} />,
    label: 'Inline code',
    apply: () => wrapSelection('code'),
    dividerAfter: true,
  },
  {
    icon: <Heading1 size={14} />,
    label: 'Heading 1',
    apply: () => setBlock('H1'),
    blockTag: 'H1',
  },
  {
    icon: <Heading2 size={14} />,
    label: 'Heading 2',
    apply: () => setBlock('H2'),
    blockTag: 'H2',
  },
  {
    icon: <Heading3 size={14} />,
    label: 'Heading 3',
    apply: () => setBlock('H3'),
    blockTag: 'H3',
  },
  {
    icon: <Pilcrow size={14} />,
    label: 'Paragraph',
    apply: () => setBlock('P'),
    blockTag: 'P',
    dividerAfter: true,
  },
  {
    icon: <List size={14} />,
    label: 'Bullet list',
    apply: () => applyList('ul'),
  },
  {
    icon: <ListOrdered size={14} />,
    label: 'Numbered list',
    apply: () => applyList('ol'),
  },
  {
    icon: <Quote size={14} />,
    label: 'Quote',
    apply: () => setBlock('BLOCKQUOTE'),
    blockTag: 'BLOCKQUOTE',
    dividerAfter: true,
  },
  {
    icon: <LinkIcon size={14} />,
    label: 'Link',
    apply: () => {
      focusEditor();
      const url = prompt('Link URL:', 'https://');
      if (url) {
        document.execCommand('createLink', false, url);
        getEditor()?.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
  },
];

export function FormattingToolbar({ className }: FormattingToolbarProps) {
  const [, force] = useState({});
  const refresh = useCallback(() => force({}), []);
  useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
  }, [refresh]);

  function isActive(a: Action): boolean {
    try {
      if (a.command) return document.queryCommandState(a.command);
      if (a.blockTag) return getCaretBlockTag() === a.blockTag;
    } catch {
      // ignore
    }
    return false;
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={cn(
        'flex flex-wrap items-center gap-0.5 rounded-[10px] border border-border bg-surface-2 p-1',
        className,
      )}
    >
      {actions.map((a) => {
        const active = isActive(a);
        return (
          <span key={a.label} className="flex items-center">
            <button
              type="button"
              onMouseDown={(e) => {
                // Don't steal focus from the editor
                e.preventDefault();
                a.apply();
                refresh();
              }}
              title={`${a.label}${a.shortcut ? ` (${a.shortcut})` : ''}`}
              aria-label={a.label}
              aria-pressed={active}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-[7px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:bg-surface hover:text-text',
              )}
            >
              {a.icon}
            </button>
            {a.dividerAfter && (
              <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
            )}
          </span>
        );
      })}
    </div>
  );
}