-- Add first/last name fields on profiles (compatibility-safe)
-- Used by registration and profile page to store civil identity separately from pseudonym.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Best-effort backfill from Supabase auth metadata when available.
UPDATE public.profiles AS p
SET
  first_name = COALESCE(
    p.first_name,
    NULLIF(BTRIM(u.raw_user_meta_data ->> 'first_name'), ''),
    NULLIF(BTRIM(u.raw_user_meta_data ->> 'prenom'), '')
  ),
  last_name = COALESCE(
    p.last_name,
    NULLIF(BTRIM(u.raw_user_meta_data ->> 'last_name'), ''),
    NULLIF(BTRIM(u.raw_user_meta_data ->> 'nom'), '')
  )
FROM auth.users AS u
WHERE u.id = p.id
  AND (
    p.first_name IS NULL
    OR p.last_name IS NULL
  );
