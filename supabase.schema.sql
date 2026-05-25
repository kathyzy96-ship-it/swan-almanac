create table if not exists public.practices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  name text not null,
  symptoms text[] not null default '{}',
  steps text[] not null default '{}',
  image_url text,
  check_in_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.checkin_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_id text not null,
  date text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.practice_comments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_id text not null,
  user_name text not null,
  relative_time text not null,
  body text not null,
  avatar_tone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  before_image text,
  after_image text,
  updated_at timestamptz not null default now()
);

alter table public.practices enable row level security;
alter table public.checkin_logs enable row level security;
alter table public.practice_comments enable row level security;
alter table public.user_profiles enable row level security;

create policy "Users can manage own practices"
  on public.practices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own checkin logs"
  on public.checkin_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own practice comments"
  on public.practice_comments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own body profile"
  on public.user_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
