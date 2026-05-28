# TG API Proxy — полное руководство с нуля

## О чём проект

Это Cloudflare Worker, который проксирует запросы к Telegram Bot API.
Вместо того чтобы стучаться напрямую на `api.telegram.org`, ты стучишься на свой воркер, а он уже пересылает запрос в Telegram.

**Зачем это нужно:**
- Если `api.telegram.org` заблокирован твоим провайдером
- Если хочешь добавить свою логику (логирование, лимиты, кеш)
- Если хочешь скрыть реальный IP своего сервера

**URL воркера:** `https://tg-api-proxy.demidenko.workers.dev`
**Использование:** `https://tg-api-proxy.demidenko.workers.dev/bot<TOKEN>/sendMessage`

---

## Структура проекта — что за файлы

```
tg-api-proxy/
├── worker.js                       # Код воркера (сам прокси)
├── wrangler.toml                   # Настройки Cloudflare
├── package.json                    # Настройки Node.js-пакета
├── package-lock.json               # Автоматический слепок зависимостей
├── .gitignore                      # Что НЕ заливать в Git
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions — авто-деплой
└── node_modules/                   # Папка с программами (не трогать!)
```

---

### 1. `worker.js` — САМ ВОРКЕР

Это единственный файл, который работает «в продакшене». Всё остальное — вспомогательная обвязка.

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'api.telegram.org';
    url.protocol = 'https:';
    url.port = '';

    const headers = new Headers(request.headers);
    headers.delete('host');

    return fetch(url.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });
  }
};
```

**Как работает:** Когда кто-то обращается к воркеру, Cloudflare вызывает функцию `fetch`. Она:
- Берёт URL запроса (например `/bot123:ABC/sendMessage`)
- Меняет хост на `api.telegram.org`
- Убирает лишний заголовок `host`
- Пересылает запрос в Telegram
- Возвращает ответ обратно

---

### 2. `wrangler.toml` — НАСТРОЙКИ ДЛЯ CLOUDFLARE

```toml
name = "tg-api-proxy"              # Имя воркера (как в дашборде)
main = "worker.js"                  # Какой файл загружать
compatibility_date = "2025-05-25"   # Версия Cloudflare Workers API
account_id = "daf5cb28..."          # ID твоего аккаунта Cloudflare

preview_urls = false                # Не создавать preview URL

[placement]
mode = "smart"                      # Smart Placement — сам выбирает регион
```

Этот файл нужен программе **Wrangler**, чтобы знать:
- какой воркер обновлять
- в каком аккаунте
- какой файл загружать

---

### 3. `package.json` — НАСТРОЙКИ ПАКЕТА (ДЛЯ WRANGLER)

```json
{
  "name": "tg-api-proxy",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "deploy": "wrangler deploy",         # Команда для деплоя
    "dev": "wrangler dev"                # Команда для локального теста
  },
  "devDependencies": {
    "wrangler": "^4.0.0"                 # Главная зависимость — Wrangler
  }
}
```

**Wrangler** — это программа от Cloudflare, которая загружает твой код на их сервера. Она ставится через `npm install`.

Команды:
- `npm run deploy` — запускает `wrangler deploy` (загрузить код на Cloudflare)
- `npm run dev` — запускает `wrangler dev` (запустить локально для теста)

---

### 4. `.gitignore` — ЧТО НЕ ЗАЛИВАТЬ В GIT

```
node_modules/       # Папка с пакетами — она тяжелая, восстанавливается через npm install
.wrangler/          # Кеш Wrangler
wrangler.toml.bak   # Бэкапы конфига
*.log               # Логи
.DS_Store           # Служебные файлы MacOS
```

Если случилось `git add -A` и залилось что-то лишнее — файл `.gitignore` спасает ситуацию.

---

### 5. `.github/workflows/deploy.yml` — АВТОМАТИЧЕСКИЙ ДЕПЛОЙ

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]            # Запускать при пуше в main
  workflow_dispatch:            # Или вручную через кнопку

env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}  # Токен из секретов

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4          # 1. Скачать код из Git
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22                 # 2. Поставить Node.js
          cache: npm
      - name: Install dependencies
        run: npm ci                        # 3. Установить Wrangler
      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy           # 4. Задеплоить на Cloudflare
```

Этот файл — инструкция для GitHub. Когда ты пушишь код, GitHub читает этот файл и делает то, что написано: шаг за шагом.

---

## Git и GitHub — что это и как работает

### Git (локально на твоём компе)

Git — это «сохранялка версий» для кода. Он запоминает, что и когда ты менял.

**Три команды, которые нужно знать:**

```bash
# 1. Посмотреть, что изменилось
git status

# 2. Сохранить изменения (создать «коммит»)
git add -A           # Добавить все изменения
git commit -m "что изменилось"    # Сохранить

# 3. Отправить на GitHub
git push
```

**Типичный цикл работы:**
```
Правишь код → git add → git commit → git push
```

### GitHub (облачный Git)

