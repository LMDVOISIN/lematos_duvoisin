UPDATE public.test_scenarios
SET program_family = 'successful'::public.test_scenario_program_family
WHERE id IN (
  'd6235dc4-5e96-49c1-8b4a-0f04a83a41c3',
  '5ae4e63b-6655-4d55-a2ef-966e3786c252',
  '461abaf3-b7fd-48f9-883b-0622b5dbae48',
  '999eee41-5324-437d-9ce3-7022b27f03fb',
  'baeab87e-dc97-42b7-9c7e-842eac638429',
  '85978be1-15db-590b-aaba-01d40423964a'
);

UPDATE public.test_scenarios
SET program_family = 'renter_failure'::public.test_scenario_program_family
WHERE id IN (
  '53572f5e-c6d0-5641-9e64-f3290812b301',
  'c4c99f8b-b490-5252-9d90-76e35f6d6aec',
  '0ea1478a-32f4-55ce-a02f-6d2a19e30955',
  '8134a5ac-3f1c-52cb-8e61-823a854af8c2',
  '4f6a1f27-9c43-5653-a6c9-ffe28c5777bb',
  '21f682d4-801e-50db-afef-3635a9631445',
  '7193b2d9-4b39-5aab-b4bc-120b0f9f8bda',
  'd0b19810-8307-52b3-9e74-d3554f5fed9e',
  'a2ef55a6-5f1c-5181-a838-8c1c44f826bd'
);

UPDATE public.test_scenarios
SET program_family = 'owner_failure'::public.test_scenario_program_family
WHERE id IN (
  'a0271135-9d3c-5a48-82c5-af0c61f605a7',
  '0d79cf47-6fa2-58d8-95e9-3ce557b4c1ac',
  'c12cb9d2-c7d6-51f8-bbb8-8669b956becf',
  '09194741-5876-5991-8192-4223836213dc',
  '3a65fc08-f039-5bc7-9f50-02b48b1cee91',
  '61d04afd-a659-5b0a-a08a-536f9c9288c8',
  '37e6a06d-c5a7-5c47-abc3-066fb5649829',
  '58ec0c9d-785f-5265-9177-08d905d58627'
);

UPDATE public.test_scenarios
SET program_family = 'transversal_incident'::public.test_scenario_program_family
WHERE id IN (
  '67701085-bc2e-503b-919b-62dda242a7fe',
  '8bba0700-30fb-5199-835e-97e0a180b678',
  '17b6097b-c77f-53ba-bc14-43b2f506654c',
  '08b87852-3e54-5b93-8a13-a46027b9b76b',
  '8b655eb2-0868-574c-a1c1-f2376d7b83b9',
  'fbd425cf-9bc5-51ee-9937-7bee36e0e580',
  '92ac0009-df9e-54d4-a67a-d386b117f281',
  '219217c5-87c4-5fed-b5cd-a66bdf13ffcc',
  '2ccc75b3-860a-5f15-a45b-1a4efa8637ba'
);

UPDATE public.test_scenarios
SET program_family = NULL
WHERE id = 'af358c11-4426-4829-bbd5-4303af621baa';

UPDATE public.test_mirror_rounds AS rounds
SET program_family = scenarios.program_family
FROM public.test_scenarios AS scenarios
WHERE rounds.reference_scenario_id = scenarios.id
  AND rounds.program_family IS DISTINCT FROM scenarios.program_family;

