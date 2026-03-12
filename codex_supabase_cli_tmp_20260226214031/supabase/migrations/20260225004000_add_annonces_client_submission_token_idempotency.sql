-- Prevent duplicate annonce creation on multi-submit / mobile retry
-- by using a client-provided idempotency token per creation flow.

ALTER TABLE IF EXISTS public.annonces
  ADD COLUMN IF NOT EXISTS client_submission_token text;

CREATE UNIQUE INDEX IF NOT EXISTS annonces_owner_client_submission_token_uidx
  ON public.annonces (owner_id, client_submission_token)
  WHERE owner_id IS NOT NULL
    AND client_submission_token IS NOT NULL;
