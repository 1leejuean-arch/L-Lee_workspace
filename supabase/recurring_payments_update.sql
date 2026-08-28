-- L-Lee Workspace recurring payment integration
-- finance.sql 실행 후 Supabase SQL Editor에서 실행하세요. 기존 데이터는 보존됩니다.

alter table if exists public.subscriptions
  add column if not exists calendar_event_id text,
  add column if not exists last_processed_date date;

alter table if exists public.finance_transactions
  add column if not exists source text,
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists payment_date date;

create unique index if not exists finance_transactions_subscription_payment_uidx
  on public.finance_transactions (subscription_id, payment_date)
  where subscription_id is not null and payment_date is not null;

create table if not exists public.recurring_payment_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text not null,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  payment_date date not null,
  transaction_id uuid references public.finance_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (subscription_id, payment_date)
);

create index if not exists recurring_payment_logs_owner_date_idx
  on public.recurring_payment_logs (user_email, payment_date desc);

alter table public.recurring_payment_logs enable row level security;

drop policy if exists recurring_payment_logs_owner_all on public.recurring_payment_logs;
create policy recurring_payment_logs_owner_all
  on public.recurring_payment_logs
  for all
  to authenticated
  using (
    user_id = auth.uid()
    or lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    user_id = auth.uid()
    or lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create or replace function public.advance_recurring_payment_date(payment_date date, billing_cycle text)
returns date
language plpgsql
immutable
as $$
declare
  target_month date;
  target_year integer;
  target_month_number integer;
  target_last_day integer;
begin
  if billing_cycle = 'weekly' then
    return payment_date + 7;
  end if;

  if billing_cycle = 'yearly' then
    target_year := extract(year from payment_date)::integer + 1;
    target_month_number := extract(month from payment_date)::integer;
    target_last_day := extract(day from (make_date(target_year, target_month_number, 1) + interval '1 month - 1 day'))::integer;
    return make_date(target_year, target_month_number, least(extract(day from payment_date)::integer, target_last_day));
  end if;

  target_month := (date_trunc('month', payment_date) + interval '1 month')::date;
  target_last_day := extract(day from (target_month + interval '1 month - 1 day'))::integer;
  return target_month + (least(extract(day from payment_date)::integer, target_last_day) - 1);
end;
$$;

-- 로그 생성, 지출 생성, 결제일 갱신을 하나의 DB 트랜잭션으로 처리합니다.
create or replace function public.process_recurring_payment(
  p_subscription_id uuid,
  p_user_email text,
  p_payment_date date,
  p_today date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_subscription public.subscriptions%rowtype;
  created_transaction public.finance_transactions%rowtype;
  existing_transaction public.finance_transactions%rowtype;
  log_id uuid;
  next_date date;
begin
  select t.* into existing_transaction
  from public.finance_transactions t
  where t.subscription_id = p_subscription_id
    and t.payment_date = p_payment_date
    and lower(t.user_email) = lower(p_user_email)
  limit 1;

  if found then
    select * into current_subscription
    from public.subscriptions
    where id = p_subscription_id and lower(user_email) = lower(p_user_email);
    return jsonb_build_object(
      'duplicate', true,
      'transaction', to_jsonb(existing_transaction),
      'subscription', to_jsonb(current_subscription)
    );
  end if;

  select * into current_subscription
  from public.subscriptions
  where id = p_subscription_id and lower(user_email) = lower(p_user_email)
  for update;

  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if not current_subscription.is_active then raise exception 'SUBSCRIPTION_INACTIVE'; end if;
  if current_subscription.next_billing_date <> p_payment_date then raise exception 'SUBSCRIPTION_PAYMENT_DATE_CHANGED'; end if;
  if current_subscription.next_billing_date > p_today then raise exception 'SUBSCRIPTION_NOT_DUE'; end if;

  insert into public.recurring_payment_logs (user_id, user_email, subscription_id, payment_date)
  values (current_subscription.user_id, current_subscription.user_email, current_subscription.id, p_payment_date)
  returning id into log_id;

  insert into public.finance_transactions (
    user_id, user_email, type, title, amount, category, memo, payment_method,
    status, transaction_date, source, subscription_id, payment_date
  ) values (
    current_subscription.user_id,
    current_subscription.user_email,
    'expense',
    current_subscription.service_name,
    current_subscription.amount,
    coalesce(nullif(current_subscription.category, ''), '구독'),
    current_subscription.memo,
    '',
    'paid',
    p_payment_date,
    'subscription',
    current_subscription.id,
    p_payment_date
  ) returning * into created_transaction;

  update public.recurring_payment_logs
  set transaction_id = created_transaction.id
  where id = log_id;

  next_date := public.advance_recurring_payment_date(p_payment_date, current_subscription.billing_cycle);
  update public.subscriptions
  set last_processed_date = p_payment_date,
      next_billing_date = next_date,
      calendar_event_id = null,
      updated_at = now()
  where id = current_subscription.id
  returning * into current_subscription;

  return jsonb_build_object(
    'duplicate', false,
    'transaction', to_jsonb(created_transaction),
    'subscription', to_jsonb(current_subscription)
  );
exception
  when unique_violation then
    select t.* into existing_transaction
    from public.finance_transactions t
    where t.subscription_id = p_subscription_id and t.payment_date = p_payment_date
    limit 1;
    select * into current_subscription from public.subscriptions where id = p_subscription_id;
    return jsonb_build_object(
      'duplicate', true,
      'transaction', to_jsonb(existing_transaction),
      'subscription', to_jsonb(current_subscription)
    );
end;
$$;

revoke all on function public.process_recurring_payment(uuid, text, date, date) from public;
revoke all on function public.process_recurring_payment(uuid, text, date, date) from anon;
revoke all on function public.process_recurring_payment(uuid, text, date, date) from authenticated;
grant execute on function public.process_recurring_payment(uuid, text, date, date) to service_role;
