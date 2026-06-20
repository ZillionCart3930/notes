export interface Note {
  id: string;
  title: string;
  content: string;
  subject: string; // Subject id
  date: string; // ISO date string for the lecture
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  color: string; // hex
}

export type ThemeCategory =
  | 'Light'
  | 'Dark'
  | 'Colorful'
  | 'Seasonal'
  | 'Special';

export interface Theme {
  id: string;
  name: string;
  category: ThemeCategory;
  mode: 'light' | 'dark';
  vars: Record<string, string>;
}

export interface ExportPayload {
  version: number;
  exportedAt: string;
  subjects: Subject[];
  notes: Note[];
  settings?: AppSettings;
}

export interface AppSettings {
  themeId: string;
  followSystemTheme: boolean;
  customThemeVars?: Record<string, string>;
}
