import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectProps {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: ReactNode; swatch?: string }[];
  placeholder?: string;
  className?: string;
  trigger?: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  className,
  trigger,
  align = 'start',
}: SelectProps) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center justify-between gap-2 rounded-[10px] bg-surface-2 px-3 text-sm text-text',
              'border border-border transition-colors hover:border-border-strong',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              'min-w-[140px]',
              className,
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {selected?.swatch && (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: selected.swatch }}
                />
              )}
              <span className="truncate">
                {selected ? selected.label : placeholder}
              </span>
            </span>
            <ChevronDown size={14} className="text-text-muted shrink-0" />
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className="z-50 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-apple glass-strong shadow-apple-lg p-1 animate-scale-in"
        >
          {options.map((opt) => (
            <DropdownMenu.Item
              key={opt.value}
              onSelect={() => onValueChange(opt.value)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-sm text-text outline-none',
                'data-[highlighted]:bg-surface',
              )}
            >
              {opt.swatch && (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: opt.swatch }}
                />
              )}
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && (
                <Check size={14} className="text-accent shrink-0" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export const Popover = DropdownMenu.Root;
export const PopoverTrigger = DropdownMenu.Trigger;
export const PopoverContent = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(function PopoverContent({ className, ...rest }, ref) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={6}
        {...rest}
        className={cn(
          'z-50 overflow-hidden rounded-apple glass-strong shadow-apple-lg p-1',
          className,
        )}
      />
    </DropdownMenu.Portal>
  );
});
