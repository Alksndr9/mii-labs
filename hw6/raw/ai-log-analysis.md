Код проекта прочитать не удалось: доступ к файлам отклонён. Поэтому разбор опирается только на логи и на то, что значат коды PostgREST, Postgres и Supabase Auth. Всё, что касается конкретных таблиц и политик, — гипотезы, и ниже есть запросы для их проверки.

## Таблица инцидентов

| # | Окно (UTC) | Операция | Сигнал | Кол-во | Причина (кратко) | Серьёзность |
|---|---|---|---|---|---|---|
| I1 | 18:59:31–18:59:48 | `createOrder` | 400 · `23514` | 2 | Нарушено CHECK-ограничение в `orders`/`order_items` | Высокая |
| I2 | 19:01:05–19:01:06 | `createOrder` | 403 · `42501` | 2 (с разницей 1 с) | Запрет по RLS (`WITH CHECK`) или нет прав на таблицу у роли | Высокая |
| I3 | 19:01:07 | `fetchMyOrders` | 401 · `PGRST303` | 1 | JWT не прошёл проверку: истёк или подпись/claims не те | Средняя (возможно, связан с I2) |
| I4 | 19:03:44–19:03:58 | `fetchMeals` | network ×2 → 503 · `PGRST002` | 3 | PostgREST не может подключиться к Postgres и собрать кэш схемы | Критическая (каталог недоступен) |
| I5 | 19:06:22–19:06:29 | `sign_in` | 400 `invalid_credentials` ×2 → 429 `over_request_rate_limit` | 3 | Неверный пароль, затем сработал лимит Auth | Низкая/средняя (возможен перебор паролей) |
| — | 19:05:10 | `order_created` #17 | `clientTotal` 938 700 коп. = 9 387,00 ₽ | 1 | Заказ прошёл после 4 неудачных попыток | — |

Похоже, это одна сессия: вход → корзина → оформление → 4 ошибки → заказ через 6 минут. Но доказать это нельзя: в логах нет `sessionId` и `userId`. Об этом в разделе 5.

---

## 1. Группировка по причине

- **Данные и валидация (I1).** Сервер отклоняет заказ из-за ограничения в схеме. Клиент отправил данные, которые не проверил сам.
- **Авторизация и права (I2, I3).** Сначала 403 от RLS или GRANT, через 2 секунды 401 из-за невалидного JWT. Скорее всего, общая причина — состояние сессии или токена. Возможно и другое: в тот же день создана миграция `security_hardening`, она могла изменить политики или GRANT.
- **Доступность инфраструктуры (I4).** Сначала сетевые ошибки, затем 503 `PGRST002`. Значит, база была недоступна около 15+ секунд. К 19:05 всё восстановилось.
- **Аутентификация и безопасность (I5).** Неверные учётные данные и rate limit.

## 2. Вероятные первопричины

**I1 — `23514 check_violation`.** Значение не прошло `CHECK`: например, `total > 0`, `days IN (…)`, `quantity > 0`, ограничение на итог после промокода. Вторая попытка через 17 секунд дала ту же ошибку. Значит, пользователь повторил запрос без изменений: UI не объяснил, что не так. Потом заказ прошёл, но в каких полях payload отличался, по логам не видно. Стоит проверить взаимодействие промокода (`promoCodes.ts` есть в изменённых файлах) с итогом: отрицательная сумма или сумма вне допустимого диапазона.

**I2 — `42501 insufficient_privilege` при 403.** В PostgREST так выглядят два разных случая. Отличить их можно по `message`, но его нет в логе:
- `new row violates row-level security policy for table "orders"`: не прошёл `WITH CHECK`. Обычно в `user_id` уходит не `auth.uid()`, либо политика разрешает INSERT только роли `authenticated`.
- `permission denied for table orders` / `sequence orders_id_seq`: после hardening у роли отозвали `INSERT` или `USAGE` на sequence.

Два запроса с разницей 0,98 с означают двойной сабмит (кнопка не блокируется) или автоматический повтор. Повтор 403 бесполезен.

