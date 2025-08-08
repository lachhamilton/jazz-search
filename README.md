## Jazz Search

Web-first MVP to search jazz standards and view top recordings. Built with Next.js App Router, Tailwind + shadcn/ui, Supabase, React Query, and MusicBrainz.

### Environment
Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase schema
Run `supabase_bootstrap.sql` in your Supabase SQL editor. It creates tables for `standards`, `recordings` (now includes `musicbrainz_recording_id`), `services`, `service_track_ids`, and `votes`, and an insert policy for votes.

If you already ran the initial SQL, apply this migration:

```sql
alter table recordings add column if not exists musicbrainz_recording_id text unique;
```

### Development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

### Features
- Home search calls `/api/search` (local Supabase first, then MusicBrainz fallback)
- Standard page `/standard/[slug]` lists recordings with links and vote button
- Email magic link sign-in at `/login`

### Deploy (Vercel)
- Set env vars in Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`)
- Deploy via Vercel