GitHub — это сервер, где хранятся твои Git-репозитории. Плюс он умеет запускать GitHub Actions (см. ниже).

**Как попадает код на GitHub:**
1. Ты делаешь `git push`
2. Git отправляет код из твоего компа на сервер GitHub
3. Код появляется в репозитории на `github.com/a-demidenko/tg-api-proxy`

---

## Что происходит, когда ты делаешь `git push`

Вот полная цепочка. Ниже — анимация в тексте.

```
┌── Ты ───────────────────────────────────────────────────┐
│                                                          │
│  1. Правишь worker.js в редакторе                        │
│  2. В консоли:                                           │
│     git add -A     ──  выбрать все изменения             │
│     git commit -m "пофиксил баг"  ──  сохранить          │
│     git push       ──  отправить на GitHub               │
│                                                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌── GitHub ───────────────────────────────────────────────┐
│                                                          │
│  3. Новый код появился в репозитории                     │
│  4. GitHub видит: есть файл .github/workflows/deploy.yml │
│     → Запускает GitHub Actions                           │
│                                                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌── GitHub Actions ───────────────────────────────────────┐
│                                                          │
│  5. GitHub создаёт временный сервер (Ubuntu)             │
│  6. Скачивает твой код (checkout@v4)                     │
│  7. Ставит Node.js (setup-node@v4)                       │
│  8. Ставит Wrangler (npm ci)                             │
│  9. Запускает: npx wrangler deploy                       │
│                                                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌── Cloudflare ───────────────────────────────────────────┐
│                                                          │
│  10. Wrangler подключается по API токену                 │
│  11. Читает wrangler.toml (имя воркера, account_id)      │
│  12. Загружает worker.js                                 │
│  13. Cloudflare компилирует и обновляет воркер           │
│  14. Готово! 🟢                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Всё это занимает ~20 секунд.**

---

## Что такое API токен и зачем он нужен

Cloudflare не пускает чужих к себе. Чтобы Wrangler мог загрузить код, ему нужно «удостоверение личности» — **API токен**.

**Где взять:** https://dash.cloudflare.com/profile/api-tokens
**Создать:** «Create Token» → «Edit Cloudflare Workers»
**Права:** доступ к Workers твоего аккаунта

Этот токен хранится в **GitHub Secrets** — специальном хранилище секретов. Никто не видит его, даже ты после сохранения. GitHub Actions использует его, но не показывают в логах.

**Как добавить:**
```
GitHub → Repo → Settings → Secrets and variables → Actions → New secret
Name: CLOUDFLARE_API_TOKEN
Value: <твой токен>
```

---

## Все команды — шпаргалка

### Каждый день (работа с кодом)

```bash
# Посмотреть текущее состояние
git status

# Внести изменения → сохранить → отправить
git add -A
git commit -m "что изменил"
git push
# Всё! Дальше GitHub сам сделает деплой на Cloudflare
```

### Разово (настройка проекта)

```bash
# Установить Wrangler (после клонирования репозитория)
npm install

# Задеплоить руками (без GitHub)
npm run deploy

# Запустить локально (тестировать)
npm run dev
```

---

## Как выглядит работа в реале

### Сценарий 1 — Быстрый фикс (надо прямо сейчас)

Правишь код в редакторе, потом в консоли:

```bash
git add -A
git commit -m "пофиксил отправку сообщений"
git push
```

→ через 20 секунд код уже на Cloudflare.

### Сценарий 2 — Проверить локально перед деплоем

```bash
npm run dev
```

→ Wrangler запустит воркер на `localhost:8787`. Шлёшь запросы, проверяешь.
Если всё ок — `git push`.

### Сценарий 3 — Ручной деплой (не трогать Git)

```bash
npm run deploy
```

→ Wrangler обновит воркер напрямую, без GitHub. Удобно когда не хочешь коммитить «черновик».

---

## Разница: как было vs как стало

| | Было (через дашборд) | Стало (через Git + Actions) |
|---|---|---|
| Где код | В браузере | В Git-репозитории |
| История | Нет | Каждый коммит — снимок |
| Вернуться назад | Копировать вручную | `git revert` |
| Авто-деплой | Нет | Push → автоматически на Cloudflare |
| Кто может менять | Ты | Ты + любые, кому дашь доступ к репо |

---

## Если что-то пошло не так

**Ошибка:** `Wrangler requires at least Node.js v22.0.0`
→ В workflow стоит `node-version: 22`, проверь что пушнул последнюю версию файла.

**Ошибка:** `Process completed with exit code 1` в GitHub Actions
→ Нажми на шаг «Deploy to Cloudflare Workers», там будет конкретная ошибка.

**Воркер не обновился:**
→ Проверь, что `CLOUDFLARE_API_TOKEN` добавлен в GitHub Secrets.
→ Проверь, что имя воркера в `wrangler.toml` совпадает с именем в дашборде Cloudflare.

**Не могу сделать push:**
→ Нужно добавить remote (один раз):
```bash
git remote add origin https://github.com/a-demidenko/tg-api-proxy.git
```