**I3 — `PGRST303`.** Ошибка проверки claims JWT, чаще всего `JWT expired`. С момента входа прошло всего 3 минуты, а по умолчанию токен живёт 3600 с. Поэтому подозрения такие: не сработал refresh токена, сменили JWT secret или ключи проекта, сбились часы на клиенте, или токен остался от старой сессии в другой вкладке. Если токен был невалиден уже при I2, PostgREST вернул бы 401, а не 403. Значит, при I2 токен ещё был валиден, и I2 — проблема политики или GRANT. А I3 — отдельная деградация сессии сразу после этого.

**I4 — `PGRST002`.** «Could not query the database for the schema cache». Postgres был недоступен или перегружен: рестарт (апгрейд, смена размера инстанса, применение миграции), исчерпан пул соединений, восстановление после паузы проекта. Сетевые ошибки без `status` перед этим — тот же сбой, увиденный раньше на уровне шлюза или таймаута. Ещё один вариант: у пользователя пропала сеть, но последний 503 указывает на сервер.

**I5.** Две неверные попытки входа, затем 429 уже на третьей, за 7 секунд. Для одного честного пользователя это слишком быстро. Вероятно, тот же IP уже выбрал лимит: другие вкладки, общий NAT или перебор паролей. Отдельный вопрос — зачем вход в 19:06, если сессия была активна. Возможно, после I3 SDK разлогинил пользователя.

## 3. Влияние на пользователя и бизнес (воронка)

```
auth_signed_in → add_to_cart (+38 с) → begin_checkout (+32 с) → [4 ошибки createOrder, 1 ошибка fetchMyOrders] → order_created (+5 мин 58 с)
```

- **I1 и I2 бьют по последнему шагу воронки**, где теряется самая дорогая конверсия. Здесь пользователь дошёл, но потратил ~6 минут и сделал 5+ попыток. В реальном трафике большая часть пользователей уходит после 1–2 непонятных ошибок. Если `23514` воспроизводится на определённой корзине (промокод, 7 дней), эта группа заказов не проходит у всех: это 100% потерь сегмента. Средний чек здесь 9 387 ₽.
- **Двойной сабмит (I2)** опасен дублями заказов, когда ошибка исчезнет. Идемпотентности нет.
- **I3:** пользователь не видит историю заказов. Возможен принудительный выход, а затем повторный вход и I5.
- **I4:** каталог недоступен, верх воронки обрывается для всех пользователей в окне сбоя, а не для одного.
- **I5:** пользователь не может войти, пока действует лимит. Это прямая потеря возвратного клиента. Если это атака — риск захвата аккаунтов.
- **Пробел в аналитике:** после `order_created` нет `analytics_goal: purchase`. Либо цель не отправляется, либо пишется в другой поток. Нужно проверить, иначе воронка в Метрике занижает конверсию.

## 4. Шаги диагностики

**Supabase Dashboard → Logs Explorer**, окно 18:58–19:07 UTC.

1. **API Gateway (`edge_logs`)**: все запросы к `/rest/v1/orders` и `/rest/v1/meals` со статусами 400/401/403/503, их IP, user-agent и `x-client-info`. Так можно проверить, одна ли это сессия.
   ```sql
   select timestamp, r.method, r.path, resp.status_code, h.cf_connecting_ip
   from edge_logs
   cross join unnest(metadata) m
   cross join unnest(m.request) r
   cross join unnest(r.headers) h
   cross join unnest(m.response) resp
   where timestamp between '2026-10-15T18:58:00Z' and '2026-10-15T19:07:00Z'
     and resp.status_code >= 400
   order by timestamp;
   ```
2. **Postgres logs**: полный текст ошибок `23514` и `42501` (там имя constraint, таблица, policy). Также рестарты и соединения около 19:03:
   ```sql
   select timestamp, p.error_severity, p.sql_state_code, event_message
   from postgres_logs cross join unnest(metadata) m cross join unnest(m.parsed) p
   where timestamp between '2026-10-15T18:59:00Z' and '2026-10-15T19:05:00Z'
     and (p.sql_state_code in ('23514','42501','53300','57P01','57P03')
          or event_message ilike any (array['%starting up%','%shutting down%','%too many connections%']))
   order by timestamp;
   ```
