import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Plus, Trash2, X } from 'lucide-react';
import type { Subject } from '../../types/note';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#64748b', '#0f172a', '#fafafa',
];

interface SubjectManagerProps {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onSave: (s: Subject) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  noteCountBySubject: Record<string, number>;
}

export function SubjectManager({
  open,
  onClose,
  subjects,
  onSave,
  onDelete,
  noteCountBySubject,
}: SubjectManagerProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[10]);
  const [editing, setEditing] = useState<Subject | null>(null);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const subject: Subject = editing
      ? { ...editing, name: trimmed, color }
      : { id: uuid(), name: trimmed, color };
    await onSave(subject);
    setName('');
    setColor(PALETTE[10]);
    setEditing(null);
  };

  const handleDelete = async (s: Subject) => {
    const count = noteCountBySubject[s.id] ?? 0;
    const msg = count
      ? `Delete "${s.name}"? ${count} note${count === 1 ? '' : 's'} will be moved to another subject.`
      : `Delete "${s.name}"?`;
    if (!confirm(msg)) return;
    await onDelete(s.id);
  };

  const beginEdit = (s: Subject) => {
    setEditing(s);
    setName(s.name);
    setColor(s.color);
  };

  const cancelEdit = () => {
    setEditing(null);
    setName('');
    setColor(PALETTE[10]);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        cancelEdit();
        onClose();
      }}
      title="Subjects"
      description="Organize your notes with color-coded subjects."
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-apple border border-border bg-surface-2 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            {editing ? 'Edit subject' : 'New subject'}
          </div>
          <div className="flex flex-col gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Linear Algebra"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform hover:scale-110',
                    color === c && 'ring-2 ring-offset-2 ring-offset-surface-2',
                  )}
                  style={{
                    background: c,
                    // @ts-expect-error css var
                    '--tw-ring-color': c,
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-border-strong bg-surface text-text-muted hover:border-accent hover:text-accent">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="sr-only"
                />
                <Plus size={11} />
              </label>
            </div>
            <div className="mt-1 flex items-center gap-2">
              {editing && (
                <Button
                  variant="ghost"
                  onClick={cancelEdit}
                  leadingIcon={<X size={13} />}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!name.trim()}
                leadingIcon={editing ? undefined : <Plus size={13} />}
              >
                {editing ? 'Save' : 'Add subject'}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Your subjects
          </div>
          {subjects.length === 0 ? (
            <div className="rounded-apple border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-text-muted">
              No subjects yet. Add one above to start organizing.
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-2 rounded-apple border border-border bg-surface px-3 py-2"
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: s.color }}
                  />
                  <div className="flex-1 truncate text-[13.5px] font-medium text-text">
                    {s.name}
                  </div>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">
                    {noteCountBySubject[s.id] ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => beginEdit(s)}
                    className="rounded p-1 text-text-subtle hover:bg-surface-2 hover:text-text"
                    aria-label="Edit subject"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s)}
                    className="rounded p-1 text-text-subtle hover:bg-surface-2 hover:text-danger"
                    aria-label="Delete subject"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
