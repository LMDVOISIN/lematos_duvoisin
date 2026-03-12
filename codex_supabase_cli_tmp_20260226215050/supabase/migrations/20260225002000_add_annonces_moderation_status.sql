-- Add missing moderation_status column on annonces (prod compatibility)
-- Some environments already have moderation_reason but not moderation_status.

ALTER TABLE IF EXISTS public.annonces
  ADD COLUMN IF NOT EXISTS moderation_status text;

-- Backfill from existing publication/statut fields when missing.
UPDATE public.annonces
SET moderation_status = CASE
  WHEN COALESCE(published, false) = true OR LOWER(COALESCE(statut, '')) IN ('publiee', 'published') THEN 'approved'
  WHEN LOWER(COALESCE(statut, '')) IN ('refusee', 'rejected') THEN 'rejected'
  WHEN LOWER(COALESCE(statut, '')) IN ('en_attente', 'pending') THEN 'pending'
  ELSE moderation_status
END
WHERE moderation_status IS NULL;
