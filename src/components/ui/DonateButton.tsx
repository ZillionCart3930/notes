import { Coffee } from 'lucide-react';
import { cn } from '../../lib/utils';

const BMC_URL = 'https://buymeacoffee.com/ZillionCart';

interface DonateButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'subtle' | 'icon';
  showLabel?: boolean;
}

export function DonateButton({
  className,
  size = 'md',
  variant = 'subtle',
  showLabel = true,
}: DonateButtonProps) {
  const sizes = {
    sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-[8px]',
    md: 'h-9 px-3.5 text-sm gap-2 rounded-[10px]',
    lg: 'h-11 px-5 text-[15px] gap-2 rounded-[12px]',
  } as const;
  const iconSizes = {
    sm: 13,
    md: 15,
    lg: 17,
  } as const;

  if (variant === 'icon') {
    return (
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Buy me a coffee"
        aria-label="Buy me a coffee"
        className={cn(
          'inline-flex items-center justify-center',
          'h-9 w-9 rounded-[10px] bg-[#FFDD00]/15 text-[#b8860b] border border-[#FFDD00]/40',
          'hover:bg-[#FFDD00]/30 hover:text-[#7a5b00] hover:border-[#FFDD00]/70',
          'transition-all duration-200 ease-apple',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDD00]/60',
          'dark:text-[#FFDD00] dark:hover:text-[#fff7a8]',
          className,
        )}
      >
        <Coffee size={15} />
      </a>
    );
  }

  const variantClasses =
    variant === 'solid'
      ? 'bg-[#FFDD00] text-[#3d2c00] border border-[#e6c700] shadow-apple hover:bg-[#ffe433] hover:shadow-apple-lg'
      : 'bg-[#FFDD00]/15 text-[#8a6914] border border-[#FFDD00]/40 hover:bg-[#FFDD00]/30 hover:text-[#5e4800] hover:border-[#FFDD00]/70 dark:text-[#FFDD00] dark:hover:text-[#fff7a8]';

  return (
    <a
      href={BMC_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-all duration-200 ease-apple active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDD00]/60',
        sizes[size],
        variantClasses,
        className,
      )}
    >
      <Coffee size={iconSizes[size]} className="shrink-0" />
      {showLabel && <span>Donate</span>}
    </a>
  );
}