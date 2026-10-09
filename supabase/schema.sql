-- Jalankan di Supabase SQL Editor. RLS membatasi profil ke pemiliknya;
-- admin ditetapkan manual oleh pemilik proyek, bukan dari form publik.
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

create policy "Users can read their own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "Users can update safe profile fields only"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = 'student' and is_verified = false);

-- Membuat profil otomatis saat user mendaftar.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, is_verified)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'Siswa Baru'), 'student', false);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Setelah akun admin dibuat melalui Supabase Auth, jalankan query ini
-- dengan UUID akun admin yang benar dari dashboard Auth:
-- update public.profiles set role = 'admin', is_verified = true where id = 'UUID-AKUN-ADMIN';
