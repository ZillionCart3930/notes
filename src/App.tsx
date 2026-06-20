import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { Note, Subject, AppSettings } from './types/note';
import {
  getAllNotes,
  getAllSubjects,
  getSettings,
  saveSettings,
  saveNote,
  deleteNote as deleteNoteDb,
  deleteSubject as deleteSubjectDb,
  deleteNotes,
  saveSubject,
  exportAll,
  importAll,
} from './lib/storage';
import { applyTheme, DEFAULT_THEME_ID } from './lib/themes';
import { getSupabase, SUPABASE_CONFIGURED } from './lib/supabase';
import {
  pullFromCloud,
  syncNoteUp,
  syncNoteDown,
  syncSubjectUp,
  syncSubjectDown,
  syncSettingsUp,
  getOnboardingComplete,
  setOnboardingComplete,
  wipeCloud,
} from './lib/sync';
import { AppHeader } from './components/layout/AppHeader';
import { NoteEditor, createNewNote } from './components/notes/NoteEditor';
import { NotesHistoryPanel } from './components/notes/NotesHistoryPanel';
import { ThemeSwitcher } from './components/settings/ThemeSwitcher';
import { SubjectManager } from './components/settings/SubjectManager';
import { SettingsModal } from './components/settings/SettingsModal';
import { AuthGate } from './components/auth/AuthGate';
import { OnboardingTour, type TourStep } from './components/onboarding/OnboardingTour';
import { Button } from './components/ui/Button';
import { downloadFile, readFileAsText } from './lib/utils';

const TOUR_STEPS: TourStep[] = [
  {
    target: 'brand',
    title: 'Welcome to Notes',
    description:
      'A clean, private notebook that lives in your browser and syncs to your account.',
    placement: 'bottom',
  },
  {
    target: 'new-button',
    title: 'Start a new note',
    description:
      'Tap here any time to create a fresh note. Your current note is saved automatically as you type.',
    placement: 'bottom',
  },
  {
    target: 'editor',
    title: 'Write in Markdown',
    description:
      'Use the toolbar for bold, lists, quotes, code, and more. Switch to Preview for a clean read view.',
    placement: 'bottom',
  },
  {
    target: 'history-button',
    title: 'Browse your history',
    description:
      'Every note is searchable and grouped by subject. Click any note to jump back in.',
    placement: 'bottom',
  },
  {
    target: 'themes-button',
    title: 'Make it yours',
    description:
      'Pick from 85+ themes across light, dark, colorful, seasonal, and editor classics. You can also follow your system theme.',
    placement: 'bottom',
  },
  {
    target: 'subjects-button',
    title: 'Organize by subject',
    description:
      'Create color-coded subjects for classes, projects, or anything. Notes get tagged automatically.',
    placement: 'bottom',
  },
];

