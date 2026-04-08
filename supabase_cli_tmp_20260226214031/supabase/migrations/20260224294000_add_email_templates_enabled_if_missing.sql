-- Ensure email template "enabled" flag exists across environments

ALTER TABLE IF EXISTS public.email_templates
  ADD COLUMN IF NOT EXISTS enabled boolean;

UPDATE public.email_templates
SET enabled = COALESCE(enabled, true)
WHERE enabled IS NULL;

ALTER TABLE IF EXISTS public.email_templates
  ALTER COLUMN enabled SET DEFAULT true;
