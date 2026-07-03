import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, X, BookOpen } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export interface TourStep {
  /** ID used to find the target via [data-tour="…"] */
  target: string;
  title: string;
  description: string;
  /** Position of popover relative to target */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

interface OnboardingTourProps {
  open: boolean;
  steps: TourStep[];
  onFinish: () => void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function OnboardingTour({ open, steps, onFinish }: OnboardingTourProps) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<{
    left: number;
    top: number;
    placement: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const step = steps[index];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({ x: r.left, y: r.top, w: r.width, h: r.height });

    // Compute popover position
    const POPOVER_W = 340;
    const POPOVER_H = 180;
    const GAP = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placement = step.placement ?? 'auto';
    const resolved: 'top' | 'bottom' | 'left' | 'right' =
      placement === 'auto'
        ? r.top > vh / 2
          ? 'top'
          : 'bottom'
        : placement;

    let left = r.left + r.width / 2 - POPOVER_W / 2;
    let top = 0;
    if (resolved === 'bottom') {
      top = r.bottom + GAP;
    } else if (resolved === 'top') {
      top = r.top - GAP - POPOVER_H;
    } else if (resolved === 'right') {
      left = r.right + GAP;
      top = r.top + r.height / 2 - POPOVER_H / 2;
    } else {
      left = r.left - GAP - POPOVER_W;
      top = r.top + r.height / 2 - POPOVER_H / 2;
    }
    // Clamp inside viewport
    left = Math.max(12, Math.min(left, vw - POPOVER_W - 12));
    top = Math.max(12, Math.min(top, vh - POPOVER_H - 12));
    setPopoverStyle({ left, top, placement: resolved });
  }, [step]);

  useEffect(() => {
    if (!open) return;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // Re-measure after a tick in case the target animates in
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 250);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, index, measure]);

  const handleNext = useCallback(() => {
    if (index < steps.length - 1) {
      setIndex(index + 1);
    } else {
      onFinish();
    }
  }, [index, steps.length, onFinish]);

  const handleBack = useCallback(() => {
    if (index > 0) setIndex(index - 1);
  }, [index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handleBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, handleNext, handleBack, onFinish]);

  if (!open) return null;

  const isLast = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dimmed overlay with cutout */}
      <svg
        className="absolute inset-0 h-full w-full"
        width="100%"
        height="100%"
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {box && (
              <rect
                x={box.x - 6}
                y={box.y - 6}
                width={box.w + 12}
                height={box.h + 12}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Spotlight ring */}
      {box && (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="pointer-events-none absolute rounded-[14px] ring-2 ring-accent"
          style={{
            left: box.x - 6,
            top: box.y - 6,
            width: box.w + 12,
            height: box.h + 12,
          }}
        />
      )}

      {/* Popover */}
      <AnimatePresence mode="wait">
        {popoverStyle && (
          <motion.div
            key={index}
            ref={popoverRef}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute w-[340px] rounded-apple-xl glass-strong shadow-apple-lg"
            style={{ left: popoverStyle.left, top: popoverStyle.top }}
          >
            <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <Sparkles size={11} className="text-accent" />
                Step {index + 1} of {steps.length}
              </div>
              <button
                type="button"
                onClick={onFinish}
                className="rounded-full p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label="Skip tour"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-2 px-4 py-3.5">
              <h3 className="text-[15px] font-semibold text-text">
                {step.title}
              </h3>
              <p className="text-[13px] leading-relaxed text-text-muted">
                {step.description}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
              <button
                type="button"
                onClick={onFinish}
                className="text-[12px] text-text-muted transition-colors hover:text-text"
              >
                Skip
              </button>
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === index
                        ? 'w-5 bg-accent'
                        : i < index
                          ? 'w-1.5 bg-accent/40'
                          : 'w-1.5 bg-border-strong',
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    leadingIcon={<ArrowLeft size={12} />}
                  >
                    Back
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  trailingIcon={
                    isLast ? <BookOpen size={12} /> : <ArrowRight size={12} />
                  }
                >
                  {isLast ? "Let's go" : 'Next'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
