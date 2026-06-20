import { useCallback, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Trash2, Calendar, Hash, Eye, Pencil } from 'lucide-react';
import type { Note, Subject } from '../../types/note';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui';
import { SubjectBadge } from '../ui/SubjectBadge';
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect';
import { saveNote, deleteNote } from '../../lib/storage';
import { formatDate } from '../../lib/utils';
import { FormattingToolbar } from './FormattingToolbar';
import { WysiwygEditor } from './WysiwygEditor';
import { Credit } from '../ui/Credit';
import { markdownToHtml } from '../../lib/markdownConvert';
import { cn } from '../../lib/utils';

export interface NoteEditorProps {
  note: Note | null;
  subjects: Subject[];
  onChange: (n: Note | null) => void;
  onDelete?: (id: string) => void;
}

type Mode = 'edit' | 'preview';

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

function countWordsAndChars(text: string): { words: number; chars: number } {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, chars: 0 };
  const chars = trimmed.length;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return { words, chars };
}

export function NoteEditor({ note, subjects, onChange, onDelete }: NoteEditorProps) {
  const [mode, setMode] = useState<Mode>('edit');

  const updateField = useCallback(
    <K extends keyof Note>(key: K, value: Note[K]) => {
      if (!note) return;
      onChange({ ...note, [key]: value, updatedAt: new Date().toISOString() });
    },
    [note, onChange],
  );

  const title = note?.title ?? '';
  const content = note?.content ?? '';
  const subjectId = note?.subject ?? '';
  const date = note?.date?.slice(0, 10) ?? todayIsoDate();

  useDebouncedEffect(
    () => {
      if (note) saveNote(note).catch(console.error);
    },
    [note],
    500,
  );

  const subjectObj = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId],
  );

  const subjectOptions = useMemo(
    () => [
      { value: '', label: 'No subject' },
      ...subjects.map((s) => ({ value: s.id, label: s.name, swatch: s.color })),
    ],
    [subjects],
  );

  const counts = useMemo(() => countWordsAndChars(content), [content]);
  const previewHtml = useMemo(
    () => (mode === 'preview' ? markdownToHtml(content) : ''),
    [mode, content],
  );

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-medium text-text">No note selected</p>
          <p className="mt-1 text-[13px] text-text-muted">
            Create a new note to start writing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Meta row: mode toggle, subject, date, delete */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <div className="flex items-center gap-1 rounded-[10px] bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-medium transition-colors',
              mode === 'edit'
                ? 'bg-surface text-text shadow-apple'
                : 'text-text-muted hover:text-text',
            )}
            aria-pressed={mode === 'edit'}
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-medium transition-colors',
              mode === 'preview'
                ? 'bg-surface text-text shadow-apple'
                : 'text-text-muted hover:text-text',
            )}
            aria-pressed={mode === 'preview'}
          >
            <Eye size={11} />
            Preview
          </button>
        </div>
        <SubjectBadge subject={subjectObj} />
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1.5 text-text-muted md:flex">
            <Hash size={13} />
            <Select
              value={subjectId}
              onValueChange={(v) => updateField('subject', v)}
              options={subjectOptions}
              className="min-w-[160px]"
            />
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <Calendar size={13} className="text-text-muted" />
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                const iso = new Date(e.target.value || todayIsoDate()).toISOString();
                updateField('date', iso);
              }}
              className="h-9 w-[150px]"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete note"
            onClick={async () => {
              if (!note) return;
              await deleteNote(note.id);
              onDelete?.(note.id);
            }}
          >
            <Trash2 size={15} className="text-danger" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="border-b border-border px-5 pt-4 pb-3">
        <Input
          value={title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Untitled note"
          className="h-10 w-full border-transparent bg-transparent px-0 text-[22px] font-semibold tracking-tight shadow-none focus-visible:ring-0 focus-visible:border-transparent"
        />
        {/* Mobile-only subject + date row */}
        <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
          <div className="flex items-center gap-1.5 text-text-muted">
            <Hash size={12} />
            <Select
              value={subjectId}
              onValueChange={(v) => updateField('subject', v)}
              options={subjectOptions}
              className="min-w-[140px]"
            />
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              const iso = new Date(e.target.value || todayIsoDate()).toISOString();
              updateField('date', iso);
            }}
            className="h-9 w-[150px]"
          />
        </div>
      </div>

      {/* Toolbar (edit mode only) */}
      {mode === 'edit' && (
        <div className="sticky top-0 z-10 -mt-px border-b border-border bg-surface/85 px-5 py-2 backdrop-blur">
          <FormattingToolbar />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-6">
          <div className="mb-3 text-[12px] uppercase tracking-wider text-text-subtle">
            {formatDate(note.date)}
          </div>
          {mode === 'edit' ? (
            <WysiwygEditor
              value={content}
              onChange={(v) => updateField('content', v)}
              placeholder="Start writing… use the toolbar above to format, or paste markdown."
              className="min-h-[50vh]"
            />
          ) : (
            <div
              className="markdown min-h-[50vh]"
              dangerouslySetInnerHTML={{ __html: previewHtml || '<p><em>Nothing to preview yet.</em></p>' }}
            />
          )}
        </div>
      </div>

      {/* Footer with word/char count */}
      <div className="flex items-center justify-between border-t border-border bg-surface-2/60 px-5 py-1.5 text-[11.5px] text-text-muted">
        <div className="flex items-center gap-3">
          <span>
            <strong className="font-semibold text-text">{counts.words.toLocaleString()}</strong>{' '}
            word{counts.words === 1 ? '' : 's'}
          </span>
          <span aria-hidden>·</span>
          <span>
            <strong className="font-semibold text-text">{counts.chars.toLocaleString()}</strong>{' '}
            character{counts.chars === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            <kbd className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted border border-border">⌘B</kbd>
            <span>bold</span>
            <span className="mx-1">·</span>
            <kbd className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted border border-border">⌘I</kbd>
            <span>italic</span>
          </div>
          <Credit />
        </div>
      </div>
    </div>
  );
}

export function createNewNote(subjects: Subject[]): Note {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    title: '',
    content: '',
    subject: subjects[0]?.id ?? '',
    date: now,
    createdAt: now,
    updatedAt: now,
  };
}