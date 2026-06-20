import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Trash2, ArrowDownAZ, Calendar } from 'lucide-react';
import type { Note, Subject } from '../../types/note';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui';
import { EmptyState } from '../ui/Card';
import { formatDate, relativeTime, snippet } from '../../lib/utils';

type SortKey = 'updated' | 'created' | 'date' | 'title';

interface NotesHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  notes: Note[];
  subjects: Subject[];
  currentNoteId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function NotesHistoryPanel({
  open,
  onClose,
  notes,
  subjects,
  currentNoteId,
  onSelect,
  onNew,
  onDelete,
}: NotesHistoryPanelProps) {
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('updated');

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])),
    [subjects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (subjectFilter !== 'all' && n.subject !== subjectFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      const key = sort === 'created' ? 'createdAt' : sort === 'date' ? 'date' : 'updatedAt';
      return b[key].localeCompare(a[key]);
    });
    return sorted;
  }, [notes, query, subjectFilter, sort]);

  // Group by subject for display
  const grouped = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    for (const n of filtered) {
      const k = n.subject || 'none';
      if (!groups[k]) groups[k] = [];
      groups[k].push(n);
    }
    return groups;
  }, [filtered]);

  const subjectOptions = useMemo(
    () => [
      { value: 'all', label: 'All subjects' },
      ...subjects.map((s) => ({ value: s.id, label: s.name, swatch: s.color })),
    ],
    [subjects],
  );

  const sortOptions = [
    { value: 'updated', label: 'Recently updated' },
    { value: 'created', label: 'Recently created' },
    { value: 'date', label: 'Lecture date' },
    { value: 'title', label: 'Title (A–Z)' },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      title="Notes"
    >
      <div className="flex flex-col gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="pl-8"
            />
          </div>
          <Button variant="primary" size="md" onClick={onNew} leadingIcon={<Plus size={14} />}>
            New
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={subjectFilter}
            onValueChange={setSubjectFilter}
            options={subjectOptions}
            className="flex-1"
            trigger={
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-3 text-sm text-text border border-border"
              >
                <span className="flex items-center gap-2 truncate">
                  {subjectFilter !== 'all' && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: subjectMap[subjectFilter]?.color ?? 'var(--text-subtle)',
                      }}
                    />
                  )}
                  {subjectOptions.find((o) => o.value === subjectFilter)?.label}
                </span>
              </button>
            }
          />
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
            options={sortOptions}
            className="flex-1"
            trigger={
              <button
                type="button"
                className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-3 text-sm text-text border border-border"
              >
                <span className="flex items-center gap-2 truncate">
                  {sort === 'title' ? (
                    <ArrowDownAZ size={13} className="text-text-muted" />
                  ) : (
                    <Calendar size={13} className="text-text-muted" />
                  )}
                  {sortOptions.find((o) => o.value === sort)?.label}
                </span>
              </button>
            }
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title="No notes yet"
            description={
              query
                ? 'No notes match your search.'
                : 'Create your first note to get started.'
            }
            action={
              !query && (
                <Button
                  variant="primary"
                  onClick={onNew}
                  leadingIcon={<Plus size={14} />}
                >
                  New note
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([subjectId, list]) => {
              const subj = subjectMap[subjectId];
              return (
                <div key={subjectId}>
                  <div className="sticky top-0 z-10 -mx-3 mb-1.5 flex items-center gap-2 bg-surface/85 px-3 py-1.5 backdrop-blur">
                    {subj ? (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: subj.color }}
                      />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-text-subtle" />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      {subj?.name ?? 'No subject'}
                    </span>
                    <span className="text-[11px] text-text-subtle">
                      {list.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {list.map((n) => {
                      const isActive = n.id === currentNoteId;
                      return (
                        <motion.li
                          key={n.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div
                            className={
                              'group relative flex flex-col gap-1 rounded-apple border px-3 py-2.5 transition-colors cursor-pointer ' +
                              (isActive
                                ? 'border-accent/40 bg-surface'
                                : 'border-border bg-surface hover:border-border-strong')
                            }
                            onClick={() => onSelect(n.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="truncate text-[14px] font-medium text-text">
                                {n.title || 'Untitled note'}
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this note?')) onDelete(n.id);
                                }}
                                className="invisible rounded p-1 text-text-subtle hover:bg-surface-2 hover:text-danger group-hover:visible"
                                aria-label="Delete note"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {n.content.trim() && (
                              <p className="line-clamp-2 text-[12.5px] leading-relaxed text-text-muted">
                                {snippet(n.content, 120)}
                              </p>
                            )}
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-text-subtle">
                              <span>{formatDate(n.date)}</span>
                              <span>·</span>
                              <span>{relativeTime(n.updatedAt)}</span>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
