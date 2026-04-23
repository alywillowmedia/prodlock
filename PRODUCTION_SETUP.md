# ProdLock Production Setup

This app is ready to run against Supabase Postgres and deploy on Vercel. There are still a few values that have to be filled in from your dashboards because they depend on your real secrets and final Vercel URL.

## 1. Supabase database

Create a dedicated database user for Prisma in your new Supabase project, then give it schema privileges. In Supabase SQL editor:

```sql
create user "prisma" with password 'replace_with_a_generated_password' bypassrls createdb;
grant "prisma" to "postgres";

grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;

alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

Then gather two connection strings from Supabase:

- `DATABASE_URL`: Supavisor transaction mode (`:6543`) with `?pgbouncer=true&connection_limit=1`
- `DIRECT_URL`: direct database string (`db.<project-ref>.supabase.co:5432`) for Prisma migrations

Use `.env.example` as the template for your real environment variables.

## 2. Vercel project

Import this repo into Vercel and use the `prodlock/` directory as the project root if Vercel asks for one.

Set these environment variables in Vercel for Production:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `NODE_ENV=production`
- `PORT=3000`

The repo includes `vercel.json`, which tells Vercel to run:

```bash
npm run vercel-build
```

That build runs Prisma generate, applies pending migrations, and builds the React Router app.

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
