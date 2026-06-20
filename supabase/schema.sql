-- Supabase schema for Notes
-- Run this in the Supabase SQL editor (Project → SQL → New query) before signing in.

-- Subjects ----------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create index if not exists subjects_user_id_idx on public.subjects(user_id);

alter table public.subjects enable row level security;

drop policy if exists "Subjects are scoped to user" on public.subjects;
create policy "Subjects are scoped to user"
  on public.subjects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notes -------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  content text not null default '',
  subject_id text not null default '',
  date timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_updated_at_idx on public.notes(updated_at desc);

alter table public.notes enable row level security;

drop policy if exists "Notes are scoped to user" on public.notes;
create policy "Notes are scoped to user"
  on public.notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User settings -----------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_id text not null default 'pure',
  follow_system_theme boolean not null default false,
  custom_theme_vars jsonb,
  onboarding_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Settings are scoped to user" on public.user_settings;
create policy "Settings are scoped to user"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
