import { getSupabase } from './supabase';
import type { Note, Subject, AppSettings } from '../types/note';
import type { UserSettingsRow } from '../types/supa';
import {
  getAllNotes,
  getAllSubjects,
  saveNote,
  saveSubject,
  saveSettings,
} from './storage';

/**
 * Cloud sync helpers — all operations dual-write to local IndexedDB and
 * Supabase (when signed in). On login we pull from cloud and merge.
 */

export async function pullFromCloud(userId: string): Promise<{
  notes: Note[];
  subjects: Subject[];
  settings: AppSettings | null;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { notes: [], subjects: [], settings: null };
  }

  const [{ data: remoteSubjects }, { data: remoteNotes }, { data: remoteSettings }] =
    await Promise.all([
      supabase.from('subjects').select('*').eq('user_id', userId),
      supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  const subjects: Subject[] = (remoteSubjects ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
  }));
  const notes: Note[] = (remoteNotes ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    subject: r.subject_id,
    date: r.date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  let settings: AppSettings | null = null;
  if (remoteSettings) {
    const s = remoteSettings as UserSettingsRow;
    settings = {
      themeId: s.theme_id,
      followSystemTheme: s.follow_system_theme,
      customThemeVars: s.custom_theme_vars ?? undefined,
    };
  }

  // Merge: take union of cloud and local. For overlapping ids, prefer the
  // one with the latest updatedAt (notes/subjects) or updated_at (settings).
  const [localNotes, localSubjects, localSettings] = await Promise.all([
    getAllNotes(),
    getAllSubjects(),
    (async () => {
      // re-use storage helper
      const { getSettings } = await import('./storage');
      return getSettings();
    })(),
  ]);

  const mergedNotes = mergeById<Note>(localNotes, notes, (a, b) =>
    a.updatedAt < b.updatedAt ? b : a,
  );
  const mergedSubjects = mergeById<Subject>(
    localSubjects,
    subjects,
    // Subjects don't have updatedAt; fall back to "remote wins if missing locally".
    (_a, b) => b,
  );

  let mergedSettings: AppSettings | null = localSettings ?? null;
  if (settings) {
    if (!mergedSettings) mergedSettings = settings;
    else {
      // Compare updated_at if we had it locally; otherwise prefer remote
      mergedSettings = settings;
    }
  }

  // Persist merged locally
  for (const n of mergedNotes) await saveNote(n);
  for (const s of mergedSubjects) await saveSubject(s);
  if (mergedSettings) await saveSettings(mergedSettings);

  // Push any local-only records back up to cloud
  await pushLocalOnlyToCloud(userId, mergedNotes, mergedSubjects);

  return { notes: mergedNotes, subjects: mergedSubjects, settings: mergedSettings };
}

function mergeById<T extends { id: string }>(
  a: T[],
  b: T[],
  pickWinner: (x: T, y: T) => T,
): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) {
    const existing = map.get(item.id);
    map.set(item.id, existing ? pickWinner(existing, item) : item);
  }
  return [...map.values()];
}

async function pushLocalOnlyToCloud(
  userId: string,
  notes: Note[],
  subjects: Subject[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // Insert subjects that don't exist remotely
  const { data: remoteSubjects } = await supabase
    .from('subjects')
    .select('id')
    .eq('user_id', userId);
  const remoteSubjectIds = new Set((remoteSubjects ?? []).map((r) => r.id));
  const subjectsToInsert = subjects
    .filter((s) => !remoteSubjectIds.has(s.id))
    .map((s) => ({ id: s.id, user_id: userId, name: s.name, color: s.color }));
  if (subjectsToInsert.length) {
    await supabase.from('subjects').insert(subjectsToInsert);
  }

  const { data: remoteNotes } = await supabase
    .from('notes')
    .select('id')
    .eq('user_id', userId);
  const remoteNoteIds = new Set((remoteNotes ?? []).map((r) => r.id));
  const notesToInsert = notes
    .filter((n) => !remoteNoteIds.has(n.id))
    .map((n) => ({
      id: n.id,
      user_id: userId,
      title: n.title,
      content: n.content,
      subject_id: n.subject,
      date: n.date,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
    }));
  if (notesToInsert.length) {
    await supabase.from('notes').insert(notesToInsert);
  }
}

export async function syncNoteUp(
  userId: string,
  note: Note,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('notes').upsert({
    id: note.id,
    user_id: userId,
    title: note.title,
    content: note.content,
    subject_id: note.subject,
    date: note.date,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  });
}

export async function syncNoteDown(
  userId: string,
  noteId: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId);
}

export async function syncSubjectUp(
  userId: string,
  subject: Subject,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('subjects').upsert({
    id: subject.id,
    user_id: userId,
    name: subject.name,
    color: subject.color,
  });
}

export async function syncSubjectDown(
  userId: string,
  subjectId: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('subjects').delete().eq('id', subjectId).eq('user_id', userId);
}

export async function syncSettingsUp(
  userId: string,
  settings: AppSettings,
  onboardingComplete: boolean,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('user_settings').upsert({
    user_id: userId,
    theme_id: settings.themeId,
    follow_system_theme: settings.followSystemTheme,
    custom_theme_vars: settings.customThemeVars ?? null,
    onboarding_complete: onboardingComplete,
    updated_at: new Date().toISOString(),
  });
}

export async function getOnboardingComplete(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return localStorage.getItem('onboarding-complete') === 'true';
  }
  const { data } = await supabase
    .from('user_settings')
    .select('onboarding_complete')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean((data as UserSettingsRow | null)?.onboarding_complete);
}

export async function setOnboardingComplete(
  userId: string | null,
  value: boolean,
): Promise<void> {
  localStorage.setItem('onboarding-complete', String(value));
  if (!userId) return;
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, onboarding_complete: value });
}

export async function wipeCloud(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await Promise.all([
    supabase.from('notes').delete().eq('user_id', userId),
    supabase.from('subjects').delete().eq('user_id', userId),
    supabase.from('user_settings').delete().eq('user_id', userId),
  ]);
}