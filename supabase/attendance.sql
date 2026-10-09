-- HADIR! Attendance module. Run once in Supabase SQL Editor after schema.sql.
-- Attendance writes/reads are performed by protected server API routes using the server-only service key.
create extension if not exists pgcrypto;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 100),
  class_name text,
  attendance_date date not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  constraint valid_session_window check (expires_at > starts_at)
);
create index if not exists attendance_sessions_date_idx on public.attendance_sessions(attendance_date desc);
create index if not exists attendance_sessions_status_expiry_idx on public.attendance_sessions(status, expires_at);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  attendance_date date not null,
  checked_in_at timestamptz not null default now(),
  status text not null default 'present' check (status in ('present','late')),
  created_at timestamptz not null default now(),
  constraint one_checkin_per_session unique(session_id, student_id)
);
create index if not exists attendance_records_date_idx on public.attendance_records(attendance_date desc);
create index if not exists attendance_records_student_date_idx on public.attendance_records(student_id, attendance_date desc);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
-- Intentionally no client-facing policies: API routes validate the bearer session and role,
-- then use the server-only service key. Never expose that key to the browser.
revoke all on public.attendance_sessions from anon, authenticated;
revoke all on public.attendance_records from anon, authenticated;
grant all on public.attendance_sessions to service_role;
grant all on public.attendance_records to service_role;
