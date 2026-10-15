-- ДЗ5. Схема БД сервиса «Зелень»: рационы, заказы, RLS-политики, health check.
-- Деньги храним в копейках (integer), чтобы не было ошибок округления float.

create type public.meal_goal as enum ('balance', 'weight-loss', 'sport', 'vegetarian');
create type public.order_status as enum ('pending_payment', 'paid', 'delivering', 'completed', 'cancelled');

-- Рационы: справочник, редактируется через миграции/Supabase Studio (админки в MVP нет)
create table public.meals (
  id             text primary key,
  title          text not null check (char_length(title) between 1 and 80),
  description    text not null default '',
  goal           public.meal_goal not null,
  calories       integer not null check (calories between 800 and 5000),
  meals_per_day  smallint not null check (meals_per_day between 1 and 8),
  price_per_day  integer not null check (price_per_day > 0),
  image_url      text not null default '',
  is_hit         boolean not null default false,
  menu           text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- Заказы: принадлежат пользователю, user_id подставляется из JWT автоматически
create table public.orders (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status         public.order_status not null default 'pending_payment',
  street         text not null check (char_length(street) between 2 and 100),
  house          text not null check (char_length(house) between 1 and 20),
  apartment      text check (apartment is null or char_length(apartment) <= 10),
  phone          text not null check (phone ~ '^\+7\d{10}$'),
  delivery_date  date not null check (delivery_date >= current_date + 2),
  items          jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total          integer not null check (total >= 0),
  created_at     timestamptz not null default now()
);

create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);

-- Row Level Security: без политики доступ к таблице запрещён
alter table public.meals enable row level security;
alter table public.orders enable row level security;

create policy "Каталог доступен всем"
  on public.meals for select
  to anon, authenticated
  using (true);

create policy "Пользователь видит только свои заказы"
  on public.orders for select
  to authenticated
  using (user_id = auth.uid());

create policy "Пользователь создаёт заказ только от своего имени"
  on public.orders for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending_payment');

-- Единственное изменение, доступное клиенту, — отмена неоплаченного заказа
create policy "Пользователь отменяет свой неоплаченный заказ"
  on public.orders for update
  to authenticated
  using (user_id = auth.uid() and status = 'pending_payment')
  with check (user_id = auth.uid() and status = 'cancelled');

-- Клиент может менять только статус, а не адрес или сумму
revoke update on public.orders from authenticated;
grant update (status) on public.orders to authenticated;

-- Health check для мониторинга (ДЗ6): POST /rest/v1/rpc/health
create or replace function public.health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', 'ok',
    'db', true,
    'meals', (select count(*) from public.meals),
    'time', now()
  );
$$;

grant execute on function public.health() to anon, authenticated;
