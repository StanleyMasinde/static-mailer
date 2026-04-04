# StaticMailer
Send email from static websites through an authenticated API key workflow.

## Features
- User auth (`register`, `login`, `me`, password reset, Google social auth).
- Per-user API key management.
- Public delivery endpoint guarded by API key and rate limiting.
- Email submission logging (`delivery_status`, `sender_ip`, timestamps).
- JSON:API-style responses for `/v1/*` and `/api/v1/*` routes.

## Requirements
- Node.js (current LTS)
- `pnpm`
- MySQL
- SMTP server (Mailpit is a good local option)

## Quickstart
1. Install dependencies.
```bash
pnpm install
```
2. Copy environment values.
```bash
cp .env.example .env
```
3. Create the database schema from `.env` (`DATABASE_SCHEMA`) if it does not already exist.
4. Build TypeScript and run migrations.
```bash
pnpm build
node dist/scripts/migrateLatest.js
```
5. Start the server.
```bash
pnpm start
```

The server starts on `https://localhost:<APP_PORT>` (default `3000`) using local certs in `keys/`.

## Development workflow
`dev` runs `nodemon` on built files in `dist/`, so keep a build watcher running in another shell:

```bash
pnpm build --watch
pnpm dev
```

## Tests
Tests compile TypeScript and run latest migrations before `vitest` (`pretest` script).

```bash
pnpm test
```

Make sure MySQL is running and your test environment points to an isolated schema.

## Environment variables
Required for startup validation:
- `APP_URL`
- `DATABASE_CLIENT`
- `DATABASE_HOST`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_SCHEMA`
- `MAILER_HOST`
- `MAILER_PORT`
- `JWT_SECRET` (minimum 32 chars outside test env)

Common optional settings:
- `APP_PORT` (defaults to `3000`)
- `JWT_ACCESS_EXPIRES_IN` (defaults to `15m`)
- `REFRESH_TOKEN_TTL_DAYS` (defaults to `30`)
- `DASHBOARD_URL` (used by `GET /dashboard` redirect)
- `CORS_ALLOWLIST` (comma-separated; defaults to `APP_URL`)
- `COMPANY_NAME`, `COMPANY_URL`
- `MAILER_USERNAME`, `MAILER_PASSWORD`
- `MAILER_SECURE`, `MAILER_REQUIRE_TLS` (`true`/`false`)
- `MAILER_FROM_NAME`, `MAILER_FROM_EMAIL`
- `SENTRY_DSN`
- `GOOGLE_CLIENT_ID` (required only for Google social auth)

Use `.env.example` as the canonical template.

## API behavior and headers
For `/v1/*` and `/api/v1/*` endpoints:
- Set `Accept: application/vnd.api+json`.
- For `POST`, `PUT`, `PATCH`, set `Content-Type: application/vnd.api+json`.

If these are wrong, the API returns:
- `406 Not Acceptable` for unsupported `Accept`.
- `415 Unsupported Media Type` for unsupported `Content-Type`.

## Key endpoints
- `GET /ping`
- `GET /dashboard`
- `POST /v1/register`
- `POST /v1/login`
- `POST /v1/token/refresh`
- `GET /v1/me`
- `POST /v1/password-reset`
- `POST /v1/password-update`
- `POST /v1/social-auth/google`
- `POST /v1/apiKeys`
- `GET /v1/apiKeys`
- `DELETE /v1/apiKeys/:uuid`
- `POST /api/v1/deliver/:apiKey`

## OpenAPI
- OpenAPI 3.x specification: `openapi.yaml`
- Served by API at: `GET /openapi.yaml`
- Interactive docs UI (Swagger-style): `GET /docs`

## Example requests
Register:
```bash
curl -k https://localhost:3000/v1/register \
  -H 'Accept: application/vnd.api+json' \
  -H 'Content-Type: application/vnd.api+json' \
  -d '{"name":"Jane","email":"jane@example.com","password":"supersecretpassword"}'
```

Login:
```bash
curl -k https://localhost:3000/v1/login \
  -H 'Accept: application/vnd.api+json' \
  -H 'Content-Type: application/vnd.api+json' \
  -d '{"email":"jane@example.com","password":"supersecretpassword"}'
```

Create API key (replace `TOKEN`):
```bash
curl -k https://localhost:3000/v1/apiKeys \
  -H 'Accept: application/vnd.api+json' \
  -H 'Content-Type: application/vnd.api+json' \
  -H 'Authorization: Bearer TOKEN' \
  -d '{"name":"portfolio-site"}'
```

Deliver mail with a raw API key:
```bash
curl -k https://localhost:3000/api/v1/deliver/YOUR_RAW_API_KEY \
  -H 'Accept: application/vnd.api+json' \
  -H 'Content-Type: application/vnd.api+json' \
  -d '{"subject":"Hello","email":"visitor@example.com","message":"I would like to work with you."}'
```

## API key security model
- New keys are returned only once as `meta.raw_key` when created.
- Persisted key records expose metadata only (`uuid`, `name`, `key_last4`, timestamps).
- Store `raw_key` securely on the client side when it is first issued.

## Deployment (systemd)
This app is suited to running behind a reverse proxy (Nginx/Caddy) with `systemd` managing the Node process.

1. Build and migrate on the server:
```bash
pnpm install --frozen-lockfile
pnpm build
node dist/scripts/migrateLatest.js
```
2. Create a production env file (example: `/etc/static-mailer/static-mailer.env`) with values from `.env.example`.
   Do not deploy the project `.env` file to production. Keep runtime secrets in a root-owned file outside the repo and load it via `EnvironmentFile=`.
3. Ensure TLS key files exist at `keys/localhost-cert.pem` and `keys/localhost-privkey.pem` under the app directory, or update the code/service to point to your production cert paths.

Example unit file (`/etc/systemd/system/static-mailer.service`):

```ini
[Unit]
Description=StaticMailer API
After=network.target mysql.service
Wants=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/static-mailer
Environment=NODE_ENV=production
EnvironmentFile=/etc/static-mailer/static-mailer.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now static-mailer
```

Operational commands:
```bash
sudo systemctl status static-mailer
sudo journalctl -u static-mailer -f
sudo systemctl restart static-mailer
```

Typical release/update flow:
```bash
git pull
pnpm install --frozen-lockfile
pnpm build
node dist/scripts/migrateLatest.js
sudo systemctl restart static-mailer
```

## Useful commands
- `pnpm build`
- `pnpm build --watch`
- `pnpm dev`
- `pnpm start`
- `pnpm test`
- `pnpm lint`
