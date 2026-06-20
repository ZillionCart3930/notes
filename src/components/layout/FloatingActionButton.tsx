import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
}

export function FloatingActionButton({ onClick, label = 'New' }: FloatingActionButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="fixed bottom-6 right-6 z-20 flex h-14 items-center gap-2 rounded-full bg-accent pl-4 pr-5 text-accent-text shadow-apple-lg transition-colors hover:bg-accent-hover"
      aria-label={label}
    >
      <Plus size={20} />
      <span className="text-[14px] font-medium">{label}</span>
    </motion.button>
  );
}
