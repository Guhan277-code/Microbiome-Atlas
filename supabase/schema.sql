-- Microbiome Atlas Schema & Row Level Security (RLS) Policies
-- Project: https://viwbkikeanjtuigxplkj.supabase.co

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 2. AUTOMATIC PROFILE TRIGGER ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. DATASETS TABLE
CREATE TABLE IF NOT EXISTS public.datasets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('Sample', 'Upload')),
  file_name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  raw_data JSONB NOT NULL,
  mapping JSONB NOT NULL,
  done JSONB DEFAULT '{}'::jsonb,
  uploaded_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for datasets
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON public.datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_uploaded_at ON public.datasets(uploaded_at DESC);

-- Datasets Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'datasets' AND policyname = 'Users can view their own datasets') THEN
    CREATE POLICY "Users can view their own datasets"
      ON public.datasets FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'datasets' AND policyname = 'Users can insert their own datasets') THEN
    CREATE POLICY "Users can insert their own datasets"
      ON public.datasets FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'datasets' AND policyname = 'Users can update their own datasets') THEN
    CREATE POLICY "Users can update their own datasets"
      ON public.datasets FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'datasets' AND policyname = 'Users can delete their own datasets') THEN
    CREATE POLICY "Users can delete their own datasets"
      ON public.datasets FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES public.datasets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_dataset_id ON public.reports(dataset_id);

-- Reports Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can view their own reports') THEN
    CREATE POLICY "Users can view their own reports"
      ON public.reports FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can insert their own reports') THEN
    CREATE POLICY "Users can insert their own reports"
      ON public.reports FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'Users can delete their own reports') THEN
    CREATE POLICY "Users can delete their own reports"
      ON public.reports FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dataset_id TEXT REFERENCES public.datasets(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('upload', 'validation', 'analysis', 'report', 'error', 'info')),
  text TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for activity logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Activity Logs Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Users can view their own activities') THEN
    CREATE POLICY "Users can view their own activities"
      ON public.activity_logs FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Users can insert their own activities') THEN
    CREATE POLICY "Users can insert their own activities"
      ON public.activity_logs FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Users can update their own activities') THEN
    CREATE POLICY "Users can update their own activities"
      ON public.activity_logs FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'Users can delete their own activities') THEN
    CREATE POLICY "Users can delete their own activities"
      ON public.activity_logs FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

