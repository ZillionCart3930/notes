import type { Subject } from '../../types/note';
import { cn } from '../../lib/utils';

export function SubjectBadge({
  subject,
  className,
  size = 'md',
  onClick,
}: {
  subject: Subject | undefined;
  className?: string;
  size?: 'sm' | 'md';
  onClick?: () => void;
}) {
  if (!subject) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-surface-2 text-text-muted',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-text-subtle" />
        No subject
      </span>
    );
  }
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        onClick && 'hover:opacity-80 transition-opacity',
        className,
      )}
      style={{
        background: `color-mix(in srgb, ${subject.color} 14%, transparent)`,
        color: `color-mix(in srgb, ${subject.color} 90%, var(--text))`,
        border: `0.5px solid color-mix(in srgb, ${subject.color} 30%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: subject.color }}
      />
      <span className="font-medium">{subject.name}</span>
    </Comp>
  );
}
