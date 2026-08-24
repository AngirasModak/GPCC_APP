# GPCC / GPOA Cultural Finance Portal

Free deployment stack:
- Vercel Hobby: Next.js hosting
- Supabase Free: PostgreSQL + authentication
- Google Drive: bills and supporting documents

## Deploy
1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill the values.
4. `npm install && npm run dev`
5. Push to GitHub and import into Vercel.

The first Administrator is approved manually in `profiles`. Never expose service-role keys.
