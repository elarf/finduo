-- Backfill avatar_url in user_profiles from auth.users metadata for rows that are NULL.
-- This fixes accounts where the Google profile picture was private at sign-up time
-- and was therefore never stored in user_profiles, even though auth.users has the URL.

UPDATE public.user_profiles up
SET avatar_url = COALESCE(
  au.raw_user_meta_data->>'avatar_url',
  au.raw_user_meta_data->>'picture'
)
FROM auth.users au
WHERE up.user_id = au.id
  AND up.avatar_url IS NULL
  AND COALESCE(
    au.raw_user_meta_data->>'avatar_url',
    au.raw_user_meta_data->>'picture'
  ) IS NOT NULL;
