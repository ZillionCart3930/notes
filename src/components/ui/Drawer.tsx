import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: 'right' | 'bottom';
  className?: string;
  title?: ReactNode;
}

export function Drawer({
  open,
  onClose,
  children,
  side = 'right',
  className,
  title,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const isRight = side === 'right';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: isRight ? '100%' : 0, y: isRight ? 0 : '100%' }}
            animate={{ x: 0, y: 0 }}
            exit={{ x: isRight ? '100%' : 0, y: isRight ? 0 : '100%' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute glass-strong shadow-apple-lg flex flex-col',
              isRight
                ? 'right-0 top-0 h-full w-full max-w-md border-l border-border'
                : 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-apple-2xl border-t border-border',
              className,
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h2 className="text-[15px] font-semibold text-text">{title}</h2>
                <div className="w-1" />
              </div>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
