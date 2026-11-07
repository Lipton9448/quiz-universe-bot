# Деплой (бот + Mini App) бесплатно, без сна

## Важно: безопасность
Токен бота, который ты присылал в чат, **уже скомпрометирован**. После деплоя:
1. Открой @BotFather → `/mybots` → выбери бота → **API Token** → **Revoke current token**.
2. Получи новый токен и обнови его в настройках хостинга (переменная `BOT_TOKEN`).

Никогда не публикуй `.env` и токены в GitHub/чатах.

## 1) Mini App на GitHub Pages (бесплатно, навсегда, не спит)
Статическая версия лежит в `miniapp-static/` и деплоится GitHub Actions.

1. Убедись, что изменения запушены в `main` репозитория `Lipton9448/quiz-universe-bot`:
   ```powershell
   cd "C:\Users\Asus\OneDrive\Документы\deepseek-harness\default-workspace"
   git add -A
   git commit -m "Deploy prep: health port, static miniapp, pages workflow"
   git push origin main
   ```
2. В GitHub открой репозиторий → **Settings → Pages**.
3. В **Build and deployment → Source** выбери **GitHub Actions**.
4. Открой вкладку **Actions** и дождись успешного workflow **Deploy Mini App to GitHub Pages**.
5. URL Mini App будет: `https://lipton9448.github.io/quiz-universe-bot/`

> Статическая Mini App хранит личную статистику в браузере (localStorage). Глобальный рейтинг через сервер можно добавить позже, задеплоив `miniapp/server.js`.

## 2) Бот на Northflank Sandbox (бесплатно, без карты, без сна)
Northflank Sandbox (по их странице pricing на момент проверки): Free, без карты, **Always on, no sleeping**, до 2 services/jobs/1 database и лимит ресурсов sandbox.

1. Зарегистрируйся: https://app.northflank.com/signup
2. Создай **Project** (например `quiz-universe`).
3. **Create service** → выбери деплой из **Git repository** (подключи GitHub и выбери `Lipton9448/quiz-universe-bot`).
4. Настройки сервиса:
   - **Build**: Dockerfile (в корне репозитория) или buildpack/Node — проект содержит `Dockerfile`.
   - **Command**: `npm start` (уже в Dockerfile; если спрашивают явно — `npm start`).
   - **Port**: не обязателен для polling, но бот слушает `PORT` и отдаёт `/health` (полезно для проверок).
5. **Environment variables / Secrets**:
   - `BOT_TOKEN` = *твой токен от @BotFather* (после revoke — новый)
   - `BOT_USERNAME` = `quiz_universe_ru_bot` (без `@`)
   - `MINIAPP_URL` = `https://lipton9448.github.io/quiz-universe-bot/` (после деплоя Pages)
6. Выбери бесплатные/минимальные ресурсы в пределах Sandbox и задеплой.
7. Открой логи сервиса — должно быть `[ok] Quiz Universe Bot запущен` и `[http] health server on :...`.

## 3) Проверка
- В Telegram отправь боту `/start` → выбери категорию → пройди квиз.
- Открой `https://lipton9448.github.io/quiz-universe-bot/` в браузере/через Telegram Web App URL (если настроишь в BotFather `/myapps`).

## 4) Если Northflank попросит апгрейд/лимиты
Альтернативы для бота 24/7 без сна: Oracle Cloud Always Free VM (нужна карта для верификации, не списывает), или Render + UptimeRobot (Render спит, UptimeRobot будит пингами). Для Mini App GitHub Pages остаётся лучшим бесплатным вариантом.
