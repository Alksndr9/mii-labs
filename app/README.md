# «Зелень» — веб-приложение заказа рационов здорового питания

MVP сквозного проекта курса МИИ. Каталог рационов → карточка рациона → корзина со скидками и промокодом → оформление заказа.

**Демо:** https://alksndr9.github.io/mii-labs/

## Стек
React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router (HashRouter) · Vitest + React Testing Library · Supabase · oxlint

## Запуск локально
```bash
cd app
npm install
npm run dev        # http://localhost:5173/mii-labs/
```

Без переменных окружения приложение работает на mock-данных. Для работы с Supabase создайте `app/.env.local` по образцу `.env.example`.

## Команды
| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер с hot reload |
| `npm test` | автотесты (Vitest) |
| `npm run lint` | линтер (oxlint) |
| `npm run build` | проверка типов и production-сборка в `dist/` |
| `npm run preview` | просмотр production-сборки |

## Структура
```
src/
├── App.tsx                 # маршруты
├── app/Layout.tsx          # шапка и каркас страницы
├── features/               # код по фичам
│   ├── catalog/            # каталог, карточка и страница рациона, API рационов
│   ├── cart/               # корзина, расчёт стоимости (calculateOrderTotal), промокоды
│   └── checkout/           # форма адреса, оформление заказа, API заказов
└── shared/                 # общий код: API-клиент, UI-состояния, форматирование, типы
```

## Промокоды для проверки
`ZELEN10` — скидка 10%, `MINUS500` — скидка 500 ₽.
