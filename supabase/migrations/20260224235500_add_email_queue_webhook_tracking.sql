-- Add webhook tracking fields to email_queue for Resend event correlation

ALTER TABLE IF EXISTS public.email_queue
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS webhook_last_event_type text,
  ADD COLUMN IF NOT EXISTS webhook_last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_payload jsonb,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.email_queue
SET provider = COALESCE(provider, 'resend'),
    updated_at = COALESCE(updated_at, created_at, now())
WHERE provider IS NULL OR updated_at IS NULL;

ALTER TABLE IF EXISTS public.email_queue
  ALTER COLUMN provider SET DEFAULT 'resend';

ALTER TABLE IF EXISTS public.email_queue
  DROP CONSTRAINT IF EXISTS email_queue_status_check;

ALTER TABLE IF EXISTS public.email_queue
  ADD CONSTRAINT email_queue_status_check
  CHECK (
    status IN (
      'pending',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'failed',
      'bounced',
      'complained'
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_queue_provider_message
  ON public.email_queue(provider, provider_message_id);

CREATE INDEX IF NOT EXISTS idx_email_queue_webhook_event_at
  ON public.email_queue(webhook_last_event_at DESC);
