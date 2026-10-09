-- Jalankan sekali di Supabase SQL Editor. Backup data sebelum menjalankan ulang.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Siswa Baru',
  role text not null default 'student' check (role in ('student','admin')),
  class_name text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint verified_only_admin check (is_verified = false or role = 'admin')
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read own profile or admins can read all"
on public.profiles for select to authenticated
using (auth.uid() = id or (select public.is_admin()));

drop policy if exists "Users can update safe profile fields only" on public.profiles;
create policy "Users can update safe profile fields only"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = 'student' and is_verified = false);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, is_verified)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'Siswa Baru'), 'student', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Promote admin from SQL Editor using the exact UUID from Authentication > Users:
-- update public.profiles set role = 'admin', is_verified = true where id = 'UUID-AKUN-ADMIN';

-- IMPORTANT: keep SUPABASE_SERVICE_ROLE_KEY server-only in Vercel env vars.
