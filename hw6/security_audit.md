# Отчёт по аудиту безопасности

**Дата:** 15.10.2026 · **Объект:** репозиторий `mii-labs` (React SPA, схема Supabase, GitHub Actions)

## 1. Методика
| Проверка | Инструмент | Результат |
|---|---|---|
| Уязвимые зависимости | `npm audit` (prod и dev) | **0 уязвимостей** ([raw/npm-audit.json](raw/npm-audit.json)) |
| Код и конфигурация по OWASP Top 10 (2021) | AI-аудит: Claude Code в режиме только чтения ([raw/ai-security-audit.md](raw/ai-security-audit.md)) | **16 находок**: 3 high, 6 medium, 7 low |
| Регрессия после исправлений | автотесты, `tsc`, сборка, проверка рендера с CSP в headless Chrome | 96/96 тестов, сборка ок |

Промпт AI-аудита:
> Проведи аудит безопасности этого проекта по OWASP Top 10 (2021). Проверь app/src, supabase/migrations, .github/workflows, конфиги. Особое внимание: XSS, CSRF, SQL-инъекции, broken access control (RLS), хранение секретов и токенов, доверие к данным с клиента (сумма заказа!), security misconfiguration, логирование ПДн. Файлы не изменяй. Формат: таблица находок (ID, категория OWASP, файл, описание, критичность, рекомендация).

## 2. Найденные уязвимости и исправления

| ID | OWASP | Уязвимость | Крит. | Исправление | Статус |
|---|---|---|---|---|---|
| F-01 | A04 Insecure Design | Сумма заказа считалась в браузере и сохранялась как есть — через DevTools можно оформить заказ за 1 ₽ | **high** | RPC `create_order`: сервер сам считает сумму по ценам из БД (скидка за срок, порог доставки, промокод); прямой INSERT в `orders` запрещён | ✅ |
| F-02 | A04 | Промокоды и номиналы лежали в JS-бандле, промокод не сохранялся в заказе | **high** | таблица `promo_codes` без доступа для клиента; проверка через RPC `get_promo(code)` только по точному коду; код сохраняется в заказе | ✅ (демо-коды остаются только для режима без бэкенда) |
| F-03 | A04/A03 | `items` (jsonb) не валидировался: произвольный JSON, несуществующие рационы | **high** | `create_order` проверяет: 1–20 позиций, `diet_id` существует, `days ∈ {1,5,7}`, `quantity` 1–20 | ✅ |
| F-04 | A02/A07 | Google OAuth в implicit flow — `access_token` попадает в URL, историю браузера и аналитику | medium | `flowType: 'pkce'` в supabase-js: в URL только одноразовый `code` | ✅ |
| F-05 | A05 Misconfiguration | Нет Content Security Policy; JWT в `localStorage` уязвим при любом XSS | medium | CSP meta-тегом в production-сборке (Vite-плагин): только свои скрипты + Google Analytics, `object-src 'none'`, `base-uri 'self'` | ✅ |
| F-06 | A08 Integrity | Сторонний скрипт аналитики имеет доступ к DOM и `localStorage` | medium | в события не передаются ПДн, домены ограничены CSP; риск принят как цена аналитики. _Аудит проводился для Яндекс.Метрики (вебвизор отключён); после перехода на GA4 вывод тот же_ | ⚠️ принят |
| F-07 | A05 | Без секретов в CI прод тихо собирается в демо-режиме, `RequireAuth` пропускает всех | medium | баннер «Демо-режим» в UI + предупреждение в CI при отсутствии секретов | ✅ |
| F-08 | A01 Broken Access Control | Supabase по умолчанию выдаёт `anon`/`authenticated` права ALL (включая TRUNCATE, который не учитывает RLS) | medium | `revoke all` + явные `grant`: `select` на `meals`, `select` и `update(status)` на `orders` | ✅ |
| F-09 | A01/A04 | Клиент мог задать `created_at` и другие служебные поля при INSERT | low | закрыто F-01: вставка только через RPC | ✅ |
| F-10 | A04 | `CHECK (delivery_date >= current_date + 2)` перепроверяется при UPDATE — отмена заказа ломается за 2 дня до доставки | low | проверка даты перенесена в `create_order`, CHECK удалён | ✅ |
| F-11 | A07 Auth Failures | Пароль от 6 символов; сообщение «пользователь уже существует» раскрывает зарегистрированные email | low | минимум 8 символов, общее сообщение об ошибке регистрации | ✅ |
| F-12 | A09 Logging | В лог писался сырой `error.message` Postgres — в нём бывают значения строк (ПДн) | low | логируются только `operation`, `kind`, `status`, `code` | ✅ |
| F-13 | A08 Supply chain | В `health.yml` нет блока `permissions`; actions закреплены тегами, а не SHA | low | `permissions: contents: read`; закрепление по SHA — в бэклог | ✅ / ⚠️ |
| F-14 | A06 Vulnerable Components | CI блокировался только на high-уязвимостях prod-зависимостей | low | добавлен отчётный шаг полного `npm audit --audit-level=moderate` | ✅ |
| F-15 | A05 | anon-ключ в `vars`, а не `secrets` | low | перенесён в `secrets` | ✅ |
| F-16 | A01 | `health()` — `security definer`, доступна анонимно | info | функция отдаёт только статус и число рационов; оставлена осознанно, `search_path` зафиксирован | ⚠️ принят |

Исправления БД — отдельной миграцией [`20261015010000_security_hardening.sql`](../supabase/migrations/20261015010000_security_hardening.sql).

## 3. Защита от распространённых атак
| Атака | Защита |
|---|---|
| **XSS** | React экранирует вывод; `dangerouslySetInnerHTML` запрещён правилами проекта (ДЗ2) и не используется; CSP запрещает чужие скрипты |
| **CSRF** | API аутентифицируется заголовком `Authorization: Bearer <JWT>`, а не cookie — браузер не подставит его в межсайтовый запрос; OAuth через PKCE + state |
| **SQL injection** | запросы строит PostgREST/supabase-js с параметризацией; в RPC — только параметры PL/pgSQL, динамического SQL нет; `search_path = ''` в `security definer` функциях |
| **Broken access control** | RLS на всех таблицах + минимальные `grant`; изменение заказа — только `status → cancelled` |
| **Подмена цены** | сумма считается на сервере (F-01) |
| **Перебор паролей** | rate limit Supabase Auth (`over_request_rate_limit`), минимум 8 символов |

## 4. Рекомендации
1. **Перед продакшеном:** перенести ПДн в РФ (152-ФЗ), включить подтверждение email и защиту от утёкших паролей в Supabase Auth, настроить SMTP.
2. Закрепить GitHub Actions по commit SHA и включить Dependabot для `npm` и `github-actions`.
3. Перенести оплату на сервер (Supabase Edge Function + webhook ЮKassa), статус `paid` выставлять только по webhook.
4. Повторять AI-аудит при каждом изменении схемы БД или авторизации — например, шагом в CI по pull request.