CREATE OR REPLACE FUNCTION public.get_test_program_progress(
  p_tester_id uuid,
  p_campaign_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_has_successful boolean := false;
  v_has_renter_failure boolean := false;
  v_has_owner_failure boolean := false;
  v_has_transversal_incident boolean := false;
  v_required_family public.test_scenario_program_family;
  v_progress_count integer := 0;
  v_completed_families text[] := ARRAY[]::text[];
BEGIN
  IF p_tester_id IS NULL OR p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Tester id and campaign id are required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.test_sessions ts
    JOIN public.test_scenarios scenarios ON scenarios.id = ts.scenario_id
    JOIN public.test_mirror_rounds rounds
      ON rounds.reference_session_id = ts.id OR rounds.mirror_session_id = ts.id
    WHERE rounds.campaign_id = p_campaign_id
      AND ts.tester_id = p_tester_id
      AND ts.status = 'completed'::public.test_session_status
      AND COALESCE(rounds.program_family, scenarios.program_family) = 'successful'::public.test_scenario_program_family
  )
  INTO v_has_successful;

  SELECT EXISTS (
    SELECT 1
    FROM public.test_sessions ts
    JOIN public.test_scenarios scenarios ON scenarios.id = ts.scenario_id
    JOIN public.test_mirror_rounds rounds
      ON rounds.reference_session_id = ts.id OR rounds.mirror_session_id = ts.id
    WHERE rounds.campaign_id = p_campaign_id
      AND ts.tester_id = p_tester_id
      AND ts.status = 'completed'::public.test_session_status
      AND COALESCE(rounds.program_family, scenarios.program_family) = 'renter_failure'::public.test_scenario_program_family
  )
  INTO v_has_renter_failure;

  SELECT EXISTS (
    SELECT 1
    FROM public.test_sessions ts
    JOIN public.test_scenarios scenarios ON scenarios.id = ts.scenario_id
    JOIN public.test_mirror_rounds rounds
      ON rounds.reference_session_id = ts.id OR rounds.mirror_session_id = ts.id
    WHERE rounds.campaign_id = p_campaign_id
      AND ts.tester_id = p_tester_id
      AND ts.status = 'completed'::public.test_session_status
      AND COALESCE(rounds.program_family, scenarios.program_family) = 'owner_failure'::public.test_scenario_program_family
  )
  INTO v_has_owner_failure;

  SELECT EXISTS (
    SELECT 1
    FROM public.test_sessions ts
    JOIN public.test_scenarios scenarios ON scenarios.id = ts.scenario_id
    JOIN public.test_mirror_rounds rounds
      ON rounds.reference_session_id = ts.id OR rounds.mirror_session_id = ts.id
    WHERE rounds.campaign_id = p_campaign_id
      AND ts.tester_id = p_tester_id
      AND ts.status = 'completed'::public.test_session_status
      AND COALESCE(rounds.program_family, scenarios.program_family) = 'transversal_incident'::public.test_scenario_program_family
  )
  INTO v_has_transversal_incident;

  v_progress_count := (CASE WHEN v_has_successful THEN 1 ELSE 0 END)
    + (CASE WHEN v_has_renter_failure THEN 1 ELSE 0 END)
    + (CASE WHEN v_has_owner_failure THEN 1 ELSE 0 END)
    + (CASE WHEN v_has_transversal_incident THEN 1 ELSE 0 END);

  v_completed_families := array_remove(ARRAY[
    CASE WHEN v_has_successful THEN 'successful' ELSE NULL END,
    CASE WHEN v_has_renter_failure THEN 'renter_failure' ELSE NULL END,
    CASE WHEN v_has_owner_failure THEN 'owner_failure' ELSE NULL END,
    CASE WHEN v_has_transversal_incident THEN 'transversal_incident' ELSE NULL END
  ], NULL);

  IF NOT v_has_successful THEN
    v_required_family := 'successful'::public.test_scenario_program_family;
  ELSIF NOT v_has_renter_failure THEN
    v_required_family := 'renter_failure'::public.test_scenario_program_family;
  ELSIF NOT v_has_owner_failure THEN
    v_required_family := 'owner_failure'::public.test_scenario_program_family;
  ELSIF NOT v_has_transversal_incident THEN
    v_required_family := 'transversal_incident'::public.test_scenario_program_family;
  ELSE
    v_required_family := NULL;
  END IF;

  RETURN jsonb_build_object(
    'completedFamilies', to_jsonb(v_completed_families),
    'requiredFamily', CASE
      WHEN v_required_family IS NULL THEN NULL
      ELSE v_required_family::text
    END,
    'progressCount', v_progress_count,
    'totalRequiredTests', 4,
    'programCompleted', v_required_family IS NULL,
    'programStepNumber', CASE
      WHEN v_required_family IS NULL THEN 4
      ELSE v_progress_count + 1
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_test_mirror_start_state(
  p_tester_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_is_admin boolean := false;
  v_tester_email text;
  v_campaign_id uuid;
  v_campaign_label text;
  v_pending_round public.test_mirror_rounds%ROWTYPE;
  v_pending_mirror_scenario public.test_scenarios%ROWTYPE;
  v_pending_reference_scenario public.test_scenarios%ROWTYPE;
  v_remaining_reference_scenarios jsonb := '[]'::jsonb;
  v_progress jsonb := '{}'::jsonb;
  v_completed_families jsonb := '[]'::jsonb;
  v_progress_count integer := 0;
  v_total_required_tests integer := 4;
  v_program_step_number integer := 1;
  v_required_family_text text;
  v_required_family public.test_scenario_program_family;
BEGIN
  IF p_tester_id IS NULL THEN
    RAISE EXCEPTION 'Tester id is required';
  END IF;

  SELECT lower(email)
  INTO v_tester_email
  FROM public.user_testers
  WHERE id = p_tester_id
    AND is_active = true
  LIMIT 1;

  IF v_tester_email IS NULL THEN
    RAISE EXCEPTION 'Tester not found or inactive';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor_user_id
      AND is_admin = true
  )
  INTO v_is_admin;

  IF NOT v_is_admin AND v_tester_email <> v_actor_email THEN
    RAISE EXCEPTION 'Not allowed to access this tester';
  END IF;

  v_campaign_id := public.get_or_create_current_test_mirror_campaign_id();

  SELECT label
  INTO v_campaign_label
  FROM public.test_mirror_campaigns
  WHERE id = v_campaign_id;

  v_progress := public.get_test_program_progress(p_tester_id, v_campaign_id);
  v_completed_families := COALESCE(v_progress -> 'completedFamilies', '[]'::jsonb);
  v_progress_count := COALESCE((v_progress ->> 'progressCount')::integer, 0);
  v_total_required_tests := COALESCE((v_progress ->> 'totalRequiredTests')::integer, 4);
  v_program_step_number := COALESCE((v_progress ->> 'programStepNumber')::integer, 1);
  v_required_family_text := NULLIF(v_progress ->> 'requiredFamily', '');

  IF v_required_family_text IS NOT NULL THEN
    v_required_family := v_required_family_text::public.test_scenario_program_family;
  END IF;

  IF COALESCE((v_progress ->> 'programCompleted')::boolean, false) THEN
    RETURN jsonb_build_object(
      'mode', 'program_completed',
      'campaignId', v_campaign_id,
      'campaignLabel', v_campaign_label,
      'completedFamilies', v_completed_families,
      'progressCount', v_progress_count,
      'totalRequiredTests', v_total_required_tests,
      'programStepNumber', v_program_step_number
    );
  END IF;

  SELECT rounds.*
  INTO v_pending_round
  FROM public.test_mirror_rounds rounds
  JOIN public.test_scenarios reference_scenario
    ON reference_scenario.id = rounds.reference_scenario_id
  WHERE rounds.campaign_id = v_campaign_id
    AND rounds.mirror_tester_id IS NULL
    AND COALESCE(rounds.program_family, reference_scenario.program_family) = v_required_family
  ORDER BY rounds.reference_assigned_at ASC, rounds.round_number ASC
  LIMIT 1;

  IF FOUND THEN
    SELECT *
    INTO v_pending_mirror_scenario
    FROM public.test_scenarios
    WHERE id = v_pending_round.mirror_scenario_id;

    SELECT *
    INTO v_pending_reference_scenario
    FROM public.test_scenarios
    WHERE id = v_pending_round.reference_scenario_id;

    RETURN jsonb_build_object(
      'mode', 'mirror_assignment',
      'campaignId', v_campaign_id,
      'campaignLabel', v_campaign_label,
      'requiredFamily', v_required_family::text,
      'completedFamilies', v_completed_families,
      'progressCount', v_progress_count,
      'totalRequiredTests', v_total_required_tests,
      'programStepNumber', v_program_step_number,
      'roundNumber', v_pending_round.round_number,
      'assignedScenario', to_jsonb(v_pending_mirror_scenario),
      'referenceScenario', to_jsonb(v_pending_reference_scenario)
    );
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_remaining_reference_scenarios
  FROM public.test_scenarios s
  WHERE s.is_active = true
    AND s.program_family = v_required_family
    AND s.mirror_role = 'reference'::public.test_scenario_mirror_role
    AND NULLIF(btrim(coalesce(s.mirror_group_key, '')), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.test_scenarios mirror_scenario
      WHERE mirror_scenario.is_active = true
        AND mirror_scenario.program_family = s.program_family
        AND mirror_scenario.mirror_role = 'mirror'::public.test_scenario_mirror_role
        AND mirror_scenario.mirror_group_key = s.mirror_group_key
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.test_mirror_rounds rounds
      WHERE rounds.campaign_id = v_campaign_id
        AND rounds.reference_scenario_id = s.id
    );

  IF jsonb_array_length(v_remaining_reference_scenarios) = 0 THEN
    RETURN jsonb_build_object(
      'mode', 'unavailable',
      'campaignId', v_campaign_id,
      'campaignLabel', v_campaign_label,
      'requiredFamily', v_required_family::text,
      'completedFamilies', v_completed_families,
      'progressCount', v_progress_count,
      'totalRequiredTests', v_total_required_tests,
      'programStepNumber', v_program_step_number,
      'remainingReferenceScenarios', v_remaining_reference_scenarios
    );
  END IF;

  RETURN jsonb_build_object(
    'mode', 'reference_choice',
    'campaignId', v_campaign_id,
    'campaignLabel', v_campaign_label,
    'requiredFamily', v_required_family::text,
    'completedFamilies', v_completed_families,
    'progressCount', v_progress_count,
    'totalRequiredTests', v_total_required_tests,
    'programStepNumber', v_program_step_number,
    'remainingReferenceScenarios', v_remaining_reference_scenarios
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_test_mirror_session(
  p_tester_id uuid,
  p_selected_reference_scenario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_is_admin boolean := false;
  v_tester_email text;
  v_campaign_id uuid;
  v_campaign_label text;
  v_existing_session public.test_sessions%ROWTYPE;
  v_existing_scenario public.test_scenarios%ROWTYPE;
  v_pending_round public.test_mirror_rounds%ROWTYPE;
  v_reference_scenario public.test_scenarios%ROWTYPE;
  v_mirror_scenario public.test_scenarios%ROWTYPE;
  v_created_session public.test_sessions%ROWTYPE;
  v_progress jsonb := '{}'::jsonb;
  v_completed_families jsonb := '[]'::jsonb;
  v_progress_count integer := 0;
  v_total_required_tests integer := 4;
  v_program_step_number integer := 1;
  v_required_family_text text;
  v_required_family public.test_scenario_program_family;
BEGIN
  IF p_tester_id IS NULL THEN
    RAISE EXCEPTION 'Tester id is required';
  END IF;

  SELECT lower(email)
  INTO v_tester_email
  FROM public.user_testers
  WHERE id = p_tester_id
    AND is_active = true
  LIMIT 1;

  IF v_tester_email IS NULL THEN
    RAISE EXCEPTION 'Tester not found or inactive';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_actor_user_id
      AND is_admin = true
  )
  INTO v_is_admin;

  IF NOT v_is_admin AND v_tester_email <> v_actor_email THEN
    RAISE EXCEPTION 'Not allowed to access this tester';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.start_test_mirror_session'));

  SELECT ts.*
  INTO v_existing_session
  FROM public.test_sessions ts
  WHERE ts.tester_id = p_tester_id
    AND ts.status = 'in_progress'::public.test_session_status
  ORDER BY ts.started_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT *
    INTO v_existing_scenario
    FROM public.test_scenarios
    WHERE id = v_existing_session.scenario_id;

    RETURN jsonb_build_object(
      'mode', 'resume',
      'session', to_jsonb(v_existing_session),
      'scenario', to_jsonb(v_existing_scenario)
    );
  END IF;

  v_campaign_id := public.get_or_create_current_test_mirror_campaign_id();

  SELECT label
  INTO v_campaign_label
  FROM public.test_mirror_campaigns
  WHERE id = v_campaign_id;

  v_progress := public.get_test_program_progress(p_tester_id, v_campaign_id);
  v_completed_families := COALESCE(v_progress -> 'completedFamilies', '[]'::jsonb);
  v_progress_count := COALESCE((v_progress ->> 'progressCount')::integer, 0);
  v_total_required_tests := COALESCE((v_progress ->> 'totalRequiredTests')::integer, 4);
  v_program_step_number := COALESCE((v_progress ->> 'programStepNumber')::integer, 1);
  v_required_family_text := NULLIF(v_progress ->> 'requiredFamily', '');

  IF v_required_family_text IS NOT NULL THEN
    v_required_family := v_required_family_text::public.test_scenario_program_family;
  END IF;

  IF COALESCE((v_progress ->> 'programCompleted')::boolean, false) THEN
    RETURN jsonb_build_object(
      'mode', 'program_completed',
      'campaignId', v_campaign_id,
      'campaignLabel', v_campaign_label,
      'completedFamilies', v_completed_families,
      'progressCount', v_progress_count,
      'totalRequiredTests', v_total_required_tests,
      'programStepNumber', v_program_step_number
    );
  END IF;

  SELECT rounds.*
  INTO v_pending_round
  FROM public.test_mirror_rounds rounds
  JOIN public.test_scenarios reference_scenario
    ON reference_scenario.id = rounds.reference_scenario_id
  WHERE rounds.campaign_id = v_campaign_id
    AND rounds.mirror_tester_id IS NULL
    AND COALESCE(rounds.program_family, reference_scenario.program_family) = v_required_family
  ORDER BY rounds.reference_assigned_at ASC, rounds.round_number ASC
  LIMIT 1
  FOR UPDATE OF rounds;

  IF FOUND THEN
    SELECT *
    INTO v_mirror_scenario
    FROM public.test_scenarios
    WHERE id = v_pending_round.mirror_scenario_id;

    INSERT INTO public.test_sessions (
      tester_id,
      scenario_id,
      status,
      started_at
    )
    VALUES (
      p_tester_id,
      v_mirror_scenario.id,
      'in_progress'::public.test_session_status,
      now()
    )
    RETURNING *
    INTO v_created_session;

    UPDATE public.test_mirror_rounds
    SET
      mirror_tester_id = p_tester_id,
      mirror_session_id = v_created_session.id,
      mirror_assigned_at = now(),
      program_family = COALESCE(program_family, v_required_family)
    WHERE id = v_pending_round.id;

    RETURN jsonb_build_object(
      'mode', 'mirror_assignment',
      'campaignId', v_campaign_id,
      'campaignLabel', v_campaign_label,
      'requiredFamily', v_required_family::text,
      'completedFamilies', v_completed_families,
      'progressCount', v_progress_count,
      'totalRequiredTests', v_total_required_tests,
      'programStepNumber', v_program_step_number,
      'roundNumber', v_pending_round.round_number,
      'session', to_jsonb(v_created_session),
      'scenario', to_jsonb(v_mirror_scenario)
    );
  END IF;

  IF p_selected_reference_scenario_id IS NULL THEN
    RAISE EXCEPTION 'A reference scenario must be selected';
  END IF;

  SELECT *
  INTO v_reference_scenario
  FROM public.test_scenarios
  WHERE id = p_selected_reference_scenario_id
    AND is_active = true
    AND program_family = v_required_family
    AND mirror_role = 'reference'::public.test_scenario_mirror_role
    AND NULLIF(btrim(coalesce(mirror_group_key, '')), '') IS NOT NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected reference scenario is not available for the required test family';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.test_mirror_rounds
    WHERE campaign_id = v_campaign_id
      AND reference_scenario_id = v_reference_scenario.id
  ) THEN
    RAISE EXCEPTION 'Selected reference scenario was already used in this campaign';
  END IF;

  SELECT *
  INTO v_mirror_scenario
  FROM public.test_scenarios
  WHERE is_active = true
    AND program_family = v_required_family
    AND mirror_role = 'mirror'::public.test_scenario_mirror_role
    AND mirror_group_key = v_reference_scenario.mirror_group_key
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active mirror scenario is configured for this reference in the required family';
  END IF;

  INSERT INTO public.test_sessions (
    tester_id,
    scenario_id,
    status,
    started_at
  )
  VALUES (
    p_tester_id,
    v_reference_scenario.id,
    'in_progress'::public.test_session_status,
    now()
  )
  RETURNING *
  INTO v_created_session;

  INSERT INTO public.test_mirror_rounds (
    campaign_id,
    program_family,
    reference_scenario_id,
    mirror_scenario_id,
    reference_tester_id,
    reference_session_id,
    reference_assigned_at
  )
  VALUES (
    v_campaign_id,
    v_required_family,
    v_reference_scenario.id,
    v_mirror_scenario.id,
    p_tester_id,
    v_created_session.id,
    now()
  )
  RETURNING *
  INTO v_pending_round;

  RETURN jsonb_build_object(
    'mode', 'reference_choice',
    'campaignId', v_campaign_id,
    'campaignLabel', v_campaign_label,
    'requiredFamily', v_required_family::text,
    'completedFamilies', v_completed_families,
    'progressCount', v_progress_count,
    'totalRequiredTests', v_total_required_tests,
    'programStepNumber', v_program_step_number,
    'roundNumber', v_pending_round.round_number,
    'session', to_jsonb(v_created_session),
    'scenario', to_jsonb(v_reference_scenario)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_program_progress(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_test_mirror_start_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_test_mirror_session(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_test_mirror_start_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_test_mirror_session(uuid, uuid) TO authenticated;
