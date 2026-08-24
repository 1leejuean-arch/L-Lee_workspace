-- L-Lee Workspace meeting minutes schema
-- Supabase SQL Editor에서 전체를 한 번 실행하세요. 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto;

create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  meeting_date date not null,
  start_time text,
  end_time text,
  attendees text not null default '',
  location text not null default '',
  content text not null default '',
  decisions text not null default '',
  action_items text not null default '',
  tag text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create index if not exists meeting_minutes_owner_date_idx
  on public.meeting_minutes (user_email, meeting_date desc, created_at desc);
create index if not exists meeting_minutes_tag_idx
  on public.meeting_minutes (user_email, tag);

create or replace function public.set_meeting_minutes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meeting_minutes_updated_at on public.meeting_minutes;
create trigger meeting_minutes_updated_at
before update on public.meeting_minutes
for each row execute function public.set_meeting_minutes_updated_at();

alter table public.meeting_minutes enable row level security;

drop policy if exists meeting_minutes_owner_all on public.meeting_minutes;
create policy meeting_minutes_owner_all
on public.meeting_minutes
for all
to authenticated
using (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Workspace 서버 API는 NextAuth 세션의 이메일로 모든 쿼리를 제한하며
-- SUPABASE_SERVICE_ROLE_KEY는 브라우저에 노출하지 않습니다.
