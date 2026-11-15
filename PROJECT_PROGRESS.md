# Microbiome Atlas — Integration & Engineering Progress

**Workspace:** `C:\Users\Raghavan\Development\Microbiome-Atlas-latest` (branch `main`, base commit `45666fa`)  
**Scope:** Bug fixes, Supabase persistence & auth lifecycle completion, scientific & CSV validation reliability, security hardening, and automated scientific verification. Kishore Ram's approved frontend theme and frozen files (`src/index.css`, `src/Shell.tsx`, `src/pages/Landing.tsx`) were left untouched.

---

## Completed Changes (Phases 1–6)

### Phase 1 — Environment, Lockfile & Startup Resilience
- `package-lock.json`: Synced optional native binary packages into `optionalDependencies` (`@rolldown/binding-win32-x64-msvc`, `@tailwindcss/oxide-win32-x64-msvc`, `lightningcss-win32-x64-msvc`) and aligned `@supabase/supabase-js` (`^2.49.1`). Verified clean `npm ci` and `npm ls --depth=0`.
- `src/lib/supabase.ts`: Replaced unconditional top-level `createClient('', '')` crash with `validateConfig`, `isSupabaseConfigured`, `supabaseConfigError`, nullable `supabase`, and `requireSupabase()`. Updated DB reads (`getProfile`, `fetchDatasets`, `fetchReports`, `fetchActivities`) to throw real errors instead of silently returning empty state, scoped mutations by `user_id`, added `updateDatasetDone`, `updateDatasetDetails`, `updateUserPassword`, and configured auth redirects.

### Phase 2 — Authentication, Supabase Sync & Lifecycle Fixes
- `src/store.tsx`:
  - Reconstructed `Dataset.runs` and run history deterministically from `rec.done` in `recordToDataset()` so reloaded datasets remain unlocked in `Overview`, `Gate`, and `Results`.
  - Replaced sequential `uid`/`dsId` counters with `crypto.randomUUID()`-backed collision-safe IDs (`MA-XXXXXXXX` / UUID strings).
  - Added `dataLoading`, `dataError`, `hydratedUserId`, `recoveryMode`, `clearRecoveryMode`, `retrySync`, and deduplicated `loadUserData()` that always resets `datasets`, `reports`, `notes`, `settings`, and `filters` cleanly per user session and prevents stale out-of-order async responses.
  - Handled `INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED`, `PASSWORD_RECOVERY`, and `SIGNED_OUT` cleanly in `onAuthStateChange`.
  - Converted `commit`, `runModules` (using lightweight `updateDatasetDone`), `rename`, `remove` (functional fallback for `activeId`), and `addReport` to async Supabase-first mutations with explicit error notifications.
  - Added `saveSettings` and debounced preference persistence for all `Settings` fields (`topN`, `mode`, `level`, `toasts`, `notifyKinds`, `reduceMotion`, `exportFormat`, `prefix`, `decimals`).
- `src/App.tsx`: Added `ErrorBoundary`, protected-route hydration holding while `dataLoading` runs (preventing `Shell` from redirecting to `/new/upload` before Supabase data loads), `recoveryMode` routing to password update, sync-retry error gate, and `useEffect`-based unknown/callback routing instead of synchronous `go('/')` during render.
- `src/pages/Auth.tsx`: Added `!isSupabaseConfigured` warning/guard, `mode === 'recovery'` password-update UI (`updateUserPassword`), and duplicate-email detection (`identities.length === 0`) on sign-up.
- `src/pages/common.tsx`, `src/pages/Datasets.tsx`, `src/pages/Misc.tsx`, `src/pages/Wizard.tsx`, `src/pages/Results.tsx`: Updated all async store callers to await completion before confirming success or closing modals; updated Datasets session/cloud storage messaging.

