-- ДЗ6. Исправления по результатам аудита безопасности (hw6/security_audit.md).

-- F-08: по умолчанию Supabase выдаёт anon/authenticated все права на таблицы public.
-- Оставляем только необходимые, RLS остаётся вторым рубежом.
revoke all on public.meals, public.orders from anon, authenticated;
grant select on public.meals to anon, authenticated;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

-- F-01, F-03, F-09: клиент больше не вставляет заказ напрямую — только через create_order,
-- которая сама считает сумму по ценам из БД, проверяет позиции и подставляет служебные поля.
drop policy "Пользователь создаёт заказ только от своего имени" on public.orders;

-- F-10: CHECK с current_date перепроверяется при каждом UPDATE и ломает отмену заказа
-- ближе к дате доставки. Дату проверяем только при создании (в create_order).
alter table public.orders drop constraint if exists orders_delivery_date_check;
alter table public.orders add column promo_code text;

-- F-02: промокоды хранятся на сервере, клиенту недоступен список (нет SELECT-политики).
create table public.promo_codes (
  code      text primary key check (code = upper(code)),
  kind      text not null check (kind in ('percent', 'fixed')),
  value     integer not null check (value > 0),
  active    boolean not null default true,
  check (kind <> 'percent' or value <= 100)
);
alter table public.promo_codes enable row level security;
revoke all on public.promo_codes from anon, authenticated;

insert into public.promo_codes (code, kind, value) values
  ('ZELEN10', 'percent', 10),
  ('MINUS500', 'fixed', 50000);

-- Проверка промокода без раскрытия всего списка: только по точному коду
create or replace function public.get_promo(p_code text)
returns table (kind text, value integer)
language sql
stable
security definer
set search_path = ''
as $$
  select kind, value from public.promo_codes where code = upper(trim(p_code)) and active;
$$;

-- Расчёт повторяет calculateOrderTotal (ТЗ, раздел 7.2): скидка за срок по строке → порог доставки → промокод
create or replace function public.create_order(
  p_street text, p_house text, p_apartment text, p_phone text,
  p_delivery_date date, p_items jsonb, p_promo_code text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_price integer;
  v_days integer;
  v_qty integer;
  v_line integer;
  v_goods integer := 0;
  v_promo record;
  v_promo_discount integer := 0;
  v_delivery integer;
  v_order_id bigint;
begin
  if v_user is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'items: 1..20 positions' using errcode = '23514';
  end if;
  if p_delivery_date < current_date + 2 then
    raise exception 'delivery_date: not earlier than +2 days' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_days := (v_item ->> 'days')::integer;
    v_qty := (v_item ->> 'quantity')::integer;
    select price_per_day into v_price from public.meals where id = v_item ->> 'diet_id';
    if v_price is null or v_days not in (1, 5, 7) or v_qty not between 1 and 20 then
      raise exception 'invalid item %', v_item using errcode = '23514';
    end if;
    v_line := v_price * v_days * v_qty;
    v_line := v_line - round(v_line * (case v_days when 5 then 5 when 7 then 10 else 0 end) / 100.0)::integer;
    v_goods := v_goods + v_line;
  end loop;

  v_delivery := case when v_goods >= 500000 then 0 else 30000 end;

  if p_promo_code is not null and p_promo_code <> '' then
    select kind, value into v_promo from public.promo_codes where code = upper(trim(p_promo_code)) and active;
    if not found then
      raise exception 'promo not found' using errcode = '23514';
    end if;
    v_promo_discount := least(v_goods,
      case v_promo.kind when 'percent' then round(v_goods * v_promo.value / 100.0)::integer else v_promo.value end);
  end if;

  insert into public.orders (user_id, status, street, house, apartment, phone, delivery_date, items, total, promo_code)
  values (v_user, 'pending_payment', p_street, p_house, nullif(p_apartment, ''), p_phone, p_delivery_date,
          p_items, v_goods - v_promo_discount + v_delivery, upper(trim(p_promo_code)))
  returning id into v_order_id;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order from public, anon;
grant execute on function public.create_order to authenticated;
grant execute on function public.get_promo to anon, authenticated;
