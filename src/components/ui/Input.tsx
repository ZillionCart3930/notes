import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-[10px] bg-surface-2 px-3 text-sm text-text',
          'border border-border placeholder:text-text-subtle',
          'transition-all duration-200 ease-apple',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-[10px] bg-surface-2 px-3 py-2 text-sm text-text',
        'border border-border placeholder:text-text-subtle',
        'transition-all duration-200 ease-apple resize-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40',
        className,
      )}
      {...rest}
    />
  );
});
