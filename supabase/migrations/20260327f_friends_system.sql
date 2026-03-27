-- Friends System
-- Directional rows: user_id (requester) → friend_user_id (recipient)
-- Status: pending | accepted | rejected | blocked
--
-- user_profiles: public table for user discovery (lookup by email for friend requests).
-- Populated app-side via upsert on first friends interaction.

-- ── user_profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT UNIQUE,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='Profiles readable by authenticated') THEN
    CREATE POLICY "Profiles readable by authenticated"
      ON public.user_profiles FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_profiles' AND policyname='Users manage own profile') THEN
    CREATE POLICY "Users manage own profile"
      ON public.user_profiles FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── friends ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','blocked')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, friend_user_id)
);

CREATE INDEX IF NOT EXISTS friends_user_id_idx        ON public.friends (user_id);
CREATE INDEX IF NOT EXISTS friends_friend_user_id_idx ON public.friends (friend_user_id);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Both parties (and only them) can see rows they're involved in.
-- Blocked rows are hidden from the person being blocked (not from the blocker).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friends' AND policyname='Participants see own friendships') THEN
    CREATE POLICY "Participants see own friendships"
      ON public.friends FOR SELECT
      USING (
        user_id = auth.uid()
        OR (friend_user_id = auth.uid() AND status <> 'blocked')
      );
  END IF;
END $$;

-- Only the requester can send — and only as 'pending'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friends' AND policyname='Users can send friend requests') THEN
    CREATE POLICY "Users can send friend requests"
      ON public.friends FOR INSERT
      WITH CHECK (user_id = auth.uid() AND status = 'pending');
  END IF;
END $$;

-- Either party can update the status (accept, reject, block, cancel)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friends' AND policyname='Participants can update friendship') THEN
    CREATE POLICY "Participants can update friendship"
      ON public.friends FOR UPDATE
      USING (user_id = auth.uid() OR friend_user_id = auth.uid());
  END IF;
END $$;

-- Only the original requester can delete a row (hard remove)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='friends' AND policyname='Requester can delete friendship') THEN
    CREATE POLICY "Requester can delete friendship"
      ON public.friends FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;
