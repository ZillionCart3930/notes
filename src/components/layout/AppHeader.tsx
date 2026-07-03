import { useRef } from 'react';
import {
  History,
  Palette,
  Tag,
  Download,
  Upload,
  Settings as SettingsIcon,
  Plus,
  LogOut,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { DonateButton } from '../ui/DonateButton';

interface AppHeaderProps {
  noteCount: number;
  onNew: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenThemes: () => void;
  onOpenSubjects: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onSignOut?: () => void;
  cloudEnabled: boolean;
}

export function AppHeader({
  noteCount,
  onNew,
  onOpenHistory,
  onOpenSettings,
  onOpenThemes,
  onOpenSubjects,
  onExport,
  onImport,
  onSignOut,
  cloudEnabled,
}: AppHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 glass"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* New button — top-left */}
        <div data-tour="new-button">
          <Button
            variant="primary"
            size="md"
            onClick={onNew}
            leadingIcon={<Plus size={15} />}
            className="shrink-0"
          >
            <span className="hidden sm:inline">New</span>
          </Button>
        </div>

        {/* Brand */}
        <div
          data-tour="brand"
          className="flex items-center gap-2"
        >
          <div
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-accent-text shadow-apple"
            aria-hidden
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <h1 className="text-[15px] font-semibold tracking-tight text-text">
              Notes
            </h1>
            <p className="text-[11px] text-text-muted">
              {noteCount} note{noteCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="md"
            onClick={onOpenHistory}
            leadingIcon={<History size={14} />}
            className="hidden sm:inline-flex"
            data-tour="history-button"
          >
            History
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenHistory}
            className="sm:hidden"
            aria-label="History"
          >
            <History size={16} />
          </Button>

          <div className="mx-1 h-5 w-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenThemes}
            aria-label="Themes"
            title="Themes"
            data-tour="themes-button"
          >
            <Palette size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSubjects}
            aria-label="Subjects"
            title="Subjects"
            data-tour="subjects-button"
          >
            <Tag size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            aria-label="Import"
            title="Import"
          >
            <Upload size={16} />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            aria-label="Export"
            title="Export"
          >
            <Download size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="hidden sm:inline-flex"
            data-tour="settings-button"
          >
            <SettingsIcon size={16} />
          </Button>
          {onSignOut && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              {cloudEnabled ? (
                <LogOut size={16} />
              ) : (
                <CloudOff size={16} className="text-text-subtle" />
              )}
            </Button>
          )}
          <DonateButton variant="icon" className="ml-1" />
        </div>
      </div>
      {cloudEnabled && (
        <div className="border-t border-border/50 bg-accent/5 px-4 py-1 text-center text-[11px] text-text-muted sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <Cloud size={11} className="text-accent" />
            Synced to cloud
          </span>
        </div>
      )}
    </motion.header>
  );
}