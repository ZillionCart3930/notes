import { ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

const ALEX_URL = 'https://alexroper.dev';

interface CreditProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function Credit({ className, size = 'sm' }: CreditProps) {
  const text = size === 'sm' ? 'text-[11.5px]' : 'text-[12.5px]';
  return (
    <a
      href={ALEX_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 rounded-full',
        'text-text-muted transition-colors hover:text-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        text,
        className,
      )}
    >
      <span>Built by</span>
      <span className="font-medium text-text">Alex Roper</span>
      <ExternalLink size={size === 'sm' ? 9 : 10} className="opacity-60" />
    </a>
  );
}