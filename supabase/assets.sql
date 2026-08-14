create extension if not exists pgcrypto;

create table if not exists public.asset_settings (
  id uuid primary key default gen_random_uuid(),
  user_email text not null unique,
  initial_balance numeric(16, 2) not null default 0 check (initial_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_transactions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  type text not null check (type in ('income', 'expense')),
  title text not null check (char_length(trim(title)) > 0),
  amount numeric(16, 2) not null check (amount > 0),
  category text not null default '기타',
  memo text not null default '',
  transaction_date date not null,
  hourly_wage numeric(16, 2) check (hourly_wage is null or hourly_wage > 0),
  work_hours numeric(8, 2) check (work_hours is null or work_hours > 0),
  break_hours numeric(8, 2) check (break_hours is null or break_hours >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (break_hours is null or work_hours is null or break_hours <= work_hours)
);

create index if not exists asset_transactions_user_date_idx
  on public.asset_transactions (user_email, transaction_date desc, created_at desc);

alter table public.asset_settings enable row level security;
alter table public.asset_transactions enable row level security;

-- L-Lee Workspace API는 SUPABASE_SERVICE_ROLE_KEY를 사용하고, 모든 쿼리를
-- NextAuth 세션의 user_email로 제한합니다. 브라우저의 직접 테이블 접근은 허용하지 않습니다.