### Phase 3 — Scientific Computing, Importer & Chart Safety
- `src/lib/science.ts`:
  - Added `MAX_CSV_BYTES` (5 MB), `MAX_CSV_ROWS` (50,000 rows), and `MAX_PCOA_SAMPLES` (150 samples) limits.
  - Hardened `parseCSV` to track exact 1-based physical `rowNumbers`, unclosed quotes (`unclosedQuote`), duplicate headers (`duplicateHeaders`), ragged row widths (`mismatchedRows`), and row-limit truncation (`truncatedAtLimit`).
  - Updated `validate()` to 17 checks covering duplicate column mappings (`dupmap`), CSV structure (`csvfmt`), conflicting `sample_group` per sample (`sgrp_conflict`), conflicting feature taxonomy (`fmeta_conflict`), and blocking datasets with zero positive-total samples (`pos`), plus fixing false outlier warnings (`unu`) when `iqr === 0`.
  - Updated `buildMatrix()` to use a null-prototype `groupOf` lookup map (preventing `toString` / `constructor` prototype collisions).
  - Updated `aggregate()` and `src/pages/Analysis2.tsx` to preserve positional lineage ranks across empty intermediate `;` slots and fall back to `organism`/`taxonomic_rank` when deeper levels are omitted from `lineage`.
  - Fixed negative-zero (`-0`) Shannon/Simpson edge cases when `observed === 1` (`alphaDiv`).
  - Added OWASP formula-injection neutralization (`=`, `+`, `-`, `@`, `\t`, `\r`) for untrusted string cells in `toCSV` while preserving negative finite `number` values.
- `src/pages/Wizard.tsx`: Enforced empty/size/NUL checks and `.catch()` error handling in `readFile`, blocked duplicate column mappings in `Configure`, and replaced `analysis.recs[n - 2]` with `recByRow.get(n)` in `Validate`.
- `src/charts.tsx`, `src/pages/Analysis1.tsx`, `src/pages/Beta.tsx`: Guarded empty arrays and empty group values in `Heatmap`, `gAxes`, `BoxPlot`, and `Violin` (such as `Pielou = null` groups), displayed `n/a` instead of `0` when `n = 0` in `AlphaInner`, and reported distinct PCoA sample-cap (`> 150`) vs degenerate/low-sample reasons in `Beta.tsx`.

### Phase 4 & 5 — Reports, Docs Copy & Security Hardening
- `src/pages/Results.tsx`: Guarded missing `run` / zero-length arrays, exported full taxonomic composition (all taxa at selected rank instead of Top-8 truncation) in report CSV exports, made saved reports clickable to reopen preview/export, clamped the chart export index on section toggles, and added `img.onerror` and canvas context checks to PNG export.
- `src/pages/Misc.tsx`: Updated `Validating Datasets` documentation text to reflect the 17 implemented checks.
- `vercel.json`: Added `Permissions-Policy` and `Content-Security-Policy` headers aligned with Vite bundled assets, Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`), PNG `data:`/`blob:` canvas export, and Supabase (`https://*.supabase.co`, `wss://*.supabase.co`).

### Phase 6 — Automated Scientific & Validation Test Suite
- `src/lib/samples.ts` & `tests/science.test.ts`: Added Node 22 native test suite (`node --test tests/science.test.ts`) covering relative abundance, Shannon, Simpson (`1 - D`), Observed, Pielou (`null` when `S=1`), Bray-Curtis, PCoA limits, missing values, zero-total blocking, duplicate summation, conflicting metadata, prototype-safe sample IDs, CSV syntax errors, formula injection, and all four demo datasets.

---

## Proposed Supabase SQL Migration (For Guhan / Raghavan Review — NOT Applied Live)

Live `supabase/schema.sql` remains untouched and existing frontend code stays backward-compatible with it. Review and run the following migration in the Supabase SQL Editor when ready:

```sql
-- Security & Data Integrity Hardening Migration (Review with Guhan before applying)

-- 1. Pin search_path on SECURITY DEFINER trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, settings)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
      updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Optional payload guard on datasets.raw_data JSONB (enforces ~6 MB upper bound server-side)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'datasets_raw_data_size_check'
  ) THEN
    ALTER TABLE public.datasets
      ADD CONSTRAINT datasets_raw_data_size_check
      CHECK (octet_length(raw_data::text) <= 6291456);
  END IF;
END $$;
```

---

## Next Steps For Team Review
1. **Local Supabase configuration (`.env.local`):** Copy `.env.example` to `.env.local` in `C:\Users\Raghavan\Development\Microbiome-Atlas-latest` and populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to test live sign-up/sign-in, password reset, and Postgres persistence.
2. **Browser E2E check (Phase 7):** Start `npm run dev` (or open Chrome with remote debugging enabled for automated verification) to manually test upload, mapping, validation warnings/errors, analysis modules, PNG/SVG/CSV export, and Supabase persistence across reloads.
3. **Database & Deployment (Phase 8):** Review `git diff`, apply the SQL migration above in Supabase if approved by Guhan, and approve commit/push/Vercel deploy when ready.