3. **PostgREST logs**: записи около 19:03:58 о перезагрузке schema cache и ошибках подключения.
4. **Auth logs**: события refresh токена после 18:58 (были ли `refresh_token_not_found` или `session_not_found`), попытки входа в 19:06 по IP:
   ```sql
   select created_at, ip_address, payload->>'action' as action, payload->>'actor_username' as actor
   from auth.audit_log_entries
   where created_at between '2026-10-15 18:55' and '2026-10-15 19:10'
   order by created_at;
   ```

**SQL Editor: проверка гипотез.**

```sql
-- I1: какие CHECK-ограничения есть
select conrelid::regclass, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.orders'::regclass, 'public.order_items'::regclass) and contype = 'c';

-- I2: политики и права после hardening
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where tablename in ('orders','order_items');

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_name in ('orders','order_items') and grantee in ('anon','authenticated');

select has_sequence_privilege('authenticated', 'public.orders_id_seq', 'USAGE');

-- Когда применили миграцию (совпадает ли с 19:01 / 19:03?)
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;

-- I2: воспроизвести INSERT от имени пользователя
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';
insert into public.orders (user_id, total /*, … */) values ('<user-uuid>', 938700);
rollback;

-- Заказ #17: совпадает ли серверная сумма с клиентской
select id, user_id, total, created_at from public.orders where id = 17;

-- I4: состояние соединений
select state, count(*) from pg_stat_activity group by state;
```

**Что ещё проверить:**
- Database → Reports: CPU, RAM и соединения около 19:03.
- status.supabase.com за этот интервал.
- Settings → API: менялся ли JWT secret или ключи.
- Auth → Rate Limits: текущие лимиты на sign-in.
- Payload I1 через DevTools или Sentry breadcrumbs: воспроизвести корзину «balance, 7 дней» с тем же промокодом.

## 5. Что улучшить в логировании

1. **Корреляция.** Добавить в каждое событие `sessionId` (случайный UUID на вкладку), `userIdHash` (не e-mail), `requestId` из заголовков ответа (`sb-request-id` / `cf-ray`). Сейчас нельзя ни склеить фронтовые логи с Supabase, ни понять, один это пользователь или пятеро.
2. **Полный `PostgrestError`.** Передавать `message`, `details` и `hint`, обрезанные и без значений пользователя. Для `23514` это имя constraint, для `42501` — различие между RLS и GRANT. Сейчас ключевая информация теряется.
3. **Контекст запроса:** `durationMs`, `attempt` / `isRetry`, `route`, `appVersion` (git SHA сборки), `navigator.onLine`. Для network-ошибок — `errorName` (`TypeError: Failed to fetch`, `AbortError`, timeout) и `status: 0` вместо пропущенного поля.
4. **Идемпотентность заказа.** Передавать `idempotencyKey` / `checkoutAttemptId` и логировать его для `createOrder`. Так видно двойные сабмиты, и их можно дедуплицировать на сервере.
5. **Деньги.** В `order_created` логировать и `clientTotal`, и `serverTotal` (а также `promoCode`, `days`, `dietId`). Расхождение — отдельное событие `total_mismatch`.
6. **Жизненный цикл сессии.** Логировать `onAuthStateChange` (`TOKEN_REFRESHED`, `SIGNED_OUT`, ошибки refresh) и время жизни токена. Без этого I3 не объяснить.
7. **Уровни.** Единая шкала (`debug/info/warn/error`). Ошибки, которые указывают на баг (`403/42501`, `23514`, `5xx`), — `error` с алертом. Ожидаемые пользовательские (`invalid_credentials`) — `warn`. Сейчас 403 на оплате записан как `warning`, а сетевая ошибка — как `error`.
8. **Аналитика воронки.** Добавить `checkout_submit` и `purchase` в `analytics_goal`, чтобы считать конверсию и время от `begin_checkout` до `order_created`.
9. **Гигиена.** Никогда не логировать пароли, токены и e-mail в открытом виде. Включить дедупликацию и сэмплирование повторяющихся ошибок, например при сбое I4 у тысячи пользователей. Добавить алерты по порогам: `createOrder` 4xx > N/мин, любой `PGRST002`, всплеск 429 на `sign_in` с одного IP.

Приоритет исправлений: сначала I4 (затрагивает всех) и I2 (блокирует оплату), затем I1 (понятная ошибка в UI и валидация на клиенте) и блокировка кнопки «Оформить» на время запроса. После этого — I3 и I5.
