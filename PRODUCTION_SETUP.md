# ProdLock Production Setup

This app is ready to run against Supabase Postgres and deploy on Vercel. There are still a few values that have to be filled in from your dashboards because they depend on your real secrets and final Vercel URL.

## 1. Supabase database

Gather two connection strings from Supabase:

- `DATABASE_URL`: Supavisor transaction mode (`:6543`) with `?pgbouncer=true&connection_limit=1`
- `DIRECT_URL`: on Vercel, use the Supavisor session mode string (`:5432`) for Prisma migrations

Use `.env.example` as the template for your real environment variables.
If `DIRECT_URL` is temporarily missing, the app now falls back to `DATABASE_URL` for Prisma CLI commands so builds do not die at schema-parse time, but a real `DIRECT_URL` is still recommended.
Do not use the direct `db.<project-ref>.supabase.co:5432` host on Vercel unless you have confirmed IPv6 support or enabled Supabase's IPv4 add-on.

## 2. Vercel project

Import this repo into Vercel and use the `prodlock/` directory as the project root if Vercel asks for one.

Set these environment variables in Vercel for Production:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `CRON_SECRET` (optional but recommended)
- `NODE_ENV=production`
- `PORT=3000`

The repo includes `vercel.json`, which tells Vercel to run:

```bash
npm run vercel-build
```

That build runs Prisma generate, applies pending migrations, and builds the React Router app.

`vercel.json` also schedules `/cron/supabase-health` once per day. The route checks the `Session` table and Prisma migration log, then writes an `ok` / `not ok` row to `SupabaseHealthCheck`. That gives the Supabase project regular database activity and leaves a simple status trail. If `CRON_SECRET` is set, Vercel will send it as a bearer token and the endpoint will reject requests without it.

## Applying Migrations

Database changes are handled by Prisma migrations. Run `npm run prisma:deploy`, or let Vercel run `npm run vercel-build`. These create and update the app tables, including `Session`, `_prisma_migrations`, and `SupabaseHealthCheck`.

## 3. Shopify app config

Once Vercel gives you the real production URL, update `shopify.app.toml`:

```toml
application_url = "https://your-real-vercel-url.vercel.app"

[auth]
redirect_urls = [ "https://your-real-vercel-url.vercel.app/auth/callback" ]
```

Then deploy the Shopify app config:

```bash
cd /Users/jonah/ProdLock/prodlock
shopify app deploy
```

If you use multiple Shopify environments later, it is worth splitting this into separate TOML files so development and production URLs do not fight each other.

## 4. After the first production deploy

1. Open the app in Shopify admin.
2. Confirm OAuth completes against the Vercel URL.
3. Re-run theme integration on the live theme if needed.
4. Confirm the `ProdLock Gate` embed and the validation function are both active.
5. Test a guest account, a retail customer, and an allowlisted wholesale customer.

## 5. GitHub push note

This repo can be connected to GitHub normally, but pushing still depends on your local GitHub auth being set up on this machine. If GitHub Desktop or the terminal says it cannot authenticate, use either:

- GitHub CLI: `gh auth login`
- SSH remote with a loaded SSH key
- HTTPS remote with a personal access token
