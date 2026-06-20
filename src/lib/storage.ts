import { openDB, type IDBPDatabase } from 'idb';
import type { Note, Subject, AppSettings, ExportPayload } from '../types/note';

const DB_NAME = 'lecture-notes';
const DB_VERSION = 1;
const NOTE_STORE = 'notes';
const SUBJECT_STORE = 'subjects';
const SETTINGS_STORE = 'settings';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(NOTE_STORE)) {
          const noteStore = db.createObjectStore(NOTE_STORE, { keyPath: 'id' });
          noteStore.createIndex('subject', 'subject', { unique: false });
          noteStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          noteStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains(SUBJECT_STORE)) {
          db.createObjectStore(SUBJECT_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ---------- Notes ----------

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  const all = (await db.getAll(NOTE_STORE)) as Note[];
  // Most recently updated first
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getNote(id: string): Promise<Note | undefined> {
  const db = await getDB();
  return (await db.get(NOTE_STORE, id)) as Note | undefined;
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put(NOTE_STORE, note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(NOTE_STORE, id);
}

export async function deleteNotes(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(NOTE_STORE, 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}

// ---------- Subjects ----------

export async function getAllSubjects(): Promise<Subject[]> {
  const db = await getDB();
  return (await db.getAll(SUBJECT_STORE)) as Subject[];
}

export async function saveSubject(subject: Subject): Promise<void> {
  const db = await getDB();
  await db.put(SUBJECT_STORE, subject);
}

export async function deleteSubject(id: string): Promise<void> {
  const db = await getDB();
  // Reassign notes for this subject to "general" or first remaining
  const notes = (await db.getAll(NOTE_STORE)) as Note[];
  const subjects = (await getAllSubjects());
  const fallback = subjects.find((s) => s.id !== id);
  const db2 = await getDB();
  const tx = db2.transaction([NOTE_STORE, SUBJECT_STORE], 'readwrite');
  if (fallback) {
    for (const n of notes) {
      if (n.subject === id) {
        await tx.objectStore(NOTE_STORE).put({ ...n, subject: fallback.id });
      }
    }
  } else {
    // No other subject: keep notes as-is (orphan)
  }
  await tx.objectStore(SUBJECT_STORE).delete(id);
  await tx.done;
}

// ---------- Settings ----------

const SETTINGS_KEY = 'app';

export async function getSettings(): Promise<AppSettings | undefined> {
  const db = await getDB();
  return (await db.get(SETTINGS_STORE, SETTINGS_KEY)) as
    | AppSettings
    | undefined;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put(SETTINGS_STORE, settings, SETTINGS_KEY);
}

// ---------- Import / Export ----------

export async function exportAll(): Promise<string> {
  const [notes, subjects, settings] = await Promise.all([
    getAllNotes(),
    getAllSubjects(),
    getSettings(),
  ]);
  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
    subjects,
    settings,
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  notesAdded: number;
  notesUpdated: number;
  subjectsAdded: number;
}

export async function importAll(json: string): Promise<ImportResult> {
  let parsed: ExportPayload;
  try {
    parsed = JSON.parse(json) as ExportPayload;
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid export file');
  }
  const notes: Note[] = Array.isArray(parsed.notes) ? parsed.notes : [];
  const subjects: Subject[] = Array.isArray(parsed.subjects)
    ? parsed.subjects
    : [];

  const db = await getDB();
  const tx = db.transaction([NOTE_STORE, SUBJECT_STORE], 'readwrite');

  let notesAdded = 0;
  let notesUpdated = 0;
  const existingNotes = (await tx.objectStore(NOTE_STORE).getAll()) as Note[];
  const noteIndex = new Map(existingNotes.map((n) => [n.id, n]));
  for (const n of notes) {
    if (!n || typeof n.id !== 'string') continue;
    if (noteIndex.has(n.id)) {
      notesUpdated++;
    } else {
      notesAdded++;
    }
    await tx.objectStore(NOTE_STORE).put(n);
  }

  let subjectsAdded = 0;
  const existingSubjects = (await tx
    .objectStore(SUBJECT_STORE)
    .getAll()) as Subject[];
  const subjectIndex = new Map(existingSubjects.map((s) => [s.id, s]));
  for (const s of subjects) {
    if (!s || typeof s.id !== 'string') continue;
    if (!subjectIndex.has(s.id)) subjectsAdded++;
    await tx.objectStore(SUBJECT_STORE).put(s);
  }

  await tx.done;

  return { notesAdded, notesUpdated, subjectsAdded };
}