function App() {
  // ---- Auth ----
  const [session, setSession] = useState<Session | null>(null);
  const [authResolved, setAuthResolved] = useState(!SUPABASE_CONFIGURED);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const supabase = getSupabase()!;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setAuthResolved(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ---- App state ----
  const [notes, setNotes] = useState<Note[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    themeId: DEFAULT_THEME_ID,
    followSystemTheme: false,
  });
  const [hydrated, setHydrated] = useState(!SUPABASE_CONFIGURED);
  const [tourOpen, setTourOpen] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);

  // ---- Modals / panels ----
  const [historyOpen, setHistoryOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const cloudEnabled = SUPABASE_CONFIGURED && !!session && !localOnly;
  const userId = session?.user?.id ?? null;

  // ---- Hydration ----
  useEffect(() => {
    if (!authResolved) return;
    (async () => {
      if (cloudEnabled && userId) {
        // Pull from cloud + merge
        try {
          const pulled = await pullFromCloud(userId);
          setSubjects(
            pulled.subjects.length > 0
              ? pulled.subjects
              : await seedDefaultSubjects(),
          );
          setNotes(pulled.notes);
          if (pulled.settings) {
            setSettings(pulled.settings);
            applyTheme(pulled.settings.themeId, pulled.settings.customThemeVars);
          } else {
            applyTheme(DEFAULT_THEME_ID);
          }

          if (pulled.notes.length === 0) {
            const fresh = createNewNote(
              pulled.subjects.length > 0
                ? pulled.subjects
                : await seedDefaultSubjects(),
            );
            await saveNote(fresh);
            await syncNoteUp(userId, fresh);
            setNotes([fresh]);
            setCurrentNoteId(fresh.id);
          } else {
            setCurrentNoteId(pulled.notes[0].id);
          }

          // Onboarding
          const complete = await getOnboardingComplete(userId);
          if (!complete) {
            // Slight delay so the layout is settled for accurate measurements
            setTimeout(() => setTourOpen(true), 600);
          }
        } catch (err) {
          console.error('Cloud pull failed; falling back to local', err);
          await hydrateLocal();
        }
      } else {
        await hydrateLocal();
      }
      setHydrated(true);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, cloudEnabled, userId]);

  async function hydrateLocal() {
    const [loadedNotes, loadedSubjects, loadedSettings] = await Promise.all([
      getAllNotes(),
      getAllSubjects(),
      getSettings(),
    ]);
    let subs = loadedSubjects;
    if (subs.length === 0) subs = await seedDefaultSubjects();
    setNotes(loadedNotes);
    setSubjects(subs);
    const initialSettings: AppSettings = loadedSettings ?? {
      themeId: DEFAULT_THEME_ID,
      followSystemTheme: false,
    };
    setSettings(initialSettings);
    applyTheme(initialSettings.themeId, initialSettings.customThemeVars);
    if (loadedNotes.length > 0) setCurrentNoteId(loadedNotes[0].id);
    else {
      const fresh = createNewNote(subs);
      await saveNote(fresh);
      setNotes([fresh]);
      setCurrentNoteId(fresh.id);
    }
  }

  async function seedDefaultSubjects(): Promise<Subject[]> {
    const defaults: Subject[] = [
      { id: uuid(), name: 'General', color: '#6366f1' },
      { id: uuid(), name: 'Math', color: '#0ea5e9' },
      { id: uuid(), name: 'Computer Science', color: '#10b981' },
      { id: uuid(), name: 'Humanities', color: '#f59e0b' },
    ];
    for (const s of defaults) {
      await saveSubject(s);
      if (cloudEnabled && userId) {
        await syncSubjectUp(userId, s).catch(() => {});
      }
    }
    return defaults;
  }

  // ---- System theme sync ----
  useEffect(() => {
    if (!settings.followSystemTheme) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      applyTheme(settings.themeId, settings.customThemeVars);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.followSystemTheme, settings.themeId, settings.customThemeVars]);

  const persistSettings = useCallback(
    async (next: AppSettings) => {
      setSettings(next);
      await saveSettings(next);
      applyTheme(next.themeId, next.customThemeVars);
      if (cloudEnabled && userId) {
        await syncSettingsUp(userId, next, false).catch(() => {});
      }
    },
    [cloudEnabled, userId],
  );

  // ---- Note operations ----
  const currentNote = useMemo(
    () => notes.find((n) => n.id === currentNoteId) ?? null,
    [notes, currentNoteId],
  );

  const handleNoteChange = useCallback(
    (n: Note | null) => {
      if (!n) return;
      setNotes((prev) => {
        const idx = prev.findIndex((p) => p.id === n.id);
        if (idx === -1) return [n, ...prev];
        const copy = [...prev];
        copy[idx] = n;
        return copy;
      });
      if (cloudEnabled && userId) {
        syncNoteUp(userId, n).catch(() => {});
      }
    },
    [cloudEnabled, userId],
  );

  const handleNewNote = useCallback(async () => {
    const fresh = createNewNote(subjects);
    await saveNote(fresh);
    if (cloudEnabled && userId) await syncNoteUp(userId, fresh).catch(() => {});
    setNotes((prev) => [fresh, ...prev]);
    setCurrentNoteId(fresh.id);
    setHistoryOpen(false);
  }, [subjects, cloudEnabled, userId]);

  const handleSelectNote = useCallback((id: string) => {
    setCurrentNoteId(id);
    setHistoryOpen(false);
  }, []);

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNoteDb(id);
      if (cloudEnabled && userId) await syncNoteDown(userId, id).catch(() => {});
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        if (currentNoteId === id) {
          if (next.length === 0) {
            const fresh = createNewNote(subjects);
            void saveNote(fresh);
            if (cloudEnabled && userId)
              void syncNoteUp(userId, fresh).catch(() => {});
            setCurrentNoteId(fresh.id);
            return [fresh];
          }
          setCurrentNoteId(next[0].id);
        }
        return next;
      });
    },
    [currentNoteId, subjects, cloudEnabled, userId],
  );

  // ---- Subject sync helper ----
  const refreshSubjects = useCallback(async () => {
    const s = await getAllSubjects();
    setSubjects(s);
    return s;
  }, []);

  const handleSaveSubject = useCallback(
    async (s: Subject) => {
      await saveSubject(s);
      if (cloudEnabled && userId) await syncSubjectUp(userId, s).catch(() => {});
      await refreshSubjects();
    },
    [cloudEnabled, userId, refreshSubjects],
  );

  const handleDeleteSubject = useCallback(
    async (id: string) => {
      await deleteSubjectDb(id);
      if (cloudEnabled && userId)
        await syncSubjectDown(userId, id).catch(() => {});
      const s = await refreshSubjects();
      // Re-fetch notes since subject reassignment happened
      const n = await getAllNotes();
      setNotes(n);
      if (currentNote && !s.find((x) => x.id === currentNote.subject)) {
        setCurrentNoteId(n[0]?.id ?? null);
      }
    },
    [cloudEnabled, userId, refreshSubjects, currentNote],
  );

  // ---- Import / Export ----
  const handleExport = useCallback(async () => {
    const json = await exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`notes-${stamp}.json`, json);
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await readFileAsText(file);
        const result = await importAll(text);
        const [n, s] = await Promise.all([getAllNotes(), getAllSubjects()]);
        setNotes(n);
        setSubjects(s);
        if (!currentNoteId && n[0]) setCurrentNoteId(n[0].id);
        if (cloudEnabled && userId) {
          // Push imported items up to cloud
          for (const subj of s) {
            await syncSubjectUp(userId, subj).catch(() => {});
          }
          for (const note of n) {
            await syncNoteUp(userId, note).catch(() => {});
          }
        }
        alert(
          `Imported ${result.notesAdded} new note${result.notesAdded === 1 ? '' : 's'} and updated ${result.notesUpdated}.`,
        );
      } catch (err) {
        alert(`Import failed: ${(err as Error).message}`);
      }
    },
    [currentNoteId, cloudEnabled, userId],
  );

  const handleClearAll = useCallback(async () => {
    await deleteNotes(notes.map((n) => n.id));
    for (const s of subjects) await deleteSubjectDb(s.id);
    if (cloudEnabled && userId) await wipeCloud(userId).catch(() => {});
    const defaults: Subject[] = [
      { id: uuid(), name: 'General', color: '#6366f1' },
    ];
    for (const s of defaults) {
      await saveSubject(s);
      if (cloudEnabled && userId) await syncSubjectUp(userId, s).catch(() => {});
    }
    const fresh = createNewNote(defaults);
    await saveNote(fresh);
    if (cloudEnabled && userId) await syncNoteUp(userId, fresh).catch(() => {});
    setSubjects(defaults);
    setNotes([fresh]);
    setCurrentNoteId(fresh.id);
  }, [notes, subjects, cloudEnabled, userId]);

  const handleSignOut = useCallback(async () => {
    if (cloudEnabled) {
      const supabase = getSupabase();
      await supabase?.auth.signOut();
    }
    setLocalOnly(true);
    setSession(null);
  }, [cloudEnabled]);

  // ---- Counts ----
  const noteCountBySubject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of notes) {
      if (n.subject) map[n.subject] = (map[n.subject] ?? 0) + 1;
    }
    return map;
  }, [notes]);

  const handleTourFinish = useCallback(async () => {
    setTourOpen(false);
    await setOnboardingComplete(userId, true);
  }, [userId]);

  // ---- Keyboard shortcut: ⌘N for new note ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void handleNewNote();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNewNote]);

  // ---- Render gates ----
  if (SUPABASE_CONFIGURED && !authResolved) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="text-[13px] text-text-muted">Loading…</div>
      </div>
    );
  }
  if (SUPABASE_CONFIGURED && !session && !localOnly) {
    return (
      <AuthGate
        onAuthenticated={(s) => setSession(s)}
        onSkipLocal={() => setLocalOnly(true)}
      />
    );
  }
  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[13px] text-text-muted"
        >
          Loading your notes…
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-bg">
      <AppHeader
        noteCount={notes.length}
        onNew={handleNewNote}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenThemes={() => setThemesOpen(true)}
        onOpenSubjects={() => setSubjectsOpen(true)}
        onExport={handleExport}
        onImport={handleImport}
        onSignOut={handleSignOut}
        cloudEnabled={cloudEnabled}
      />

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentNote ? (
            <motion.div
              key={currentNote.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto h-full max-w-6xl"
              data-tour="editor"
            >
              <NoteEditor
                note={currentNote}
                subjects={subjects}
                onChange={handleNoteChange}
                onDelete={handleDeleteNote}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-full items-center justify-center"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                  <FileText size={22} />
                </div>
                <h2 className="text-[17px] font-semibold text-text">
                  No note selected
                </h2>
                <p className="mt-1 text-[13px] text-text-muted">
                  Create a new note to start writing.
                </p>
                <div className="mt-5">
                  <Button variant="primary" onClick={handleNewNote}>
                    New note
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <NotesHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        notes={notes}
        subjects={subjects}
        currentNoteId={currentNoteId}
        onSelect={handleSelectNote}
        onNew={handleNewNote}
        onDelete={handleDeleteNote}
      />

      <ThemeSwitcher
        open={themesOpen}
        onClose={() => setThemesOpen(false)}
        currentThemeId={settings.themeId}
        followSystemTheme={settings.followSystemTheme}
        onSelect={(id) => {
          void persistSettings({ ...settings, themeId: id });
        }}
        onToggleSystem={(v) => {
          void persistSettings({ ...settings, followSystemTheme: v });
        }}
      />

      <SubjectManager
        open={subjectsOpen}
        onClose={() => setSubjectsOpen(false)}
        subjects={subjects}
        noteCountBySubject={noteCountBySubject}
        onSave={handleSaveSubject}
        onDelete={handleDeleteSubject}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAfterImport={async () => {
          const [n, s] = await Promise.all([getAllNotes(), getAllSubjects()]);
          setNotes(n);
          setSubjects(s);
          if (!currentNoteId && n[0]) setCurrentNoteId(n[0].id);
        }}
        onClearAll={handleClearAll}
      />

      <OnboardingTour
        open={tourOpen}
        steps={TOUR_STEPS}
        onFinish={handleTourFinish}
      />
    </div>
  );
}

export default App;