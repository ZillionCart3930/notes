import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { THEMES } from '../../lib/themes';
import type { ThemeCategory } from '../../types/note';
import { cn } from '../../lib/utils';

interface ThemeSwitcherProps {
  open: boolean;
  onClose: () => void;
  currentThemeId: string;
  followSystemTheme: boolean;
  onSelect: (id: string) => void;
  onToggleSystem: (v: boolean) => void;
}

const CATEGORIES: ThemeCategory[] = [
  'Light',
  'Dark',
  'Colorful',
  'Seasonal',
  'Special',
];

export function ThemeSwitcher({
  open,
  onClose,
  currentThemeId,
  followSystemTheme,
  onSelect,
  onToggleSystem,
}: ThemeSwitcherProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return THEMES;
    return THEMES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Appearance"
      description="Choose a theme for your notes."
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-apple border border-border bg-surface-2 px-3 py-2">
          <div>
            <div className="text-[13px] font-medium text-text">Follow system</div>
            <div className="text-[12px] text-text-muted">
              Auto-switch between light and dark.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={followSystemTheme}
            onClick={() => onToggleSystem(!followSystemTheme)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              followSystemTheme ? 'bg-accent' : 'bg-border-strong',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                followSystemTheme ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search themes…"
            className="pl-8"
          />
        </div>

        <div className="flex flex-col gap-5">
          {CATEGORIES.map((cat) => {
            const inCat = filtered.filter((t) => t.category === cat);
            if (inCat.length === 0) return null;
            return (
              <section key={cat}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {cat}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {inCat.map((t) => {
                    const active = t.id === currentThemeId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelect(t.id)}
                        className={cn(
                          'group relative flex flex-col gap-1.5 rounded-apple border p-2 text-left transition-all',
                          active
                            ? 'border-accent/60 ring-2 ring-accent/30'
                            : 'border-border hover:border-border-strong',
                        )}
                      >
                        <div
                          className="relative h-16 w-full overflow-hidden rounded-[8px] border border-border"
                          style={{
                            background: t.vars['--bg'],
                          }}
                        >
                          <div
                            className="absolute left-2 top-2 h-2 w-8 rounded-full"
                            style={{ background: t.vars['--text'] }}
                          />
                          <div
                            className="absolute left-2 top-6 h-1.5 w-12 rounded-full opacity-70"
                            style={{ background: t.vars['--text-muted'] }}
                          />
                          <div
                            className="absolute left-2 top-9 h-1.5 w-10 rounded-full opacity-50"
                            style={{ background: t.vars['--text-subtle'] }}
                          />
                          <div
                            className="absolute right-2 bottom-2 h-5 w-5 rounded-full"
                            style={{ background: t.vars['--accent'] }}
                          />
                          {active && (
                            <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-text">
                              <Check size={11} />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-1 px-0.5">
                          <span className="truncate text-[12.5px] font-medium text-text">
                            {t.name}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider',
                              t.mode === 'dark'
                                ? 'bg-surface-2 text-text-muted'
                                : 'bg-surface-2 text-text-muted',
                            )}
                          >
                            {t.mode === 'dark' ? 'Dark' : 'Light'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-[13px] text-text-muted">
              No themes match "{query}".
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
