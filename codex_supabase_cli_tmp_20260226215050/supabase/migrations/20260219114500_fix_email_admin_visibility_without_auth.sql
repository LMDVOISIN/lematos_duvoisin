-- =====================================================
-- Fix admin email screens visibility without auth session
-- Keep existing /admin access flow (local admin password gate)
-- Date: 2026-02-19
-- =====================================================

-- Make sure RLS is active (safe if already enabled)
ALTER TABLE IF EXISTS public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_queue ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- EMAIL TEMPLATES
-- -----------------------------------------------------
-- Existing setup often allows SELECT only for authenticated admins.
-- Admin UI currently uses anon key + local admin gate, so it reads 0 rows.
-- This policy lets the UI read templates while keeping write policies unchanged.
DROP POLICY IF EXISTS "email_templates_select_all" ON public.email_templates;
CREATE POLICY "email_templates_select_all"
  ON public.email_templates
  FOR SELECT
  USING (true);

-- -----------------------------------------------------
-- EMAIL QUEUE
-- -----------------------------------------------------
-- Replace admin-only read with public read so queue counters/history load in admin UI.
DROP POLICY IF EXISTS "Admins can view all emails" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_admin_select" ON public.email_queue;
DROP POLICY IF EXISTS "email_queue_select_all" ON public.email_queue;
CREATE POLICY "email_queue_select_all"
  ON public.email_queue
  FOR SELECT
  USING (true);

-- Quick verification
SELECT COUNT(*) AS email_templates_count FROM public.email_templates;
SELECT COUNT(*) AS email_queue_count FROM public.email_queue;
