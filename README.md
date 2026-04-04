## StaticMailer
Send emails from a static website.

### What it does
- Handles user auth (`register`, `login`, `me`, social auth).
- Issues and manages API keys per user.
- Accepts public email submissions with an API key and forwards them via SMTP.
- Tracks submission metadata (`delivery_status`, `sender_ip`, timestamps).

### Requirements
- Node.js (current LTS recommended)
- MySQL
- SMTP server (Mailpit works for local development)

### Setup
1. Copy envs:
```bash
cp .env.example .env
```
2. Install dependencies:
```bash
pnpm install
```
3. Build and run migrations:
```bash
pnpm build
node dist/scripts/migrateLatest.js
```
4. Start server:
```bash
pnpm start
```

### Environment variables
- `APP_PORT`, `APP_URL`
- `JWT_SECRET`
- `DATABASE_CLIENT`, `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_SCHEMA`
- `MAILER_HOST`, `MAILER_PORT`, `MAILER_USERNAME`, `MAILER_PASSWORD`, `MAILER_SECURE`
- `SENTRY_DSN` (optional)
- `GOOGLE_CLIENT_ID` (required for `/v1/social-auth/google`)

### Key endpoints
- `GET /ping`
- `POST /v1/register`
- `POST /v1/login`
- `GET /v1/me`
- `POST /v1/password-reset`
- `POST /v1/password-update`
- `POST /v1/social-auth/google`
- `POST /v1/apiKeys`
- `GET /v1/apiKeys`
- `DELETE /v1/apiKeys/:uuid`
- `POST /api/v1/deliver/:apiKey`

### Commands
- `pnpm build`
- `pnpm test`
- `pnpm start`
