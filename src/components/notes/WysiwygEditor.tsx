import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react';
import { markdownToHtml, htmlToMarkdown } from '../../lib/markdownConvert';

export interface WysiwygEditorHandle {
  focus: () => void;
  getHtml: () => string;
}

interface WysiwygEditorProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Contenteditable WYSIWYG editor backed by markdown as the storage format.
 *
 * - Renders markdown to HTML via `marked` and sets `innerHTML`.
 * - When the user types, debounces a `turndown` roundtrip and reports the
 *   resulting markdown via `onChange`.
 * - The HTML is *only* re-rendered when `value` changes from outside (loading
 *   a different note, importing, etc.) — never on local keystrokes, so the
 *   caret stays put while editing.
 */
export const WysiwygEditor = forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(
  function WysiwygEditor(
    { value, onChange, placeholder = 'Start writing…', className },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastExternalRef = useRef<string>(value);
    const debounceTimer = useRef<number | undefined>(undefined);

    const updateEmptyState = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      const text = (el.innerText ?? el.textContent ?? '').trim();
      el.dataset.empty = text === '' ? 'true' : 'false';
    }, []);

    // Render external value → HTML when it differs from what we last emitted.
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (value === lastExternalRef.current) return;
      const html = markdownToHtml(value);
      el.innerHTML = html || '';
      lastExternalRef.current = value;
      updateEmptyState();
    }, [value, updateEmptyState]);

    // Track emptiness via MutationObserver so the placeholder can render.
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      updateEmptyState();
      const observer = new MutationObserver(updateEmptyState);
      observer.observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      return () => observer.disconnect();
    }, [updateEmptyState]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => editorRef.current?.focus(),
        getHtml: () => editorRef.current?.innerHTML ?? '',
      }),
      [],
    );

    const flushMarkdown = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;
      const md = htmlToMarkdown(el.innerHTML);
      lastExternalRef.current = md;
      onChange(md);
    }, [onChange]);

    const handleInput = useCallback(() => {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = window.setTimeout(flushMarkdown, 220);
    }, [flushMarkdown]);

    // Flush synchronously on blur so the latest state is committed.
    const handleBlur = useCallback(() => {
      window.clearTimeout(debounceTimer.current);
      flushMarkdown();
    }, [flushMarkdown]);

    const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      // Detect markdown-ish paste: contains headings, list markers, or
      // emphasis markers. Render as HTML so it formats correctly.
      const looksLikeMarkdown =
        /(?:^|\n)(?:#{1,6}\s|[-*+]\s|\d+\.\s|>\s)/.test(text) ||
        /(\*\*|__|`[^`]+`|\[[^\]]+\]\([^)]+\))/.test(text);
      const html = looksLikeMarkdown ? markdownToHtml(text) : '';
      if (html) {
        document.execCommand('insertHTML', false, html);
      } else {
        document.execCommand(
          'insertText',
          false,
          text.replace(/\r\n/g, '\n'),
        );
      }
      // Flush immediately so the markdown state reflects the paste right away
      window.clearTimeout(debounceTimer.current);
      flushMarkdown();
    }, [flushMarkdown]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        const meta = e.metaKey || e.ctrlKey;
        if (!meta) return;
        const k = e.key.toLowerCase();
        let cmd: string | null = null;
        let valueArg: string | undefined;
        if (k === 'b') cmd = 'bold';
        else if (k === 'i') cmd = 'italic';
        else if (k === 'u') cmd = 'underline';
        else if (k === 'k') {
          cmd = 'createLink';
          valueArg = prompt('Link URL:', 'https://') ?? undefined;
          if (!valueArg) return;
        }
        if (cmd) {
          e.preventDefault();
          document.execCommand(cmd, false, valueArg);
          flushMarkdown();
        }
      },
      [flushMarkdown],
    );

    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-multiline="true"
        aria-label="Note content"
        data-placeholder={placeholder}
        data-empty="true"
        data-wysiwyg-editor="true"
        onInput={handleInput}
        onBlur={handleBlur}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className={
          'markdown min-h-full focus:outline-none ' +
          (className ?? '')
        }
      />
    );
  },
);