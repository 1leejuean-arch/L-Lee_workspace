-- L-Lee Workspace finance schema
-- Supabase SQL Editor에서 전체를 한 번 실행하세요. 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- NextAuth Google 로그인과 Supabase Auth를 함께 사용할 수 있도록 이메일이 일치하면
-- auth.users.id를 자동 연결합니다. 현재 서버 API는 user_email도 항상 검증합니다.
create or replace function public.attach_finance_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.user_id is null and new.user_email is not null then
    select id into new.user_id
    from auth.users
    where lower(email) = lower(new.user_email)
    order by created_at
    limit 1;
  end if;
  return new;
end;
$$;

create table if not exists public.finance_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null unique,
  initial_balance numeric(16, 2) not null default 0 check (initial_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  type text not null check (type in ('income', 'expense')),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_email, type, name)
);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  work_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  hourly_wage numeric(16, 2) not null check (hourly_wage > 0),
  actual_minutes integer not null check (actual_minutes > 0 and actual_minutes <= 1440),
  expected_wage numeric(16, 2) not null check (expected_wage > 0),
  status text not null default 'expected' check (status in ('expected', 'paid')),
  transaction_id uuid,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  type text not null check (type in ('income', 'expense')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  amount numeric(16, 2) not null check (amount > 0),
  category text not null default '기타',
  memo text not null default '',
  payment_method text not null default '',
  status text not null default 'paid' check (status in ('expected', 'paid')),
  transaction_date date not null,
  work_session_id uuid references public.work_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'work_sessions_transaction_id_fkey'
  ) then
    alter table public.work_sessions
      add constraint work_sessions_transaction_id_fkey
      foreign key (transaction_id) references public.finance_transactions(id) on delete set null;
  end if;
end
$$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  service_name text not null check (char_length(trim(service_name)) between 1 and 120),
  amount numeric(16, 2) not null check (amount > 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('weekly', 'monthly', 'yearly')),
  next_billing_date date not null,
  category text not null default '구독',
  memo text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_transactions_owner_date_idx on public.finance_transactions (user_email, transaction_date desc, created_at desc);
create index if not exists finance_transactions_user_id_idx on public.finance_transactions (user_id);
create unique index if not exists finance_transactions_work_session_uidx on public.finance_transactions (work_session_id) where work_session_id is not null;
create index if not exists finance_categories_owner_idx on public.finance_categories (user_email, type);
create index if not exists work_sessions_owner_date_idx on public.work_sessions (user_email, work_date desc);
create index if not exists subscriptions_owner_date_idx on public.subscriptions (user_email, next_billing_date);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['finance_settings', 'finance_categories', 'work_sessions', 'finance_transactions', 'subscriptions']
  loop
    execute format('drop trigger if exists %I_attach_auth_user on public.%I', table_name, table_name);
    execute format('create trigger %I_attach_auth_user before insert or update of user_email, user_id on public.%I for each row execute function public.attach_finance_auth_user()', table_name, table_name);
  end loop;

  foreach table_name in array array['finance_settings', 'work_sessions', 'finance_transactions', 'subscriptions']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end
$$;

alter table public.finance_settings enable row level security;
alter table public.finance_categories enable row level security;
alter table public.work_sessions enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.subscriptions enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['finance_settings', 'finance_categories', 'work_sessions', 'finance_transactions', 'subscriptions']
  loop
    execute format('drop policy if exists %I_owner_all on public.%I', table_name, table_name);
    execute format(
      'create policy %I_owner_all on public.%I for all to authenticated using (user_id = auth.uid() or lower(user_email) = lower(coalesce(auth.jwt() ->> ''email'', ''''))) with check (user_id = auth.uid() or lower(user_email) = lower(coalesce(auth.jwt() ->> ''email'', '''')))',
      table_name,
      table_name
    );
  end loop;
end
$$;

-- 기존 자산관리 데이터를 보존해 새 구조로 한 번만 옮깁니다.
do $$
begin
  if to_regclass('public.asset_settings') is not null then
    insert into public.finance_settings (user_email, initial_balance, created_at, updated_at)
    select user_email, initial_balance, created_at, updated_at from public.asset_settings
    on conflict (user_email) do nothing;
  end if;

  if to_regclass('public.asset_transactions') is not null then
    insert into public.finance_transactions (
      id, user_email, type, title, amount, category, memo, payment_method,
      status, transaction_date, created_at, updated_at
    )
    select
      id, user_email, type, title, amount, category, memo, '',
      'paid', transaction_date, created_at, updated_at
    from public.asset_transactions
    on conflict (id) do nothing;
  end if;
end
$$;

-- 기존 Supabase Auth 사용자가 이미 있다면 연결 정보를 보강합니다.
update public.finance_settings set user_id = null where user_id is null;
update public.finance_categories set user_id = null where user_id is null;
update public.work_sessions set user_id = null where user_id is null;
update public.finance_transactions set user_id = null where user_id is null;
update public.subscriptions set user_id = null where user_id is null;
