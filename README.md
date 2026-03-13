# Blendle

Blendle is a daily color-blending game built with Next.js 15, Prisma, and PostgreSQL.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file and fill in your database values if you want Prisma-backed storage:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

If you do not set `DATABASE_URL`, the app falls back to a local JSON store in development only.

## Supabase setup

Use two Postgres connection strings from Supabase:

- `DATABASE_URL`: the pooled Supavisor connection string on port `6543`
- `DIRECT_URL`: the direct database connection string on port `5432`

That split lets the deployed app use pooling while Prisma migrations still connect directly.

After adding your env vars locally, run:

```bash
npx prisma migrate dev
```

## Deploy to Vercel

Vercel is the right target for this app because it uses dynamic Next.js API routes. GitHub Pages would not support the server-side gameplay and persistence pieces.

1. Push this repo to GitHub.
2. Create a new Vercel project and import the repo.
3. In Vercel, add these environment variables for Production and Preview:

```text
DATABASE_URL=your Supabase pooled connection string
DIRECT_URL=your Supabase direct connection string
BLENDLE_STORE=prisma
```

4. Keep the framework preset as `Next.js`.
5. Deploy.

## Run production migrations

Before or during your first production rollout, apply Prisma migrations against Supabase:

```bash
npm run prisma:migrate:deploy
```

You can run that from your machine with production env vars loaded, or from a CI job.

## Recommended Vercel workflow

- Use `vercel env pull .env.local` if you want to sync Vercel env vars down to your machine.
- Run `npm run build` locally before pushing changes.
- Keep `BLENDLE_STORE=prisma` in Vercel so production never falls back to local file storage.

## Notes

- The dev-only reset button is disabled in production.
- API routes already use the Node.js runtime, which is a good fit for Prisma on Vercel.
