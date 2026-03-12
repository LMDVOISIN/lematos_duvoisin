-- User Testing System Migration
-- Creates tables for comprehensive user testing tracking and analytics

-- 1. Create ENUMs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n?ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'test_session_status'
  ) THEN
    CREATE TYPE public.test_session_status AS ENUM ('pending', 'in_progress', 'completed');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n?ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'report_severity'
  ) THEN
    CREATE TYPE public.report_severity AS ENUM ('critical', 'high', 'medium', 'low');
  END IF;
END;
$$;

-- 2. Create Tables

-- User Testers Table
CREATE TABLE IF NOT EXISTS public.user_testers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    protocol_group TEXT,
    system TEXT, -- Windows/Mac/Linux
    screen_type TEXT, -- Desktop/Tablet/Mobile
    browser TEXT, -- Chrome/Firefox/Safari/Edge
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Test Scenarios Table
CREATE TABLE IF NOT EXISTS public.test_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    expected_result TEXT,
    instructions TEXT,
    pages JSONB DEFAULT '[]'::jsonb, -- Array of {url, title, required, order, coherence_question, exit_questions}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Test Sessions Table
CREATE TABLE IF NOT EXISTS public.test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tester_id UUID REFERENCES public.user_testers(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES public.test_scenarios(id) ON DELETE CASCADE,
    status public.test_session_status DEFAULT 'pending'::public.test_session_status,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Page Responses Table
CREATE TABLE IF NOT EXISTS public.page_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    coherence_question TEXT,
    coherence_answer TEXT,
    exit_questionnaire JSONB DEFAULT '{}'::jsonb,
    perceived_info TEXT,
    next_action_understood BOOLEAN,
    time_spent_seconds INTEGER,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Test Reports Table
CREATE TABLE IF NOT EXISTS public.test_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    severity public.report_severity DEFAULT 'medium'::public.report_severity,
    description TEXT NOT NULL,
    reproduction_steps TEXT,
    screenshot_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Debrief Notes Table
CREATE TABLE IF NOT EXISTS public.debrief_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    what_was_clear TEXT,
    what_blocked TEXT,
    confidence_level TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure key enum columns still exist on previously-created tables
ALTER TABLE IF EXISTS public.test_sessions
  ADD COLUMN IF NOT EXISTS status public.test_session_status DEFAULT 'pending'::public.test_session_status;

ALTER TABLE IF EXISTS public.test_reports
  ADD COLUMN IF NOT EXISTS severity public.report_severity DEFAULT 'medium'::public.report_severity;

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_user_testers_email ON public.user_testers(email);
CREATE INDEX IF NOT EXISTS idx_user_testers_is_active ON public.user_testers(is_active);
CREATE INDEX IF NOT EXISTS idx_test_sessions_tester_id ON public.test_sessions(tester_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_scenario_id ON public.test_sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_status ON public.test_sessions(status);
CREATE INDEX IF NOT EXISTS idx_page_responses_session_id ON public.page_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_page_responses_page_url ON public.page_responses(page_url);
CREATE INDEX IF NOT EXISTS idx_test_reports_session_id ON public.test_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_test_reports_severity ON public.test_reports(severity);
CREATE INDEX IF NOT EXISTS idx_debrief_notes_session_id ON public.debrief_notes(session_id);

-- 4. Create Storage Bucket for Test Screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'test-screenshots',
    'test-screenshots',
    false, -- Private bucket
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable RLS
ALTER TABLE public.user_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debrief_notes ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies

-- User Testers: Testers can view/update their own record, admins can manage all
DROP POLICY IF EXISTS "testers_view_own_record" ON public.user_testers;
CREATE POLICY "testers_view_own_record"
ON public.user_testers
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "testers_update_own_record" ON public.user_testers;
CREATE POLICY "testers_update_own_record"
ON public.user_testers
FOR UPDATE
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "admins_manage_testers" ON public.user_testers;
CREATE POLICY "admins_manage_testers"
ON public.user_testers
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Test Scenarios: Testers can view active scenarios, admins can manage all
DROP POLICY IF EXISTS "testers_view_active_scenarios" ON public.test_scenarios;
CREATE POLICY "testers_view_active_scenarios"
ON public.test_scenarios
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "admins_manage_scenarios" ON public.test_scenarios;
CREATE POLICY "admins_manage_scenarios"
ON public.test_scenarios
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Test Sessions: Testers manage their own sessions, admins view all
DROP POLICY IF EXISTS "testers_manage_own_sessions" ON public.test_sessions;
CREATE POLICY "testers_manage_own_sessions"
ON public.test_sessions
FOR ALL
TO authenticated
USING (
    tester_id IN (
        SELECT id FROM public.user_testers
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
)
WITH CHECK (
    tester_id IN (
        SELECT id FROM public.user_testers
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "admins_view_all_sessions" ON public.test_sessions;
CREATE POLICY "admins_view_all_sessions"
ON public.test_sessions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Page Responses: Testers manage their session responses, admins view all
DROP POLICY IF EXISTS "testers_manage_own_responses" ON public.page_responses;
CREATE POLICY "testers_manage_own_responses"
ON public.page_responses
FOR ALL
TO authenticated
USING (
    session_id IN (
        SELECT id FROM public.test_sessions
        WHERE tester_id IN (
            SELECT id FROM public.user_testers
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
)
WITH CHECK (
    session_id IN (
        SELECT id FROM public.test_sessions
        WHERE tester_id IN (
            SELECT id FROM public.user_testers
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "admins_view_all_responses" ON public.page_responses;
CREATE POLICY "admins_view_all_responses"
ON public.page_responses
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Test Reports: Testers manage their session reports, admins view all
DROP POLICY IF EXISTS "testers_manage_own_reports" ON public.test_reports;
CREATE POLICY "testers_manage_own_reports"
ON public.test_reports
FOR ALL
TO authenticated
USING (
    session_id IN (
        SELECT id FROM public.test_sessions
        WHERE tester_id IN (
            SELECT id FROM public.user_testers
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
)
WITH CHECK (
    session_id IN (
        SELECT id FROM public.test_sessions
        WHERE tester_id IN (
            SELECT id FROM public.user_testers
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "admins_view_all_reports" ON public.test_reports;
CREATE POLICY "admins_view_all_reports"
ON public.test_reports
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Debrief Notes: Testers manage their session debriefs, admins view all
DROP POLICY IF EXISTS "testers_manage_own_debriefs" ON public.debrief_notes;
CREATE POLICY "testers_manage_own_debriefs"
ON public.debrief_notes
FOR ALL
TO authenticated
USING (
    session_id IN (
        SELECT id FROM public.test_sessions
        WHERE tester_id IN (
            SELECT id FROM public.user_testers
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
)
WITH CHECK (
    session_id IN (
        SELECT id FROM public.test_sessions
        WHERE tester_id IN (
            SELECT id FROM public.user_testers
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "admins_view_all_debriefs" ON public.debrief_notes;
CREATE POLICY "admins_view_all_debriefs"
ON public.debrief_notes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- Storage RLS Policies for test-screenshots bucket
DROP POLICY IF EXISTS "testers_upload_screenshots" ON storage.objects;
CREATE POLICY "testers_upload_screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'test-screenshots' AND
    EXISTS (
        SELECT 1 FROM public.user_testers
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        AND is_active = true
    )
);

DROP POLICY IF EXISTS "testers_view_own_screenshots" ON storage.objects;
CREATE POLICY "testers_view_own_screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'test-screenshots' AND
    owner = auth.uid()
);

DROP POLICY IF EXISTS "admins_view_all_screenshots" ON storage.objects;
CREATE POLICY "admins_view_all_screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'test-screenshots' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- 7. Create Mock Data
DO $$
DECLARE
    tester1_id UUID := gen_random_uuid();
    tester2_id UUID := gen_random_uuid();
    scenario1_id UUID := gen_random_uuid();
    scenario2_id UUID := gen_random_uuid();
    session1_id UUID := gen_random_uuid();
BEGIN
    -- Create test testers
    INSERT INTO public.user_testers (id, email, protocol_group, system, screen_type, browser, is_active)
    VALUES 
        (tester1_id, 'testeur1@example.com', 'groupe_a', 'Windows', 'Desktop', 'Chrome', true),
        (tester2_id, 'testeur2@example.com', 'groupe_b', 'Mac', 'Mobile', 'Safari', true)
    ON CONFLICT (email) DO NOTHING;

    -- Create test scenarios
    INSERT INTO public.test_scenarios (id, title, objective, expected_result, instructions, pages, is_active)
    VALUES 
        (
            scenario1_id,
            'Parcours de réservation',
            'Tester le processus complet de réservation d''équipement',
            'L''utilisateur doit pouvoir réserver un équipement sans blocage',
            'Suivez le parcours de recherche jusqu''à la confirmation de réservation',
            jsonb_build_array(
                jsonb_build_object(
                    'url', '/home-search',
                    'title', 'Page de recherche',
                    'required', true,
                    'order', 1,
                    'coherence_question', 'Comprenez-vous comment rechercher un équipement ?',
                    'exit_questions', jsonb_build_array(
                        'Avez-vous trouvé la barre de recherche facilement ?',
                        'Les filtres sont-ils clairs ?'
                    )
                ),
                jsonb_build_object(
                    'url', '/equipment-detail',
                    'title', 'Détail équipement',
                    'required', true,
                    'order', 2,
                    'coherence_question', 'Les informations affichées sont-elles suffisantes ?',
                    'exit_questions', jsonb_build_array(
                        'Savez-vous comment réserver cet équipement ?',
                        'Le prix est-il clair ?'
                    )
                ),
                jsonb_build_object(
                    'url', '/booking-request',
                    'title', 'Demande de réservation',
                    'required', true,
                    'order', 3,
                    'coherence_question', 'Le formulaire de réservation est-il compréhensible ?',
                    'exit_questions', jsonb_build_array(
                        'Toutes les informations demandées sont-elles justifiées ?',
                        'Le processus de paiement est-il rassurant ?'
                    )
                )
            ),
            true
        ),
        (
            scenario2_id,
            'Création d''annonce',
            'Tester la création d''une nouvelle annonce d''équipement',
            'L''utilisateur doit pouvoir créer une annonce complète',
            'Créez une annonce pour un équipement de votre choix',
            jsonb_build_array(
                jsonb_build_object(
                    'url', '/create-listing',
                    'title', 'Création annonce',
                    'required', true,
                    'order', 1,
                    'coherence_question', 'Comprenez-vous les étapes de création ?',
                    'exit_questions', jsonb_build_array(
                        'Les champs du formulaire sont-ils clairs ?',
                        'L''upload de photos fonctionne-t-il bien ?'
                    )
                )
            ),
            true
        )
    ON CONFLICT (id) DO NOTHING;

    -- Create sample test session
    INSERT INTO public.test_sessions (id, tester_id, scenario_id, status, started_at)
    VALUES 
        (session1_id, tester1_id, scenario1_id, 'in_progress'::public.test_session_status, now())
    ON CONFLICT (id) DO NOTHING;

    -- Create sample page response
    INSERT INTO public.page_responses (session_id, page_url, coherence_question, coherence_answer, exit_questionnaire, next_action_understood, time_spent_seconds)
    VALUES 
        (
            session1_id,
            '/home-search',
            'Comprenez-vous comment rechercher un équipement ?',
            'Oui, c''est clair',
            jsonb_build_object(
                'found_search_bar', 'Oui',
                'filters_clear', 'Oui, très clairs'
            ),
            true,
            45
        )
    ON CONFLICT (id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
