-- Ensure optional plain-text email template column exists across environments

ALTER TABLE IF EXISTS public.email_templates
  ADD COLUMN IF NOT EXISTS body_text text;
