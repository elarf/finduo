-- Tags: add user_id ownership, scope visibility to own + accepted friends

-- 1. Add user_id (nullable first so we can backfill)
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Backfill all existing tags to the original owner
UPDATE public.tags SET user_id = '1f3ece3a-40c2-446a-9a2a-487949c5397a' WHERE user_id IS NULL;

-- 3. Enforce NOT NULL going forward
ALTER TABLE public.tags ALTER COLUMN user_id SET NOT NULL;

-- 4. SECURITY DEFINER helper — avoids RLS recursion when checking friends table
CREATE OR REPLACE FUNCTION public.is_accepted_friend(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friends
    WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_user_id = p_user_id)
        OR (friend_user_id = auth.uid() AND user_id = p_user_id)
      )
  );
$$;

-- 5. Drop old blanket policies
DROP POLICY IF EXISTS tags_all ON public.tags;
DROP POLICY IF EXISTS tags_delete_all ON public.tags;
DROP POLICY IF EXISTS tags_insert_all ON public.tags;
DROP POLICY IF EXISTS tags_select_all ON public.tags;
DROP POLICY IF EXISTS tags_update_all ON public.tags;

-- 6. New granular policies

-- SELECT: own tags + accepted friends' tags
CREATE POLICY tags_select ON public.tags
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_accepted_friend(user_id)
  );

-- INSERT: must set user_id to yourself
CREATE POLICY tags_insert ON public.tags
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: only your own tags
CREATE POLICY tags_update ON public.tags
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: only your own tags
CREATE POLICY tags_delete ON public.tags
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
