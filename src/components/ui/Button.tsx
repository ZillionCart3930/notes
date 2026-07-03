import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-text hover:bg-accent-hover active:scale-[0.98] shadow-apple',
  secondary:
    'bg-surface-2 text-text hover:bg-surface border border-border hover:border-border-strong',
  ghost:
    'bg-transparent text-text hover:bg-surface-2 active:bg-surface',
  danger:
    'bg-danger text-white hover:opacity-90 active:scale-[0.98] shadow-apple',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-[8px]',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-[12px]',
  icon: 'h-9 w-9 rounded-[10px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'secondary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-all duration-200 ease-apple',
        'disabled:opacity-40 disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
      {children}
      {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
    </button>
  );
});
